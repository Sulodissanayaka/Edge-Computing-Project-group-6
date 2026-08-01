"""Smart Classroom edge API backed by the trained YOLO11 ONNX model."""

from __future__ import annotations

import os
import threading
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = Path(os.getenv("MODEL_PATH", BASE_DIR / "models" / "classroom_person.onnx"))
CAMERA_SOURCE_RAW = os.getenv("CAMERA_SOURCE", "0")
CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", "0.25"))
IOU_THRESHOLD = float(os.getenv("IOU_THRESHOLD", "0.45"))
FRAME_INTERVAL = max(float(os.getenv("FRAME_INTERVAL", "0.02")), 0.01)
OCCUPANCY_CONFIRM_SECONDS = float(os.getenv("OCCUPANCY_CONFIRM_SECONDS", "15"))
OCCUPANCY_RELEASE_SECONDS = float(os.getenv("OCCUPANCY_RELEASE_SECONDS", "60"))
AC_MIN_ON_SECONDS = float(os.getenv("AC_MIN_ON_SECONDS", "300"))
AC_MIN_OFF_SECONDS = float(os.getenv("AC_MIN_OFF_SECONDS", "30"))
TEMP_CHANGE_COOLDOWN_SECONDS = float(os.getenv("TEMP_CHANGE_COOLDOWN_SECONDS", "600"))
INPUT_SIZE = 320


def occupancy_rule(person_count: int) -> tuple[str, str, int | None]:
    if person_count == 0:
        return "EMPTY", "OFF", None
    if person_count <= 2:
        return "LOW", "OFF", None
    if person_count <= 9:
        return "MEDIUM", "ON", 24
    return "HIGH", "ON", 20


def parse_camera_source(value: str) -> int | str:
    return int(value) if value.strip().lstrip("-").isdigit() else value


class ClimateController:
    """Protects the AC from noisy detections and rapid command changes."""

    def __init__(self) -> None:
        now = time.monotonic()
        self.lock = threading.Lock()
        self.occupancy = "EMPTY"
        self.ac_state = "OFF"
        self.temperature: int | None = None
        self.candidate: str | None = None
        self.candidate_since = now
        self.last_ac_change = now - AC_MIN_OFF_SECONDS
        self.last_temperature_change = now - TEMP_CHANGE_COOLDOWN_SECONDS

    def update(self, person_count: int) -> dict:
        now = time.monotonic()
        raw_occupancy, _, _ = occupancy_rule(person_count)
        with self.lock:
            pending = False
            pending_seconds = 0
            reason = "Stable occupancy; AC command is protected"

            if raw_occupancy == self.occupancy:
                self.candidate = None
            else:
                if self.candidate != raw_occupancy:
                    self.candidate = raw_occupancy
                    self.candidate_since = now
                moving_down = (
                    raw_occupancy in {"EMPTY", "LOW"}
                    or (self.occupancy == "HIGH" and raw_occupancy == "MEDIUM")
                )
                confirmation = (
                    OCCUPANCY_RELEASE_SECONDS if moving_down else OCCUPANCY_CONFIRM_SECONDS
                )
                elapsed = now - self.candidate_since
                if elapsed >= confirmation:
                    self.occupancy = raw_occupancy
                    self.candidate = None
                else:
                    pending = True
                    pending_seconds = int(max(0, confirmation - elapsed) + 0.999)
                    reason = (
                        f"Confirming {raw_occupancy} occupancy for "
                        f"{pending_seconds} more seconds"
                    )

            _, desired_ac, desired_temperature = occupancy_rule(
                0 if self.occupancy == "EMPTY"
                else 1 if self.occupancy == "LOW"
                else 3 if self.occupancy == "MEDIUM"
                else 10
            )

            if desired_ac != self.ac_state:
                guard = AC_MIN_ON_SECONDS if self.ac_state == "ON" else AC_MIN_OFF_SECONDS
                elapsed = now - self.last_ac_change
                if not pending and elapsed >= guard:
                    self.ac_state = desired_ac
                    self.last_ac_change = now
                    if desired_ac == "ON":
                        self.temperature = desired_temperature
                        self.last_temperature_change = now
                    else:
                        self.temperature = None
                else:
                    pending = True
                    remaining = max(0, guard - elapsed)
                    pending_seconds = max(pending_seconds, int(remaining + 0.999))
                    if remaining > 0:
                        reason = (
                            f"AC minimum {self.ac_state} time: "
                            f"{int(remaining + 0.999)} seconds remaining"
                        )
            elif (
                self.ac_state == "ON"
                and desired_temperature is not None
                and desired_temperature != self.temperature
            ):
                elapsed = now - self.last_temperature_change
                if not pending and elapsed >= TEMP_CHANGE_COOLDOWN_SECONDS:
                    self.temperature = desired_temperature
                    self.last_temperature_change = now
                else:
                    remaining = max(0, TEMP_CHANGE_COOLDOWN_SECONDS - elapsed)
                    pending = True
                    pending_seconds = max(pending_seconds, int(remaining + 0.999))
                    reason = (
                        f"Temperature cooldown: "
                        f"{int(remaining + 0.999)} seconds remaining"
                    )

            return {
                "raw_occupancy": raw_occupancy,
                "occupancy": self.occupancy,
                "ac_state": self.ac_state,
                "temperature": self.temperature,
                "control_pending": pending,
                "pending_seconds": pending_seconds,
                "control_reason": reason,
            }


