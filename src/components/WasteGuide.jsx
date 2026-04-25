import { GUIDE_ITEMS } from '../utils/labels.js';

function WasteGuide() {
  return (
    <section className="panel" aria-label="Waste category guide">
      <div className="panel-heading compact">
        <div>
          <p className="eyebrow">Reference</p>
          <h2>Waste Category Guide</h2>
        </div>
      </div>

      <div className="guide-grid">
        {GUIDE_ITEMS.map((item) => (
          <article className="guide-item" key={item.className}>
            <span className="guide-dot" style={{ backgroundColor: item.color }} />
            <div>
              <h3>{item.label}</h3>
              <p>{item.suggestion}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default WasteGuide;
