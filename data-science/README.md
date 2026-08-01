# Classroom Person Detection

This package runs the exported YOLO11 person detector on an edge device and
exposes results to the application through a small FastAPI service.

## Contents

```text
data-science/
├── models/
│   ├── classroom_person.onnx
│   └── README.md
├── src/
│   └── main.py
├── Dockerfile
├── README.md
└── requirements.txt
```

## Run locally

Requirements: Python 3.10 or newer and a webcam or video file.

```powershell
cd data-science
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn src.main:app --host 0.0.0.0 --port 8000
```

Open `http://localhost:8000/health` to verify the model loaded. The default
camera is device `0`. Set `CAMERA_SOURCE` to another camera index or video path
when required.

## Run with Docker

```powershell
docker build -t smart-classroom-inference .
docker run --rm -p 8000:8000 smart-classroom-inference
```

To use a physical camera from a container, pass the device using the method
supported by the host operating system.

## Model contract

| Item | Value |
| --- | --- |
| Model | YOLO11n person detector |
| Format | ONNX |
| Input | `1 × 3 × 320 × 320` float32 RGB tensor |
| Preprocessing | Letterbox with value 114, RGB conversion, divide by 255 |
| Output | Bounding boxes and confidence scores |
| Default confidence | 0.25 |
| Default IoU threshold | 0.45 |

The service returns only person detections. Occupancy defaults are EMPTY for 0,
LOW for 1–2, MEDIUM for 3–9, and HIGH for 10 or more people.

## API handoff

- `GET /health` — model and camera readiness
- `GET /status` — people count, detections, occupancy and AC recommendation
- `GET /snapshot.jpg` — latest annotated frame
- `POST /video` — upload a classroom video for inference

Runtime settings can be changed with environment variables:
`MODEL_PATH`, `CAMERA_SOURCE`, `CONFIDENCE_THRESHOLD`, `IOU_THRESHOLD`,
`FRAME_INTERVAL`, `CORS_ORIGINS`, and the occupancy/AC timing variables defined
in `src/main.py`.

## Data policy

Raw classroom videos and uploaded test files are excluded from Git. Store only
approved, anonymized samples. Never commit faces, credentials, or private data.
