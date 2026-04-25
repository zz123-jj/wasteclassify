import * as ort from 'onnxruntime-web';
import wasmModule from 'onnxruntime-web/ort-wasm-simd-threaded.mjs?url';
import wasmBinary from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';

export const MODEL_URL = '/models/waste-yolo.onnx';
export const MODEL_NOT_FOUND_MESSAGE =
  'Model file not found. Please place your YOLO ONNX model at public/models/waste-yolo.onnx';

function configureOnnxRuntime() {
  // Keeping WebAssembly single-threaded avoids extra cross-origin isolation
  // headers, which keeps this first version easy to deploy on static hosting.
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.wasmPaths = {
    mjs: wasmModule,
    wasm: wasmBinary,
  };
}

function throwModelNotFound() {
  const error = new Error(MODEL_NOT_FOUND_MESSAGE);
  error.code = 'MODEL_NOT_FOUND';
  throw error;
}

async function loadModelBytes() {
  const response = await fetch(MODEL_URL, {
    cache: 'no-store',
  });
  const contentType = response.headers.get('content-type') || '';

  if (!response.ok || contentType.includes('text/html')) {
    throwModelNotFound();
  }

  return new Uint8Array(await response.arrayBuffer());
}

export async function createYoloDetector() {
  configureOnnxRuntime();
  const modelBytes = await loadModelBytes();

  const session = await ort.InferenceSession.create(modelBytes, {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all',
  });
  const inputName = session.inputNames[0];
  const outputName = session.outputNames[0];

  return {
    inputName,
    outputName,
    async dispose() {
      if (typeof session.release === 'function') {
        await session.release();
      }
    },
    async run(inputTensor) {
      const results = await session.run({ [inputName]: inputTensor });
      return results[outputName] || results[Object.keys(results)[0]];
    },
  };
}
