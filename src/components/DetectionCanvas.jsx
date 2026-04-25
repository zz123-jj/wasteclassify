import { useEffect } from 'react';

function getObjectFitContainRect(canvasWidth, canvasHeight, video) {
  const videoWidth = video.videoWidth || canvasWidth;
  const videoHeight = video.videoHeight || canvasHeight;
  const canvasRatio = canvasWidth / canvasHeight;
  const videoRatio = videoWidth / videoHeight;

  if (canvasRatio > videoRatio) {
    const height = canvasHeight;
    const width = height * videoRatio;
    return {
      x: (canvasWidth - width) / 2,
      y: 0,
      width,
      height,
    };
  }

  const width = canvasWidth;
  const height = width / videoRatio;
  return {
    x: 0,
    y: (canvasHeight - height) / 2,
    width,
    height,
  };
}

function drawDetection(ctx, detection, videoRect, video) {
  const videoWidth = video.videoWidth || 1;
  const videoHeight = video.videoHeight || 1;
  const x = videoRect.x + (detection.box.x / videoWidth) * videoRect.width;
  const y = videoRect.y + (detection.box.y / videoHeight) * videoRect.height;
  const width = (detection.box.width / videoWidth) * videoRect.width;
  const height = (detection.box.height / videoHeight) * videoRect.height;
  const label = `${detection.label} ${Math.round(detection.confidence * 100)}%`;

  ctx.lineWidth = Math.max(2, videoRect.width / 320);
  ctx.strokeStyle = detection.color;
  ctx.fillStyle = detection.color;
  ctx.strokeRect(x, y, width, height);

  ctx.font = '600 14px Inter, system-ui, sans-serif';
  const textMetrics = ctx.measureText(label);
  const labelWidth = textMetrics.width + 14;
  const labelHeight = 26;
  const labelY = y - labelHeight > 0 ? y - labelHeight : y;

  ctx.fillRect(x, labelY, labelWidth, labelHeight);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(label, x + 7, labelY + 18);
}

function DetectionCanvas({ canvasRef, detections, videoRef }) {
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;

    if (!canvas || !video) {
      return undefined;
    }

    function paint() {
      const rect = canvas.getBoundingClientRect();
      const deviceScale = window.devicePixelRatio || 1;
      const nextWidth = Math.round(rect.width * deviceScale);
      const nextHeight = Math.round(rect.height * deviceScale);

      if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
        canvas.width = nextWidth;
        canvas.height = nextHeight;
      }

      const ctx = canvas.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);

      if (!detections.length || !video.videoWidth || !video.videoHeight) {
        return;
      }

      const videoRect = getObjectFitContainRect(rect.width, rect.height, video);
      detections.forEach((detection) => drawDetection(ctx, detection, videoRect, video));
    }

    paint();
    window.addEventListener('resize', paint);

    return () => window.removeEventListener('resize', paint);
  }, [canvasRef, detections, videoRef]);

  return <canvas ref={canvasRef} aria-hidden="true" className="detection-canvas" />;
}

export default DetectionCanvas;
