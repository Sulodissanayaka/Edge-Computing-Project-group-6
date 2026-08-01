# 🧠 Smart Classroom — Data Scientist Deliverables

This branch contains the computer-vision deliverables produced by the Data
Scientist team for the **Smart Classroom Edge AI System**. The package provides
an exported YOLO11 ONNX person detector, local inference source code, runtime
dependencies, Docker support, and the integration contract required by the
application team.

> University of Jaffna — Edge Computing Project, Group 6, 2026

---

## 📖 Purpose

The model detects people in classroom video on a local edge device. Detection
results are converted into a people count and an occupancy category that the
application can use for AC-control recommendations.

The Data Scientist package is responsible for:

- providing the exported ONNX model;
- defining preprocessing and output expectations;
- running local person-detection inference;
- exposing detections through a small FastAPI service;
- documenting confidence, IoU, and occupancy defaults;
- protecting private classroom data from accidental commits.

Dashboard components, application integration, and deployment orchestration
belong to the `App-Developers` branch and are not included here.

---

## 📁 Branch Structure

```text
Data-Scientists/
├── data-science/
│   ├── models/
│   │   ├── classroom_person.onnx
│   │   └── README.md
│   ├── src/
│   │   ├── __init__.py
│   │   └── main.py
│   ├── Dockerfile
│   ├── README.md
│   └── requirements.txt
└── README.md
```

Detailed runtime and API information is available in
[`data-science/README.md`](data-science/README.md).

---

## 🧠 Model Contract

| Property | Value |
| --- | --- |
| Task | Classroom person detection |
| Model | YOLO11n |
| Format | ONNX |
| Model file | `data-science/models/classroom_person.onnx` |
| Input | `1 × 3 × 320 × 320` float32 RGB tensor |
| Preprocessing | Letterbox padding with 114, RGB conversion, divide by 255 |
| Inference engine | OpenCV DNN |
| Default confidence | 0.25 |
| Default IoU threshold | 0.45 |
| Detected class | Person |

The service returns bounding boxes and confidence scores. The people count is
the number of detections remaining after confidence filtering and non-maximum
suppression.

---

## 📊 Default Occupancy Rules

| People detected | Occupancy | AC recommendation | Temperature |
| ---: | --- | --- | ---: |
| 0 | Empty | OFF | — |
| 1–2 | Low | OFF | — |
| 3–9 | Medium | ON | 24°C |
| 10+ | High | ON | 20°C |

These are backend defaults. The application dashboard may allow users to adjust
the displayed automation thresholds.

---

## ⚙️ Local Setup

Requirements:

- Python 3.10 or newer
- A webcam, approved classroom video, or supported video stream

```powershell
git clone --branch Data-Scientists https://github.com/Sulodissanayaka/Edge-Computing-Project-group-6.git
cd Edge-Computing-Project-group-6\data-science
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn src.main:app --host 0.0.0.0 --port 8000
```

Open <http://localhost:8000/health> to check model and camera readiness.

The default camera source is device `0`. Set `CAMERA_SOURCE` to another camera
index, local video path, RTSP URL, or HTTP stream when required.

---

## 🐳 Docker

Build the standalone inference image:

```bash
cd data-science
docker build -t smart-classroom-inference .
```

Run it:

```bash
docker run --rm -p 8000:8000 smart-classroom-inference
```

Camera-device access from Docker depends on the host operating system. An
approved uploaded video is the most portable demonstration input.

---

## 🔌 API Handoff

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/health` | Reports model and camera readiness |
| `GET` | `/status` | Returns count, detections, occupancy, and AC recommendation |
| `GET` | `/snapshot.jpg` | Returns the latest frame with detection boxes |
| `POST` | `/video` | Uploads a classroom video for local inference |

Important response fields include:

- `person_count`
- `detections`
- `confidence`
- `inference_ms`
- `occupancy`
- `ac_state`
- `temperature`
- `control_pending`
- `control_reason`

---

## 🔧 Runtime Configuration

The inference service supports these environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `MODEL_PATH` | `models/classroom_person.onnx` | ONNX model location |
| `CAMERA_SOURCE` | `0` | Camera, video file, or stream |
| `CONFIDENCE_THRESHOLD` | `0.25` | Minimum detection confidence |
| `IOU_THRESHOLD` | `0.45` | Non-maximum suppression threshold |
| `FRAME_INTERVAL` | `0.02` | Delay between processed frames |
| `OCCUPANCY_CONFIRM_SECONDS` | `15` | Confirmation before occupancy increases |
| `OCCUPANCY_RELEASE_SECONDS` | `60` | Confirmation before occupancy decreases |
| `AC_MIN_ON_SECONDS` | `300` | Minimum simulated AC ON duration |
| `AC_MIN_OFF_SECONDS` | `30` | Minimum simulated AC OFF duration |
| `TEMP_CHANGE_COOLDOWN_SECONDS` | `600` | Minimum interval between temperature changes |

---

## ✅ Validation Checklist

Before handing a new model to the application team:

1. Confirm the ONNX file loads with OpenCV DNN.
2. Verify the input shape and normalization have not changed.
3. Test an approved classroom video with no people, few people, and many people.
4. Record detection quality and important limitations.
5. Check the `/health`, `/status`, and `/snapshot.jpg` endpoints.
6. Update the model contract if output tensor structure changes.
7. Confirm that no datasets, recordings, credentials, or caches are staged.

---

## 🔐 Data and Privacy Policy

- Do not commit raw classroom videos or private datasets.
- Use only recordings collected with appropriate permission.
- Prefer anonymized or non-identifiable validation samples.
- Never commit `.env` files, credentials, virtual environments, or training
  service tokens.
- Keep large experiment outputs and training caches outside the repository.
- The inference package processes frames locally and does not intentionally
  store detected faces.

---

## 🤝 Team Handoff

When the model changes, provide the App Developers with:

- the exported `.onnx` file;
- input shape and preprocessing requirements;
- output tensor format;
- class names;
- recommended confidence and IoU thresholds;
- evaluation results and known limitations;
- a version or commit identifier for the model artifact.

Changes should be reviewed through a pull request into `Data-Scientists`. The
completed team branches can later be integrated into `main` by the repository
owner.

---

## 🔮 Future Data Science Improvements

- Add formal evaluation metrics and reports
- Add training and ONNX-export scripts
- Add reproducible model configuration files
- Add dataset versioning without committing private data
- Optimize the model for Raspberry Pi and NVIDIA Jetson
- Add multi-person tracking with ByteTrack or DeepSORT
- Evaluate privacy-preserving face anonymization
- Add automated model-regression checks

---

## 📄 Use

This project is intended for educational and research purposes.
