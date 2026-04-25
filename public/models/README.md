# Model Folder

Place your exported YOLO ONNX model here:

```text
public/models/waste-yolo.onnx
```

The app intentionally does not commit a large model file. To use the selected
open-source model, run:

```bash
npm run model:setup
```

That command downloads the MIT-licensed Hugging Face model
`HrutikAdsare/waste-detection-yolov8`, exports it to ONNX, and copies it to this
folder.
