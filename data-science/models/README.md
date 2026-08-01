# Model artifact

`classroom_person.onnx` is the exported classroom person detector consumed by
`../src/main.py`.

- Input tensor: float32 RGB, `1 × 3 × 320 × 320`
- Pixel range: 0–1
- Inference engine: OpenCV DNN
- Detected class: person

When replacing the model, keep the filename or update `MODEL_PATH`, then verify
the `/health` endpoint and test detection on an approved classroom video.
