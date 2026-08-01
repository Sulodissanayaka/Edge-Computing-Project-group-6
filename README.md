# Smart Classroom Edge AI Dashboard

This project uses a trained YOLO11 ONNX model to detect and count people in a
classroom video. A local FastAPI backend processes the video, applies protected
AC-control rules, and sends live results to the React/Vite dashboard.

## Occupancy and AC rules

- `EMPTY` (0 people): AC OFF
- `LOW` (1–2 people): AC OFF
- `MEDIUM` (3–9 people): AC ON at 24°C
- `HIGH` (10 or more people): AC ON at 20°C

To protect the AC from noisy detections and rapid switching, the controller
confirms increasing occupancy for 15 seconds and decreasing occupancy for 60
seconds. It also uses a five-minute minimum ON period, a 30-second restart
delay, and a ten-minute temperature-change cooldown.

## Requirements

- Windows 10 or 11 (for local development)
- Python 3.10 or newer
- Node.js 20.19+ or 22.12+
- npm 10+
- Docker Desktop (for the recommended container setup)

## Project structure

```text
.
|-- backend/
|   |-- models/
|   |-- Dockerfile
|   |-- main.py
|   `-- requirements.txt
|-- frontend/
|   |-- src/
|   |-- Dockerfile
|   |-- nginx.conf
|   |-- package.json
|   `-- vite.config.js
|-- scripts/
|   |-- run-backend.ps1
|   `-- run-dashboard.ps1
|-- docker-compose.yml
`-- docs/
```

## Run with Docker

Docker Compose starts the React dashboard and FastAPI backend together:

```powershell
docker compose up --build
```

Open:

- Dashboard: `http://localhost:5173`
- Backend health: `http://localhost:8010/health`

Stop and remove the containers:

```powershell
docker compose down
```

Uploaded videos are kept in the named `backend-uploads` Docker volume.

> Camera access from Docker Desktop on Windows depends on the camera source and
> host configuration. Video upload works without passing a webcam device into
> the container. For direct webcam use, run the backend locally as described
> below.

## First-time setup

Open PowerShell in the project directory:

```powershell
cd "path\to\smart-classroom-vite-dashboard"
```

Create the isolated Python environment and install backend dependencies:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

Install dashboard dependencies:

```powershell
Set-Location frontend
npm.cmd install
Set-Location ..
```

The trained model is already located at:

```text
backend\models\classroom_person.onnx
```

## Run the system

The backend and dashboard must run in two separate PowerShell terminals.

### One-click Windows start

Double-click:

```text
scripts\start-project.bat
```

The launcher starts the backend and frontend in separate command windows and
opens `http://localhost:5173` automatically. Close both command windows to stop
the project.

### Terminal 1 — model backend

```powershell
.\.venv\Scripts\python.exe -m uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8010
```

Wait until the terminal displays:

```text
Application startup complete
Uvicorn running on http://127.0.0.1:8010
```

### Terminal 2 — dashboard

```powershell
Set-Location frontend
npm.cmd run dev -- --host 127.0.0.1
```

Open the dashboard:

```text
http://localhost:5173
```

You can confirm the backend is available at:

```text
http://localhost:8010/health
```

## Test with a classroom video

1. Open `http://localhost:5173`.
2. Scroll to **Live Inference**.
3. Select **Upload classroom video**.
4. Choose an MP4, AVI, MOV, MKV, WebM, or M4V file.
5. Wait for the upload to finish.
6. The video, person boxes, count, occupancy, confidence, and AC state will
   update automatically.

Uploaded videos are stored locally in:

```text
backend\uploads
```

No video is sent to a cloud service.

## Use a webcam or camera stream

The default camera source is webcam `0`. Set another source before starting the
backend when required:

```powershell
$env:CAMERA_SOURCE = "1"
```

For an RTSP camera:

```powershell
$env:CAMERA_SOURCE = "rtsp://username:password@camera-address/stream"
```

Then start the backend using the Terminal 1 command.

## Production build

Build the optimized frontend:

```powershell
Set-Location frontend
npm.cmd run build
```

The production files are created in `dist`.

Preview the production build locally:

```powershell
npm.cmd run preview -- --host 127.0.0.1 --port 5173
```

The FastAPI backend must still be running in the other terminal.

## Stop the system

Press `Ctrl+C` once in the backend terminal and once in the dashboard terminal.

## Configuration

Frontend configuration is stored in `frontend\.env`:

```env
VITE_USE_API=true
VITE_API_BASE_URL=http://localhost:8010
VITE_API_POLL_MS=200
```

Backend configuration examples are in `backend\.env.example`. Important
options include:

- `CAMERA_SOURCE`
- `CONFIDENCE_THRESHOLD`
- `FRAME_INTERVAL`
- `OCCUPANCY_CONFIRM_SECONDS`
- `OCCUPANCY_RELEASE_SECONDS`
- `AC_MIN_ON_SECONDS`
- `AC_MIN_OFF_SECONDS`
- `TEMP_CHANGE_COOLDOWN_SECONDS`

## API endpoints

- `GET /status` — person count, occupancy and protected AC command
- `GET /health` — backend, model and camera health
- `GET /snapshot.jpg` — latest frame with person bounding boxes
- `POST /video` — upload a classroom video

## Common problems

### Dashboard says backend unavailable

Make sure Terminal 1 is still running and open:

```text
http://localhost:8010/health
```

### Webcam is inactive

The webcam may be unavailable or used by another application. Close other
camera applications, or upload a video through the dashboard.

### PowerShell blocks a `.ps1` script

Use the full Python and npm commands shown in this guide. They do not require
running the helper scripts.

### Port already in use

Stop the old backend/dashboard terminal with `Ctrl+C`, then run the commands
again.
