# 🎓 Smart Classroom Edge AI System

An Edge AI-based Smart Classroom system that detects classroom occupancy and activities from video, performs real-time inference on an edge device, and automatically controls a simulated air conditioning (AC) system.

## 📌 Project Overview

This project uses Artificial Intelligence and Computer Vision to classify classroom occupancy levels and automate classroom environmental control.

The system performs the following tasks:

- 📹 Detect classroom occupancy from live camera or video
- 👥 Classify occupancy as:
  - Low Occupancy
  - Medium Occupancy
  - High Occupancy
- 🧹 Detect classroom activity (e.g., Janitor Cleaning)
- ❄️ Automatically simulate AC control
- 📊 Display system status on a real-time dashboard
- 💻 Run inference locally on an Edge device

---

# 🏗️ System Architecture

```
Video Camera
      │
      ▼
YOLO Object Detection
      │
      ▼
Student Counting
      │
      ▼
Occupancy Classification
(Low / Medium / High)
      │
      ▼
AC Controller
      │
      ▼
Dashboard
```

---

# 🚀 Features

- Real-time student detection
- Occupancy level classification
- Automatic AC simulation
- Dashboard monitoring
- Edge AI deployment
- Docker support
- Cloud model training
- Offline inference

---

# 📂 Project Structure

```
Smart-Classroom-Edge-AI/
│
├── dataset/
│   ├── images/
│   ├── labels/
│   ├── videos/
│   └── data.yaml
│
├── models/
│   └── best.pt
│
├── training/
│   ├── train.py
│   ├── detect.py
│   └── evaluate.py
│
├── dashboard/
│   ├── app.py
│   ├── templates/
│   └── static/
│
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
│
├── docs/
│
├── screenshots/
│
├── README.md
└── requirements.txt
```

---

# 🛠 Technologies Used

## Artificial Intelligence

- YOLOv11 (Ultralytics)
- OpenCV
- Python

## Cloud Training

- Google Colab
- Azure Machine Learning (Optional)

## Dashboard

- Streamlit / Flask

## Deployment

- Docker

---

# 📊 Occupancy Classes

| Occupancy | Number of Students |
|------------|-------------------|
| Low | 1–2 |
| Medium | 3–9 |
| High | 10+ |

---

# ❄️ AC Automation Rules

| Occupancy | AC Status | Temperature |
|------------|----------|-------------|
| Low | OFF | — |
| Medium | ON | 24°C |
| High | ON | 20°C |

---

# 📹 Dataset

The dataset contains classroom videos covering:

- Low Occupancy
- Medium Occupancy
- High Occupancy
- Students Arriving
- Students Leaving
- Janitor Cleaning

Images are extracted from videos and labeled in YOLO format.

---

# ⚙️ Installation

Clone the repository

```bash
git clone https://github.com/USERNAME/Smart-Classroom-Edge-AI.git
```

Move into the project

```bash
cd Smart-Classroom-Edge-AI
```

Install dependencies

```bash
pip install -r requirements.txt
```

---

# ▶️ Train Model

```bash
python train.py
```

or

```bash
yolo detect train data=dataset/data.yaml model=yolo11n.pt epochs=100 imgsz=640
```

---

# ▶️ Run Detection

Video

```bash
python detect.py
```

Webcam

```python
source = 0
```

Image

```python
source = "image.jpg"
```

---

# 🐳 Docker

Build

```bash
docker build -t smart-classroom .
```

Run

```bash
docker run smart-classroom
```

---

# 📈 Dashboard Displays

- Student Count
- Occupancy Level
- AC Status
- Temperature
- Runtime
- Timestamp

---

# 📸 Screenshots

```
screenshots/

dashboard.png

detection.png

training.png
```

---

# 📚 Future Improvements

- Face anonymization
- Student tracking (ByteTrack)
- Raspberry Pi deployment
- Jetson Nano optimization
- MQTT integration
- Mobile dashboard
- Cloud synchronization

---

# 👨‍💻 Team

University of Jaffna

Edge Computing Project

2026

---

# 📄 License

This project is developed for academic purposes.

---

# 🙏 Acknowledgements

- University of Jaffna
- Ultralytics YOLO
- OpenCV
- Docker
- Google Colab
