import { getWasteSuggestion } from '../utils/labels.js';

function ResultPanel({
  cameraStatus,
  confidenceThreshold,
  detections,
  modelStatus,
  onConfidenceThresholdChange,
}) {
  return (
    <section className="panel" aria-label="Detection results">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Live results</p>
          <h2>Detection Result Panel</h2>
        </div>
        <span className={`small-status ${cameraStatus.active ? 'online' : ''}`}>
          {cameraStatus.active ? 'Camera on' : 'Camera off'}
        </span>
      </div>

      <div className="setting-row">
        <label htmlFor="confidenceThreshold">
          Confidence threshold
          <strong>{Math.round(confidenceThreshold * 100)}%</strong>
        </label>
        <input
          id="confidenceThreshold"
          max="0.9"
          min="0.1"
          step="0.05"
          type="range"
          value={confidenceThreshold}
          onChange={(event) => onConfidenceThresholdChange(Number(event.target.value))}
        />
      </div>

      <div className={`model-message ${modelStatus.state}`}>
        <span>Model status</span>
        <p>{modelStatus.message}</p>
      </div>

      <div className="detections-list">
        {detections.length ? (
          detections.map((detection) => (
            <article className="detection-item" key={detection.id}>
              <div>
                <h3>{detection.label}</h3>
                <p>{getWasteSuggestion(detection.className)}</p>
              </div>
              <span>{Math.round(detection.confidence * 100)}%</span>
            </article>
          ))
        ) : (
          <div className="empty-state">
            <h3>No waste detected yet</h3>
            <p>Start the camera and place one object clearly in view.</p>
          </div>
        )}
      </div>
    </section>
  );
}

export default ResultPanel;