class PersonDetector:
    def __init__(self, model_path: Path) -> None:
        if not model_path.is_file():
            raise FileNotFoundError(f"Model not found: {model_path}")
        self.net = cv2.dnn.readNetFromONNX(str(model_path))
        self.net.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
        self.net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)

    @staticmethod
    def _letterbox(frame: np.ndarray) -> tuple[np.ndarray, float, int, int]:
        height, width = frame.shape[:2]
        scale = min(INPUT_SIZE / width, INPUT_SIZE / height)
        resized_w, resized_h = round(width * scale), round(height * scale)
        resized = cv2.resize(frame, (resized_w, resized_h), interpolation=cv2.INTER_LINEAR)
        pad_x = (INPUT_SIZE - resized_w) // 2
        pad_y = (INPUT_SIZE - resized_h) // 2
        canvas = np.full((INPUT_SIZE, INPUT_SIZE, 3), 114, dtype=np.uint8)
        canvas[pad_y : pad_y + resized_h, pad_x : pad_x + resized_w] = resized
        tensor = cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB)
        tensor = tensor.transpose(2, 0, 1).astype(np.float32) / 255.0
        return np.expand_dims(tensor, axis=0), scale, pad_x, pad_y

    def detect(self, frame: np.ndarray) -> tuple[list[dict], float]:
        started = time.perf_counter()
        tensor, scale, pad_x, pad_y = self._letterbox(frame)
        self.net.setInput(tensor)
        output = self.net.forward()
        predictions = np.squeeze(output).T

        boxes_xywh = predictions[:, :4]
        scores = predictions[:, 4]
        keep = scores >= CONFIDENCE_THRESHOLD
        boxes_xywh, scores = boxes_xywh[keep], scores[keep]

        if not len(scores):
            return [], (time.perf_counter() - started) * 1000

        nms_boxes: list[list[float]] = []
        for x_center, y_center, width, height in boxes_xywh:
            nms_boxes.append([
                float(x_center - width / 2),
                float(y_center - height / 2),
                float(width),
                float(height),
            ])

        indices = cv2.dnn.NMSBoxes(
            nms_boxes,
            scores.tolist(),
            CONFIDENCE_THRESHOLD,
            IOU_THRESHOLD,
        )
        frame_h, frame_w = frame.shape[:2]
        detections: list[dict] = []
        for index in np.array(indices).reshape(-1):
            x, y, width, height = nms_boxes[int(index)]
            x1 = int(np.clip((x - pad_x) / scale, 0, frame_w - 1))
            y1 = int(np.clip((y - pad_y) / scale, 0, frame_h - 1))
            x2 = int(np.clip((x + width - pad_x) / scale, 0, frame_w - 1))
            y2 = int(np.clip((y + height - pad_y) / scale, 0, frame_h - 1))
            detections.append({
                "confidence": round(float(scores[int(index)]), 4),
                "box": [x1, y1, x2, y2],
            })
        return detections, (time.perf_counter() - started) * 1000


