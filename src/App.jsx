import { useMemo, useState } from 'react';
import CameraView from './components/CameraView.jsx';
import ResultPanel from './components/ResultPanel.jsx';
import WasteGuide from './components/WasteGuide.jsx';
import { SpeedInsights } from '@vercel/speed-insights/react';

const INITIAL_MODEL_STATUS = {
  state: 'loading',
  message: 'Checking for /models/waste-yolo.onnx...',
};

function App() {
  const [detections, setDetections] = useState([]);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.35);
  const [modelStatus, setModelStatus] = useState(INITIAL_MODEL_STATUS);
  const [cameraStatus, setCameraStatus] = useState({
    active: false,
    message: 'Camera is stopped.',
  });

  const topStatus = useMemo(() => {
    if (modelStatus.state === 'ready') {
      return { tone: 'success', text: modelStatus.message };
    }

    if (modelStatus.state === 'error' || modelStatus.state === 'missing') {
      return { tone: 'warning', text: modelStatus.message };
    }

    return { tone: 'neutral', text: modelStatus.message };
  }, [modelStatus]);

  return (
    <>
      <main className="app-shell">
        <section className="hero">
          <div>
            <p className="eyebrow">Browser-based YOLO demo</p>
            <h1>AI Waste Classification</h1>
            <p className="hero-copy">
              Detect common waste categories locally from a laptop webcam or phone camera.
            </p>
          </div>
          <div className={`status-pill ${topStatus.tone}`}>{topStatus.text}</div>
        </section>

        <section className="main-grid">
          <CameraView
            confidenceThreshold={confidenceThreshold}
            onCameraStatusChange={setCameraStatus}
            onDetectionsChange={setDetections}
            onModelStatusChange={setModelStatus}
          />

          <aside className="side-stack">
            <ResultPanel
              cameraStatus={cameraStatus}
              confidenceThreshold={confidenceThreshold}
              detections={detections}
              modelStatus={modelStatus}
              onConfidenceThresholdChange={setConfidenceThreshold}
            />
            <WasteGuide />
          </aside>
        </section>
      </main>
      <SpeedInsights />
    </>
  );
}

export default App;
