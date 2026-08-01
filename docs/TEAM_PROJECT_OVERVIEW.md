# 🖥️ Smart Classroom Application — Team Project Overview

This document describes the application delivered by the **App Developers** for
the Smart Classroom Edge AI System. It covers the dashboard, backend integration,
local startup, Docker deployment, and the interface between the application and
the Data Scientist model package.

---

## 📖 Application Goal

The application turns local classroom-person detections into a clear monitoring
and AC-control experience. A FastAPI service runs the ONNX detector on a webcam,
stream, or uploaded video. The React dashboard displays the result and allows a
user to change occupancy thresholds or override the simulated AC.

The application is designed to:

- run inference locally on an edge computer;
- show classroom occupancy without storing faces;
- explain the current AC recommendation;
- remain usable on desktop, tablet, and smaller screens;
- support light and dark appearance modes;
- start easily on Windows or with Docker Compose.

---

## 🏗️ Application Architecture

```text
Camera / uploaded classroom video
                 │
                 ▼
        FastAPI edge backend
                 │
                 ├── OpenCV video capture
                 ├── YOLO11 ONNX inference
                 ├── person count and confidence
                 └── protected AC recommendation
                 │
                 ▼
          REST API on port 8010
                 │
                 ▼
       React + Vite dashboard
                 │
                 ▼
          Browser on port 5173
```

The frontend polls the backend for status and requests the latest annotated
snapshot. If API mode is disabled, it can run with its built-in interactive
demonstration data.

---

## ✨ Delivered Features

### Live inference

- Webcam, local video, RTSP, or HTTP stream input
- Classroom-video upload from the dashboard
- Person bounding boxes and average confidence
- Live inference latency, device status, and timestamps
- Clear backend-unavailable and camera-error messages

### Occupancy monitoring

- Empty, Low, Medium, and High occupancy states
- People count and confidence display
- Recent occupancy activity and timeline
- Editable Low, Medium, and High thresholds
- Immediate dashboard feedback when rules are changed

### AC automation

- Automatic AC state and temperature recommendation
- Confirmation time for changing occupancy
- Minimum ON/OFF duration to protect against rapid switching
- Temperature-change cooldown
- Manual Auto, OFF, and ON controls
- Manual OFF resets displayed occupancy to Empty and stops AC runtime

### Dashboard experience

- Responsive metric cards and system-status layout
- Large video workspace
- Light and dark themes
- Persistent appearance selection
- High-contrast controls and readable status indicators
- Compact design for different screen widths

### Deployment

- Separate production Dockerfiles for frontend and backend
- Docker Compose orchestration
- Nginx-hosted production frontend
- Windows PowerShell launchers
- Double-click `start-project.bat`

---

## 📊 Default Automation Rules

| People | Occupancy | AC state | Temperature |
| ---: | --- | --- | ---: |
| 0 | Empty | OFF | — |
| 1–2 | Low | OFF | — |
| 3–9 | Medium | ON | 24°C |
| 10+ | High | ON | 20°C |

The dashboard thresholds can be edited manually. The backend also applies time
guards so temporary detection changes do not immediately cycle the simulated AC.

---

## 📁 App-Developers Branch Structure

```text
App-Developers/
├── backend/
│   ├── models/
│   │   └── classroom_person.onnx
│   ├── .env.example
│   ├── Dockerfile
│   ├── main.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── api.js
│   │   ├── icons.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── .env.example
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   └── vite.config.js
├── scripts/
│   ├── run-backend.ps1
│   ├── run-dashboard.ps1
│   └── start-project.bat
├── docs/
│   ├── TEAM_PROJECT_OVERVIEW.md
│   └── dashboard-reference.png
├── docker-compose.yml
└── README.md
```

---

## 🛠️ Application Technology

| Area | Technology |
| --- | --- |
| User interface | React 19, Vite 8, CSS |
| Backend service | Python, FastAPI, Uvicorn |
| Computer vision runtime | OpenCV DNN, NumPy |
| Model artifact | YOLO11n ONNX |
| Production web server | Nginx |
| Containers | Docker, Docker Compose |

