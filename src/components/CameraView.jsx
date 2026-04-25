import { useCallback, useEffect, useRef, useState } from 'react';
import DetectionCanvas from './DetectionCanvas.jsx';
import { MODEL_INPUT_SIZE, captureFrameToTensor } from '../utils/preprocess.js';
import { postprocessYoloOutput } from '../utils/postprocess.js';
import { MODEL_NOT_FOUND_MESSAGE, createYoloDetector } from '../utils/yolo.js';

const DETECTION_INTERVAL_MS = 300;

function getFriendlyCameraError(error) {
  if (!error) {
    return 'Unable to access the camera.';
  }

  if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
    return 'Camera permission was denied. Allow camera access in your browser settings and try again.';
  }

  if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
    return 'No camera was found on this device.';
  }

  if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
    return 'The camera is already in use by another app or browser tab.';
  }

  if (error.name === 'OverconstrainedError') {
    return 'The requested camera settings are not available on this device.';
  }

  return `Camera error: ${error.message || error.name}`;
}

function CameraView({
  confidenceThreshold,
  onCameraStatusChange,
  onDetectionsChange,
  onModelStatusChange,
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const detectorRef = useRef(null);
  const streamRef = useRef(null);
  const isRunningInferenceRef = useRef(false);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [displayDetections, setDisplayDetections] = useState([]);

  useEffect(() => {
    let isMounted = true;

    async function loadModel() {
      onModelStatusChange({
        state: 'loading',
        message: 'Loading YOLO model...',
      });

      try {
        const detector = await createYoloDetector();

        if (!isMounted) {
          await detector.dispose();
          return;
        }

        detectorRef.current = detector;
        onModelStatusChange({
          state: 'ready',
          message: 'YOLO model loaded. Ready for local inference.',
        });
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const isMissingModel = error.code === 'MODEL_NOT_FOUND';
        detectorRef.current = null;
        onModelStatusChange({
          state: isMissingModel ? 'missing' : 'error',
          message: isMissingModel ? MODEL_NOT_FOUND_MESSAGE : error.message,
        });
      }
    }

    loadModel();

    return () => {
      isMounted = false;
      const detector = detectorRef.current;
      detectorRef.current = null;
      detector?.dispose().catch(() => undefined);
    };
  }, [onModelStatusChange]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }

    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsCameraActive(false);
    setCameraError('');
    setDisplayDetections([]);
    onDetectionsChange([]);
    onCameraStatusChange({
      active: false,
      message: 'Camera is stopped.',
    });
  }, [onCameraStatusChange, onDetectionsChange]);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      const message = 'This browser does not support navigator.mediaDevices.getUserMedia().';
      setCameraError(message);
      onCameraStatusChange({ active: false, message });
      return;
    }

    setCameraError('');
    onCameraStatusChange({
      active: false,
      message: 'Requesting camera permission...',
    });

    const preferredConstraints = {
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    };

    try {
      let stream;

      try {
        stream = await navigator.mediaDevices.getUserMedia(preferredConstraints);
      } catch (error) {
        // A few browsers/devices do not understand the environment camera hint.
        // Falling back keeps laptop webcams and older mobile browsers usable.
        if (error.name !== 'OverconstrainedError') {
          throw error;
        }

        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: true,
        });
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsCameraActive(true);
      onCameraStatusChange({
        active: true,
        message: 'Camera is running.',
      });
    } catch (error) {
      const message = getFriendlyCameraError(error);
      setCameraError(message);
      onCameraStatusChange({ active: false, message });
    }
  }, [onCameraStatusChange]);

  useEffect(() => stopCamera, [stopCamera]);

  useEffect(() => {
    if (!isCameraActive || !detectorRef.current) {
      return undefined;
    }

    const intervalId = window.setInterval(async () => {
      const video = videoRef.current;

      if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        return;
      }

      if (isRunningInferenceRef.current) {
        return;
      }

      isRunningInferenceRef.current = true;

      try {
        const { tensor, metadata } = captureFrameToTensor(video, MODEL_INPUT_SIZE);
        const outputTensor = await detectorRef.current.run(tensor);
        const nextDetections = postprocessYoloOutput(outputTensor, {
          confidenceThreshold,
          inputSize: MODEL_INPUT_SIZE,
          metadata,
        });

        setDisplayDetections(nextDetections);
        onDetectionsChange(nextDetections);
      } catch (error) {
        onModelStatusChange({
          state: 'error',
          message: `Inference failed: ${error.message}`,
        });
      } finally {
        isRunningInferenceRef.current = false;
      }
    }, DETECTION_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [confidenceThreshold, isCameraActive, onDetectionsChange, onModelStatusChange]);

  return (
    <section className="camera-card" aria-label="Camera classifier">
      <div className="camera-toolbar">
        <button
          className="button primary"
          disabled={isCameraActive}
          type="button"
          onClick={startCamera}
        >
          Start Camera
        </button>
        <button
          className="button secondary"
          disabled={!isCameraActive}
          type="button"
          onClick={stopCamera}
        >
          Stop Camera
        </button>
      </div>

      {cameraError ? <p className="inline-error">{cameraError}</p> : null}

      <div className="camera-stage">
        <video
          ref={videoRef}
          aria-label="Live camera preview"
          className="camera-video"
          muted
          playsInline
        />
        {!isCameraActive ? (
          <div className="camera-placeholder" aria-hidden="true">
            <span>Camera preview</span>
          </div>
        ) : null}
        <DetectionCanvas
          canvasRef={canvasRef}
          detections={displayDetections}
          videoRef={videoRef}
        />
      </div>
    </section>
  );
}

export default CameraView;
