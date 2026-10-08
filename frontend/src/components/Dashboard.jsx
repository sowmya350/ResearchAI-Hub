import { useEffect, useState } from "react";
import { getJson } from "../api";

export const MODULE_NAMES = { gene: "Gene Expression", satellite: "Satellite Image", explorer: "Dataset Explorer" };

const MODULES = [
  { id: "gene", icon: "🧬", title: "Gene Expression Analysis", area: "Biology",
    text: "Upload a gene-expression CSV. Get differential expression, cancer vs normal prediction, PCA, volcano plot and heat-map." },
  { id: "satellite", icon: "🛰️", title: "Satellite Image Analysis", area: "Geoscience",
    text: "Upload satellite images. A PyTorch model predicts the land-cover class with confidence and colour analysis." },
  { id: "explorer", icon: "📊", title: "Dataset Explorer", area: "Other Research Tools",
    text: "Upload any research CSV. Get summary statistics, histograms, correlation heat-map and missing-value report." },
];

export default function Dashboard({ user, go }) {
  const [recent, setRecent] = useState([]);
  useEffect(() => {
    getJson("/history").then((h) => setRecent(h.slice(0, 4))).catch(() => {});
  }, []);

  return (
    <>
      <h2>Welcome, {user.username} 👋</h2>
      <p className="muted">Step 1: select a research module.</p>
      <div className="cards">
        {MODULES.map((m) => (
          <button key={m.id} className="module-card" onClick={() => go(m.id)}>
            <div className="icon">{m.icon}</div>
            <span className="tag">{m.area}</span>
            <h3>{m.title}</h3>
            <p>{m.text}</p>
            <b>Open →</b>
          </button>
        ))}
      </div>
      <div className="card">
        <h3>Recent results</h3>
        {recent.length === 0 ? (
          <p className="muted">No saved results yet. Run an analysis and it will appear here.</p>
        ) : (
          <table>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id}>
                  <td>{MODULE_NAMES[r.module]}</td><td>{r.filename}</td><td>{r.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {recent.length > 0 && <p><button className="btn secondary" onClick={() => go("history")}>View all history</button></p>}
      </div>
    </>
  );
}