The App Developers consume the exported ONNX model. Training notebooks,
datasets, evaluation results, and model-export workflows belong to the
`Data-Scientists` branch.

---

## ▶️ Run the Application

### Windows one-click start

Complete the Python setup once:

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

Then double-click:

```text
scripts/start-project.bat
```

The launcher installs missing frontend dependencies, starts both services, and
opens <http://localhost:5173>.

### Manual development start

Backend terminal:

```powershell
.venv\Scripts\Activate.ps1
uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8010
```

Frontend terminal:

```powershell
cd frontend
npm install
npm run dev -- --host 0.0.0.0
```

### Docker Compose

```bash
docker compose up --build
```

| Service | Address |
| --- | --- |
| Dashboard | <http://localhost:5173> |
| Backend | <http://localhost:8010> |
| Health check | <http://localhost:8010/health> |

Stop the containers with `docker compose down`.

---

## 🔌 Backend Contract

| Method | Endpoint | Application use |
| --- | --- | --- |
| `GET` | `/health` | Checks model and camera readiness |
| `GET` | `/status` | Reads detections, occupancy, AC state, and timing |
| `GET` | `/snapshot.jpg` | Displays the latest annotated frame |
| `POST` | `/video` | Uploads a classroom video for inference |

Important response fields include `person_count`, `detections`, `confidence`,
`occupancy`, `ac_state`, `temperature`, `inference_ms`, `control_pending`, and
`control_reason`.

---

## ⚙️ Configuration

Backend configuration is documented in `backend/.env.example`. Important values
include:

- `CAMERA_SOURCE`
- `MODEL_PATH`
- `CONFIDENCE_THRESHOLD`
- `IOU_THRESHOLD`
- `OCCUPANCY_CONFIRM_SECONDS`
- `OCCUPANCY_RELEASE_SECONDS`
- `AC_MIN_ON_SECONDS`
- `AC_MIN_OFF_SECONDS`
- `TEMP_CHANGE_COOLDOWN_SECONDS`
- `CORS_ORIGINS`

Frontend configuration is documented in `frontend/.env.example`:

- `VITE_USE_API=true`
- `VITE_API_BASE_URL=http://localhost:8010`
- `VITE_API_POLL_MS=200`

---

## ✅ App Developer Handoff Checklist

Before opening a pull request:

1. Run `npm run build` inside `frontend/`.
2. Confirm `GET /health` responds on port 8010.
3. Test video upload and live dashboard updates.
4. Check both light and dark themes.
5. Resize the browser and check responsive panels.
6. Confirm Auto, OFF, and ON controls behave correctly.
7. Ensure `.env`, uploaded videos, caches, and credentials are not committed.
8. Update API or setup documentation when behavior changes.

---

## 🔐 Privacy and Safety

- Video inference is performed locally.
- Faces are not intentionally stored by the dashboard.
- Uploaded videos are excluded from Git.
- Classroom recordings must only be used with appropriate permission.
- Secrets and local `.env` files must never be committed.
- Manual controls in this project simulate AC behavior; physical AC integration
  requires additional hardware safety controls.

---

## 🤝 Team Ownership

| Team branch | Primary ownership |
| --- | --- |
| `App-Developers` | Dashboard, API integration, startup, and deployment |
| `Data-Scientists` | Model, inference contract, evaluation, and AI documentation |
| `Product-Owner` | Requirements, priorities, and acceptance criteria |
| `Scrum-Master` | Sprint process, coordination, and delivery tracking |
| `main` | Reviewed integration of completed team work |

Changes should be developed on the appropriate branch and merged through pull
requests. Shared branches should not be force-pushed.

---

## 🔮 Recommended Next Improvements

- Add automated frontend and backend tests
- Add GitHub Actions for build and API checks
- Add authentication for manual AC controls
- Add persistent occupancy history and analytics
- Connect to a real AC controller through a safe IoT interface
- Optimize inference for Raspberry Pi or NVIDIA Jetson
- Add person tracking and privacy-preserving anonymization

---

## 👨‍💻 Project Information

**University of Jaffna**<br>
**Faculty of Science**<br>
**Edge Computing Project — Group 6, 2026**

This project is intended for educational and research use.
