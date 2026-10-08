import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { uploadFile, saveFile } from "../api";
import { COLORS, HeatGrid, Stat } from "./Charts";

export function ExplorerResults({ res }) {
  const s = res.summary;
  const [col, setCol] = useState(res.histograms[0]?.column);
  const hist = res.histograms.find((h) => h.column === col);
  const cor = res.correlation;
  const fmt = (v) => (v === null || v === undefined ? "-" : v);

  return (
    <>
      <div className="card">
        <div className="stats">
          <Stat value={s.rows} label="Rows" />
          <Stat value={s.columns} label="Columns" />
          <Stat value={s.numeric_columns} label="Numeric columns" />
          <Stat value={s.missing_cells} label="Missing cells" />
        </div>
      </div>

      <div className="card">
        <h3>Data preview (first 5 rows)</h3>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead><tr>{Object.keys(res.preview[0] || {}).map((k) => <th key={k}>{k}</th>)}</tr></thead>
            <tbody>
              {res.preview.map((r, i) => <tr key={i}>{Object.values(r).map((v, j) => <td key={j}>{fmt(v)}</td>)}</tr>)}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card row">
        <div>
          <h3>Histogram</h3>
          <select value={col} onChange={(e) => setCol(e.target.value)}>
            {res.histograms.map((h) => <option key={h.column}>{h.column}</option>)}
          </select>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={hist?.bins || []}>
              <CartesianGrid /><XAxis dataKey="bin" /><YAxis allowDecimals={false} />
              <Tooltip /><Bar dataKey="count" fill="#4338ca" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div>
          <h3>Missing values per column</h3>
          {res.missing.length === 0 ? <p className="muted">No missing values 🎉</p> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={res.missing}>
                <CartesianGrid /><XAxis dataKey="column" /><YAxis allowDecimals={false} />
                <Tooltip /><Bar dataKey="missing" fill="#d97706" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="card">
        <h3>Correlation heat-map</h3>
        <p className="muted">Red = positive correlation, blue = negative (−1 to +1).</p>
        <HeatGrid rowLabels={cor.columns} colLabels={cor.columns} matrix={cor.matrix} vmax={1}
          cellW={44} cellH={30} showValues showColLabels />
      </div>

      {res.categories.length > 0 && (
        <div className="card row">
          {res.categories.map((c) => (
            <div key={c.column}>
              <h3>{c.column}</h3>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={c.counts} dataKey="count" nameKey="name" outerRadius={75} label>
                    {c.counts.map((d, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip /><Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h3>Summary statistics</h3>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead><tr><th>Column</th><th>Mean</th><th>Std</th><th>Min</th><th>Median</th><th>Max</th></tr></thead>
            <tbody>
              {res.stats.map((r) => (
                <tr key={r.column}><td>{r.column}</td><td>{fmt(r.mean)}</td><td>{fmt(r.std)}</td><td>{fmt(r.min)}</td><td>{fmt(r.median)}</td><td>{fmt(r.max)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p><button className="btn secondary" onClick={() => saveFile("explorer_results.json", JSON.stringify(res, null, 2), "application/json")}>Download results (JSON)</button></p>
      </div>
    </>
  );
}

export default function ExplorerModule() {
  const [file, setFile] = useState(null);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true); setErr(""); setRes(null);
    try { setRes(await uploadFile("/explorer/analyze", file)); }
    catch (e) { setErr(e.message); }
    setBusy(false);
  }

  return (
    <>
      <div className="card">
        <h3>📊 Dataset Explorer (Other Research Tools)</h3>
        <p>Upload any CSV dataset to get instant statistics and visualisations.</p>
        <input type="file" accept=".csv" onChange={(e) => { setFile(e.target.files[0]); setRes(null); setErr(""); }} />
        <p><button className="btn" disabled={!file || busy} onClick={run}>{busy ? "Analysing…" : "Explore dataset"}</button></p>
        {err && <div className="error">{err}</div>}
      </div>
      {res && <ExplorerResults res={res} />}
    </>
  );
}
