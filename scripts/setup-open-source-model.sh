#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODEL_REPO="HrutikAdsare/waste-detection-yolov8"
MODEL_FILE="best.pt"
MODEL_URL="https://huggingface.co/${MODEL_REPO}/resolve/main/${MODEL_FILE}?download=true"
WORK_DIR="${ROOT_DIR}/vendor/open-source-models/waste-detection-yolov8"
PT_PATH="${WORK_DIR}/${MODEL_FILE}"
ONNX_SOURCE="${WORK_DIR}/best.onnx"
ONNX_TARGET="${ROOT_DIR}/public/models/waste-yolo.onnx"
VENV_DIR="${ROOT_DIR}/.venv-model-export"

mkdir -p "${WORK_DIR}" "${ROOT_DIR}/public/models"

echo "Using open-source model: ${MODEL_REPO}"
echo "License: MIT"

if [[ ! -f "${PT_PATH}" ]]; then
  echo "Downloading ${MODEL_URL}"
  python3 - <<PY
from pathlib import Path
from urllib.request import urlretrieve

url = "${MODEL_URL}"
target = Path("${PT_PATH}")
target.parent.mkdir(parents=True, exist_ok=True)
urlretrieve(url, target)
print(f"Saved {target}")
PY
else
  echo "Found existing PyTorch weights at ${PT_PATH}"
fi

if [[ ! -d "${VENV_DIR}" ]]; then
  echo "Creating Python export environment at ${VENV_DIR}"
  python3 -m venv "${VENV_DIR}"
fi

PYTHON_BIN="${VENV_DIR}/bin/python"

echo "Installing export dependencies. This can take a few minutes."
"${PYTHON_BIN}" -m pip install --upgrade pip
"${PYTHON_BIN}" -m pip install --index-url https://download.pytorch.org/whl/cpu torch torchvision
"${PYTHON_BIN}" -m pip install ultralytics onnx

echo "Exporting YOLO weights to ONNX..."
"${PYTHON_BIN}" - <<PY
from pathlib import Path
from ultralytics import YOLO

pt_path = Path("${PT_PATH}")
model = YOLO(str(pt_path))
model.export(format="onnx", imgsz=640, opset=12, simplify=False)
PY

if [[ ! -f "${ONNX_SOURCE}" ]]; then
  echo "Expected ONNX file was not created at ${ONNX_SOURCE}" >&2
  exit 1
fi

cp "${ONNX_SOURCE}" "${ONNX_TARGET}"
echo "Ready: ${ONNX_TARGET}"
echo "Run npm run dev and open the site."
