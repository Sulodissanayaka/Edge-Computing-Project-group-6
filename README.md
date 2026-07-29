# 🎓 Smart Classroom Edge AI System

An AI-powered Smart Classroom system that detects classroom occupancy from classroom videos using **YOLO Object Detection**. Images are annotated using **Label Studio**, the model is trained in **Google Colab** or **Microsoft Azure Machine Learning**, and the trained model is deployed on an **Edge Device** for real-time occupancy detection and automatic AC control simulation.

---

## 📖 Project Overview

This project was developed for the **Edge Computing** course.

The system automatically:

- 📹 Detects students from classroom videos
- 👥 Counts the number of students
- 📊 Classifies classroom occupancy
- ❄️ Simulates automatic Air Conditioner (AC) control
- 📈 Displays the current classroom status on a dashboard
- 💻 Runs locally on an Edge Device

---

# 🏗️ System Workflow

```
Classroom Videos
        │
        ▼
Extract Images
        │
        ▼
Label Studio
(Image Annotation)
        │
        ▼
Export YOLO Dataset
        │
        ▼
Google Colab / Azure ML
(Model Training)
        │
        ▼
YOLO Model (best.pt)
        │
        ▼
Edge Device
(Local Inference)
        │
        ▼
Student Detection
        │
        ▼
Student Counting
        │
        ▼
Occupancy Classification
        │
        ▼
Dashboard
        │
        ▼
Automatic AC Control
```

---

# 🚀 Features

- Real-time Student Detection
- Student Counting
- Occupancy Classification
- Low / Medium / High Occupancy Detection
- Janitor Activity Detection
- Automatic AC Simulation
- Dashboard Monitoring
- Cloud Model Training
- Edge AI Deployment
- Docker Support

---

# 🏷️ Image Annotation

The dataset was annotated using **Label Studio**.

### Annotation Steps

1. Record classroom videos.
2. Extract images from videos.
3. Upload images to Label Studio.
4. Draw bounding boxes around each student.
5. Export annotations in **YOLO** format.
6. Create the training dataset.

---

# ☁️ Cloud Training

The YOLO model is trained using cloud computing.

Supported platforms:

- Google Colab
- Microsoft Azure Machine Learning

Training command:

```bash
yolo detect train data=dataset/data.yaml model=yolo11n.pt epochs=100 imgsz=640
```

After training, the best model is exported as:

```
best.pt
```

---

# 💻 Edge Deployment

The trained model runs locally on an Edge Device.

Supported devices:

- Windows PC
- Ubuntu Linux
- Raspberry Pi
- NVIDIA Jetson Nano

The system performs real-time inference without requiring an internet connection.

---

# 📊 Occupancy Levels

| Students | Occupancy |
|----------|-----------|
| 1–2 | Low |
| 3–9 | Medium |
| 10+ | High |

---

# ❄️ AC Simulation

| Occupancy | AC Status | Temperature |
|-----------|-----------|-------------|
| Low | OFF | -- |
| Medium | ON | 24°C |
| High | ON | 20°C |

---

# 📁 Project Structure

```
Smart-Classroom-Edge-AI/
│
├── dataset/
│   ├── train/
│   ├── valid/
│   ├── test/
│   ├── videos/
│   └── data.yaml
│
├── label-studio/
│
├── training/
│   ├── train.py
│   ├── detect.py
│   └── evaluate.py
│
├── edge/
│   ├── run_edge.py
│   ├── occupancy.py
│   └── ac_controller.py
│
├── dashboard/
│   └── app.py
│
├── models/
│   └── best.pt
│
├── screenshots/
│
├── docs/
│
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
└── README.md
```

---

# 🛠️ Technologies Used

## Programming

- Python

## Computer Vision

- YOLO11 (Ultralytics)
- OpenCV

## Annotation

- Label Studio

## Cloud Training

- Google Colab
- Microsoft Azure Machine Learning

## Dashboard

- Streamlit
- Flask

## Deployment

- Docker

---

# ⚙️ Installation

Clone the repository:

```bash
git clone https://github.com/your-username/Smart-Classroom-Edge-AI.git
```

Move to the project directory:

```bash
cd Smart-Classroom-Edge-AI
```

Install dependencies:

```bash
pip install -r requirements.txt
```

---

# ▶️ Train the Model

```bash
python training/train.py
```

or

```bash
yolo detect train data=dataset/data.yaml model=yolo11n.pt epochs=100 imgsz=640
```

---

# ▶️ Run Detection

Video

```bash
python training/detect.py
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

# 📊 Dashboard

The dashboard displays:

- Student Count
- Occupancy Level
- AC Status
- Temperature
- Timestamp
- AC Running Time

---

# 🐳 Docker

Build:

```bash
docker build -t smart-classroom .
```

Run:

```bash
docker run smart-classroom
```

---

# 📸 Screenshots

```
screenshots/

dashboard.png

detection.png

training.png

label-studio.png
```

---

# 🔮 Future Improvements

- Student Tracking (ByteTrack/DeepSORT)
- Face Anonymization
- Raspberry Pi Optimization
- MQTT Integration
- IoT-Based Smart Classroom
- Cloud Dashboard
- Automatic Model Retraining (MLOps)

---

# 👨‍💻 Team

**University of Jaffna**

**Faculty of Science**

**Edge Computing Project – 2026**

---

# 📄 License

This project is developed for educational and research purposes.

---

# 🙏 Acknowledgements

- University of Jaffna
- Ultralytics YOLO
- Label Studio
- OpenCV
- Google Colab
- Microsoft Azure Machine Learning
- Docker