class CameraWorker:
    def __init__(self) -> None:
        self.detector: PersonDetector | None = None
        self.capture: cv2.VideoCapture | None = None
        self.thread: threading.Thread | None = None
        self.stop_event = threading.Event()
        self.lock = threading.Lock()
        self.started_at = time.monotonic()
        self.camera_source = CAMERA_SOURCE_RAW
        self.latest_frame: np.ndarray | None = None
        self.status = {
            "person_count": 0,
            "detections": [],
            "confidence": 0.0,
            "inference_ms": 0.0,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "edge_connected": False,
            "camera_active": False,
            "error": "Starting inference service",
        }

    def start(self) -> None:
        try:
            self.detector = PersonDetector(MODEL_PATH)
        except Exception as exc:
            with self.lock:
                self.status["error"] = str(exc)
            return
        self.stop_event.clear()
        self.thread = threading.Thread(target=self._run, name="camera-inference", daemon=True)
        self.thread.start()

    def stop(self) -> None:
        self.stop_event.set()
        if self.thread:
            self.thread.join(timeout=3)
        if self.capture:
            self.capture.release()

    def _open_camera(self) -> bool:
        if self.capture:
            self.capture.release()
        with self.lock:
            source = self.camera_source
        self.capture = cv2.VideoCapture(parse_camera_source(source))
        return self.capture.isOpened()

    def set_camera_source(self, source: str) -> None:
        with self.lock:
            self.camera_source = source
            self.status.update(
                camera_active=False,
                error="Opening uploaded video",
            )
        if self.capture:
            self.capture.release()

    def _run(self) -> None:
        while not self.stop_event.is_set():
            if not self.capture or not self.capture.isOpened():
                if not self._open_camera():
                    with self.lock:
                        self.status.update(
                            camera_active=False,
                            edge_connected=True,
                            error=f"Cannot open camera source: {self.camera_source}",
                        )
                    self.stop_event.wait(2)
                    continue

            ok, frame = self.capture.read()
            if not ok:
                self.capture.release()
                self.stop_event.wait(0.5)
                continue

            try:
                detections, inference_ms = self.detector.detect(frame)
                person_count = len(detections)
                confidence = (
                    float(np.mean([item["confidence"] for item in detections]))
                    if detections
                    else 1.0
                )
                with self.lock:
                    self.latest_frame = frame.copy()
                    self.status.update(
                        person_count=person_count,
                        detections=detections,
                        confidence=round(confidence, 4),
                        inference_ms=round(inference_ms, 1),
                        timestamp=datetime.now(timezone.utc).isoformat(),
                        edge_connected=True,
                        camera_active=True,
                        error=None,
                    )
            except Exception as exc:
                with self.lock:
                    self.status["error"] = f"Inference failed: {exc}"
            self.stop_event.wait(FRAME_INTERVAL)

    def get_status(self) -> dict:
        with self.lock:
            payload = dict(self.status)
        occupancy, ac_state, temperature = occupancy_rule(payload["person_count"])
        payload.update(
            occupancy=occupancy,
            ac_state=ac_state,
            temperature=temperature,
            runtime_seconds=int(time.monotonic() - self.started_at),
            model_name="Classroom Person Detector (YOLO11n ONNX)",
            device_name=os.getenv("DEVICE_NAME", "Local Edge Device"),
        )
        return payload

    def get_snapshot(self) -> bytes | None:
        with self.lock:
            if self.latest_frame is None:
                return None
            frame = self.latest_frame.copy()
            detections = list(self.status["detections"])
        for item in detections:
            x1, y1, x2, y2 = item["box"]
            cv2.rectangle(frame, (x1, y1), (x2, y2), (65, 220, 120), 2)
            cv2.putText(
                frame,
                f"person {item['confidence']:.2f}",
                (x1, max(20, y1 - 6)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                (65, 220, 120),
                2,
            )
        ok, encoded = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
        return encoded.tobytes() if ok else None


worker = CameraWorker()
climate_controller = ClimateController()


@asynccontextmanager
async def lifespan(_: FastAPI):
    worker.start()
    yield
    worker.stop()


app = FastAPI(title="Smart Classroom Edge API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(","),
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/status")
def get_status() -> dict:
    status = worker.get_status()
    status.update(climate_controller.update(status["person_count"]))
    return status


@app.get("/health")
def get_health() -> dict:
    status = worker.get_status()
    return {
        "ok": status["edge_connected"] and status["error"] is None,
        "model_loaded": worker.detector is not None,
        "camera_active": status["camera_active"],
        "error": status["error"],
    }


@app.get("/snapshot.jpg")
def get_snapshot() -> Response:
    image = worker.get_snapshot()
    if image is None:
        raise HTTPException(status_code=503, detail="No camera frame is available yet")
    return Response(content=image, media_type="image/jpeg")


@app.post("/video")
async def upload_video(video: UploadFile = File(...)) -> dict:
    allowed_extensions = {".mp4", ".avi", ".mov", ".mkv", ".webm", ".m4v"}
    extension = Path(video.filename or "").suffix.lower()
    if extension not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported video type. Use: {', '.join(sorted(allowed_extensions))}",
        )

    upload_dir = BASE_DIR / "uploads"
    upload_dir.mkdir(exist_ok=True)
    destination = upload_dir / f"video_{int(time.time() * 1000)}{extension}"
    size = 0
    max_size = 1024 * 1024 * 1024
    try:
        with destination.open("wb") as output:
            while chunk := await video.read(1024 * 1024):
                size += len(chunk)
                if size > max_size:
                    raise HTTPException(status_code=413, detail="Video exceeds the 1 GB limit")
                output.write(chunk)
    except Exception:
        destination.unlink(missing_ok=True)
        raise
    finally:
        await video.close()

    worker.set_camera_source(str(destination))
    return {
        "ok": True,
        "filename": video.filename,
        "size_bytes": size,
        "message": "Video uploaded. Person detection is starting.",
    }
