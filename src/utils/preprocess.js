import * as ort from 'onnxruntime-web';

export const MODEL_INPUT_SIZE = 640;

const frameCanvas = document.createElement('canvas');
const frameContext = frameCanvas.getContext('2d', { willReadFrequently: true });

function getLetterboxSize(videoWidth, videoHeight, inputSize) {
  const scale = Math.min(inputSize / videoWidth, inputSize / videoHeight);
  const width = Math.round(videoWidth * scale);
  const height = Math.round(videoHeight * scale);

  return {
    scale,
    width,
    height,
    padX: Math.floor((inputSize - width) / 2),
    padY: Math.floor((inputSize - height) / 2),
  };
}

export function captureFrameToTensor(video, inputSize = MODEL_INPUT_SIZE) {
  const videoWidth = video.videoWidth;
  const videoHeight = video.videoHeight;

  if (!videoWidth || !videoHeight) {
    throw new Error('Video frame is not ready yet.');
  }

  frameCanvas.width = inputSize;
  frameCanvas.height = inputSize;

  const letterbox = getLetterboxSize(videoWidth, videoHeight, inputSize);

  // YOLO models commonly expect a square image. Letterboxing keeps the camera
  // aspect ratio intact, then postprocess.js removes this padding from boxes.
  frameContext.fillStyle = '#111827';
  frameContext.fillRect(0, 0, inputSize, inputSize);
  frameContext.drawImage(
    video,
    0,
    0,
    videoWidth,
    videoHeight,
    letterbox.padX,
    letterbox.padY,
    letterbox.width,
    letterbox.height,
  );

  const imageData = frameContext.getImageData(0, 0, inputSize, inputSize);
  const pixels = imageData.data;
  const redOffset = 0;
  const greenOffset = inputSize * inputSize;
  const blueOffset = inputSize * inputSize * 2;
  const tensorData = new Float32Array(3 * inputSize * inputSize);

  for (let i = 0, pixelIndex = 0; i < pixels.length; i += 4, pixelIndex += 1) {
    // Convert RGBA browser pixels into normalized RGB NCHW tensor data.
    tensorData[redOffset + pixelIndex] = pixels[i] / 255;
    tensorData[greenOffset + pixelIndex] = pixels[i + 1] / 255;
    tensorData[blueOffset + pixelIndex] = pixels[i + 2] / 255;
  }

  return {
    tensor: new ort.Tensor('float32', tensorData, [1, 3, inputSize, inputSize]),
    metadata: {
      inputSize,
      sourceWidth: videoWidth,
      sourceHeight: videoHeight,
      scale: letterbox.scale,
      padX: letterbox.padX,
      padY: letterbox.padY,
    },
  };
}
