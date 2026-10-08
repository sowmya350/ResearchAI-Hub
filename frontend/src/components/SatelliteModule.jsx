import { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { uploadFile, saveFile } from "../api";
import { COLORS, Stat } from "./Charts";

export function SatelliteResults({ res, preview }) {
  const probs = res.all_probs.map((p) => ({ label: p.label, pct: +(p.prob * 100).toFixed(1) }));
  const rgb = [
    { ch: "Red", v: res.mean_rgb[0], c: "#dc2626" },
    { ch: "Green", v: res.mean_rgb[1], c: "#16a34a" },
    { ch: "Blue", v: res.mean_rgb[2], c: "#2563eb" },
  ];
  return (
    <>
      <div className="card row">
        <div>
          {preview && <img className="preview" src={preview} alt="uploaded" />}
          <h2 style={{ marginBottom: 4 }}>{res.label}</h2>
          <p style={{ marginTop: 0 }}>Confidence: <b>{(res.confidence * 100).toFixed(1)}%</b></p>
          {res.mode === "demo" && <div className="note">{res.note}</div>}
          <div className="stats" style={{ marginTop: 12 }}>
            <Stat value={res.vegetation_index} label="Excess Green index (vegetation)" />
            <Stat value={`${res.image_size[0]}×${res.image_size[1]}`} label="Image size" />
          </div>
          <p><button className="btn secondary" onClick={() => saveFile("satellite_result.json", JSON.stringify(res, null, 2), "application/json")}>Download result (JSON)</button></p>
        </div>
        <div>
          <h3>All class probabilities</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={probs} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid /><XAxis type="number" unit="%" domain={[0, 100]} />
              <YAxis dataKey="label" type="category" width={140} />
              <Tooltip /><Bar dataKey="pct" fill="#0891b2" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="card row">
        <div>
          <h3>RGB colour histogram</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={res.rgb_hist}>
              <CartesianGrid /><XAxis dataKey="bin" /><YAxis unit="%" /><Tooltip /><Legend />
              <Line dataKey="r" name="Red" stroke="#dc2626" dot={false} />
              <Line dataKey="g" name="Green" stroke="#16a34a" dot={false} />
              <Line dataKey="b" name="Blue" stroke="#2563eb" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div>
          <h3>Average colour per channel</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={rgb}>
              <CartesianGrid /><XAxis dataKey="ch" /><YAxis domain={[0, 255]} /><Tooltip />
              <Bar dataKey="v">{rgb.map((d, i) => <Cell key={i} fill={d.c} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}

export default function SatelliteModule() {
  const [files, setFiles] = useState([]);
  const [items, setItems] = useState([]);
  const [sel, setSel] = useState(0);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    const out = [];
    for (const f of files) {
      const preview = URL.createObjectURL(f);
      try { out.push({ name: f.name, preview, res: await uploadFile("/satellite/predict", f) }); }
      catch (e) { out.push({ name: f.name, preview, error: e.message }); }
      setItems([...out]);
    }
    setSel(0);
    setBusy(false);
  }

  const ok = items.filter((i) => i.res);
  const dist = Object.entries(ok.reduce((a, i) => ({ ...a, [i.res.label]: (a[i.res.label] || 0) + 1 }), {}))
    .map(([name, value]) => ({ name, value }));
  const current = items[sel];

  return (
    <>
      <div className="card">
        <h3>🛰️ Satellite Image Analysis (Land-Cover Classification)</h3>
        <p>Upload one or more satellite image tiles (JPG/PNG). The model predicts one of 10 EuroSAT land-cover classes.</p>
        <input type="file" accept="image/*" multiple onChange={(e) => { setFiles(Array.from(e.target.files)); setItems([]); }} />
        <p><button className="btn" disabled={!files.length || busy} onClick={run}>{busy ? "Classifying…" : `Classify ${files.length || ""} image${files.length === 1 ? "" : "s"}`}</button></p>
      </div>

      {items.length > 1 && (
        <div className="card row">
          <div>
            <h3>Batch summary: predicted classes</h3>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={dist} dataKey="value" nameKey="name" outerRadius={85} label>
                  {dist.map((d, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div>
            <h3>Images (click a row to see details)</h3>
            <table>
              <thead><tr><th>File</th><th>Prediction</th><th>Conf.</th></tr></thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} className={i === sel ? "sel" : "clickable"} onClick={() => setSel(i)}>
                    <td>{it.name}</td>
                    <td>{it.res ? it.res.label : <span style={{ color: "#991b1b" }}>{it.error}</span>}</td>
                    <td>{it.res ? `${(it.res.confidence * 100).toFixed(0)}%` : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {current && current.res && <SatelliteResults res={current.res} preview={current.preview} />}
      {current && current.error && <div className="card"><div className="error">{current.name}: {current.error}</div></div>}
    </>
  );
}
