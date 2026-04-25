# AI Waste Classification

A non-commercial React + Vite website for local, browser-based waste detection
using an open-source YOLO model exported to ONNX. The first version has no
backend: camera frames are captured with `navigator.mediaDevices.getUserMedia()`,
preprocessed in the browser, and passed to ONNX Runtime Web.

The app is configured for the open-source Hugging Face model
[`HrutikAdsare/waste-detection-yolov8`](https://huggingface.co/HrutikAdsare/waste-detection-yolov8).
That model is MIT licensed and detects:

```text
cardboard, e-waste, glass, medical_waste, metal, organic_waste, paper, plastic
```

No large ONNX file is committed to this repository. Until you add one, the UI
shows:

```text
Model file not found. Please place your YOLO ONNX model at public/models/waste-yolo.onnx
```

## Features

- React + Vite frontend
- Phone and laptop friendly layout
- Browser camera support with `facingMode: { ideal: "environment" }`
- Local ONNX Runtime Web inference pipeline
- YOLO preprocessing for 640x640 NCHW input
- YOLO output parsing, confidence filtering, and non-maximum suppression
- Canvas overlay with bounding boxes, labels, and confidence scores
- Detection interval set to 300 ms for better mobile performance
- Confidence threshold slider, default `0.35`
- Disposal suggestions for the open-source model classes

## Install

```bash
npm install
```

## Use the Open-Source Model

Run one command to download the existing YOLOv8 waste model and export it to
ONNX:

```bash
npm run model:setup
```

This does not train anything. It:

- Downloads `best.pt` from `HrutikAdsare/waste-detection-yolov8`
- Creates a local Python export environment in `.venv-model-export`
- Installs CPU PyTorch, Ultralytics, and ONNX
- Exports the model to `public/models/waste-yolo.onnx`

The first run can take several minutes because PyTorch is a large dependency.
After the ONNX file exists, the React app runs inference locally in the browser.

## Run Locally

```bash
npm run dev
```

Open the local URL printed by Vite, usually:

```text
http://localhost:5173
```

Camera access works on `localhost`. On a real phone or deployed site, browsers
generally require HTTPS for camera permission.

## Add a Different ONNX Model

If you already have another YOLO detection model in ONNX format, place it here:

```text
public/models/waste-yolo.onnx
```

The current label order is defined in `src/utils/labels.js`:

```js
cardboard, e-waste, glass, medical_waste, metal, organic_waste, paper, plastic
```

Your model should use the same class order. If your model uses a different
order or different class names, update `WASTE_CLASSES` and `WASTE_SUGGESTIONS`
in `src/utils/labels.js`.

## Optional: Train Your Own Waste YOLO Model

You do not need this section to use the included open-source model. Keep it only
as a future customization path.

Install Ultralytics:

```bash
pip install ultralytics
```

Prepare a YOLO dataset with a `data.yaml` file. Example:

```yaml
path: ./dataset
train: images/train
val: images/val
names:
  0: cardboard
  1: e-waste
  2: glass
  3: medical_waste
  4: metal
  5: organic_waste
  6: paper
  7: plastic
```

Train a small open-source YOLOv8 model:

```bash
yolo detect train data=data.yaml model=yolov8n.pt epochs=100 imgsz=640
```

Export the best weights to ONNX:

```bash
yolo export model=runs/detect/train/weights/best.pt format=onnx
```

Copy the exported file to:

```text
public/models/waste-yolo.onnx
```

## Deploy

### Vercel

```bash
npm run build
```

Import the project in Vercel and use these settings:

- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`

### Netlify

```bash
npm run build
```

Import the project in Netlify and use these settings:

- Build command: `npm run build`
- Publish directory: `dist`

Keep the ONNX file under `public/models/waste-yolo.onnx` before deploying so it
is copied into the final static build.

## Known Limitations

- The repository does not commit the large exported ONNX file; run
  `npm run model:setup` or add `public/models/waste-yolo.onnx` yourself.
- The selected open-source model is trained from a small custom dataset, so it
  is useful for demos but not for safety-critical waste sorting.
- Postprocessing supports common YOLOv5/YOLOv8 ONNX detection output shapes, but
  a custom export may require small changes in `src/utils/postprocess.js`.
- Browser inference speed depends heavily on the phone, laptop, browser, and
  model size. Start with `yolov8n` or another nano/small model.
- The app uses the WebAssembly ONNX Runtime provider for broad static-hosting
  compatibility. WebGPU can be added later for faster inference on supported
  devices.
- Camera access on phones requires HTTPS unless you are using browser-supported
  local development exceptions.

## Project Structure

```text
waste-classifier-website/
├── public/
│   └── models/
│       └── waste-yolo.onnx
├── src/
│   ├── components/
│   │   ├── CameraView.jsx
│   │   ├── DetectionCanvas.jsx
│   │   ├── ResultPanel.jsx
│   │   └── WasteGuide.jsx
│   ├── utils/
│   │   ├── labels.js
│   │   ├── preprocess.js
│   │   ├── postprocess.js
│   │   └── yolo.js
│   ├── App.jsx
│   ├── main.jsx
│   └── styles.css
├── package.json
└── README.md
```
