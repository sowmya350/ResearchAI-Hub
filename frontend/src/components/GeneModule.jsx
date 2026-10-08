import { useState } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { uploadFile, saveFile } from "../api";
import { COLORS, HeatGrid, ConfusionMatrix, Stat } from "./Charts";

export function GeneResults({ res }) {
  const s = res.summary;
  const cls = (c) => COLORS[s.classes.indexOf(c) % COLORS.length];
  const hm = res.heatmap;
  const matrix = hm.genes.map((_, gi) => hm.values.map((row) => row[gi]));
  const pie = s.classes.map((c) => ({ name: c, value: s.class_counts[c] }));

  function downloadCsv() {
    const rows = ["sample,actual,predicted,confidence",
      ...res.predictions.map((p) => `${p.sample},${p.actual},${p.predicted},${p.confidence}`)];
    saveFile("gene_predictions.csv", rows.join("\n"), "text/csv");
  }

  return (
    <>
      <div className="card">
        <div className="stats">
          <Stat value={s.samples} label="Samples" />
          <Stat value={s.genes} label="Genes" />
          <Stat value={`${(s.cv_accuracy * 100).toFixed(1)}%`} label={`${s.cv_folds}-fold CV accuracy`} />
          <Stat value={s.significant_genes} label="Significant genes (FDR<0.05, |log2FC|≥1)" />
        </div>
        <p style={{ marginBottom: 0 }}>Classes: {s.classes.join(" vs ")}{s.log2_transformed && " · raw counts were log2-transformed"}</p>
      </div>

      <div className="card row">
        <div>
          <h3>PCA of samples</h3>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart>
              <CartesianGrid /><XAxis dataKey="pc1" name="PC1" type="number" /><YAxis dataKey="pc2" name="PC2" type="number" />
              <Tooltip /><Legend />
              {s.classes.map((c) => <Scatter key={c} name={c} data={res.pca.filter((p) => p.label === c)} fill={cls(c)} />)}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <div>
          <h3>Volcano plot</h3>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart>
              <CartesianGrid /><XAxis dataKey="log2fc" name="log2FC" type="number" />
              <YAxis dataKey="nlogp" name="-log10 p" type="number" />
              <Tooltip /><Scatter data={res.volcano} fill="#7c3aed" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h3>Heat-map: top 15 differentially expressed genes × samples</h3>
        <p className="muted">Coloured strip on top = class ({s.classes.map((c, i) => `${c}: ${["blue", "red"][i]}`).join(", ")}). Red = high expression, blue = low.</p>
        <HeatGrid rowLabels={hm.genes} colLabels={hm.samples.map((x) => x.id)} matrix={matrix}
          cellW={Math.max(6, Math.min(14, 760 / hm.samples.length))} cellH={20}
          colColors={hm.samples.map((x) => cls(x.label))} />
      </div>

      <div className="card row">
        <div>
          <h3>Top genes by model importance</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={res.top_importance} layout="vertical" margin={{ left: 30 }}>
              <CartesianGrid /><XAxis type="number" /><YAxis dataKey="gene" type="category" width={80} />
              <Tooltip /><Bar dataKey="importance" fill="#059669" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div>
          <h3>log2 fold change of top genes</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={res.top_de_genes} layout="vertical" margin={{ left: 30 }}>
              <CartesianGrid /><XAxis type="number" /><YAxis dataKey="gene" type="category" width={80} />
              <Tooltip />
              <Bar dataKey="log2fc">
                {res.top_de_genes.map((g, i) => <Cell key={i} fill={g.log2fc >= 0 ? "#dc2626" : "#2563eb"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="muted">Red = higher in {s.classes[1]}, blue = lower.</p>
        </div>
      </div>

      <div className="card">
        <h3>Mean expression by class (top genes)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={res.mean_expression}>
            <CartesianGrid /><XAxis dataKey="gene" /><YAxis /><Tooltip /><Legend />
            {s.classes.map((c) => <Bar key={c} dataKey={c} fill={cls(c)} />)}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card row">
        <div>
          <h3>Class distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pie} dataKey="value" nameKey="name" outerRadius={80} label>
                {pie.map((d, i) => <Cell key={i} fill={cls(d.name)} />)}
              </Pie>
              <Tooltip /><Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div>
          <h3>Confusion matrix (cross-validated)</h3>
          <ConfusionMatrix labels={res.confusion.labels} matrix={res.confusion.matrix} />
        </div>
        <div>
          <h3>Prediction confidence</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={res.confidence_hist}>
              <CartesianGrid /><XAxis dataKey="range" /><YAxis allowDecimals={false} />
              <Tooltip /><Bar dataKey="count" fill="#0891b2" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card row">
        <div>
          <h3>Top differentially expressed genes</h3>
          <table>
            <thead><tr><th>Gene</th><th>log2FC</th><th>p</th><th>FDR</th></tr></thead>
            <tbody>
              {res.top_de_genes.map((g) => (
                <tr key={g.gene}><td>{g.gene}</td><td>{g.log2fc}</td>
                  <td>{g.pvalue.toExponential(1)}</td><td>{g.fdr.toExponential(1)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h3>Predictions (first 12)</h3>
          <table>
            <thead><tr><th>Sample</th><th>Actual</th><th>Predicted</th><th>Conf.</th></tr></thead>
            <tbody>
              {res.predictions.slice(0, 12).map((p) => (
                <tr key={p.sample}><td>{p.sample}</td><td>{p.actual}</td><td>{p.predicted}</td><td>{(p.confidence * 100).toFixed(0)}%</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <button className="btn" onClick={downloadCsv}>Download predictions (CSV)</button>
        <button className="btn secondary" onClick={() => saveFile("gene_results.json", JSON.stringify(res, null, 2), "application/json")}>Download full results (JSON)</button>
        <span className="muted"> Results are also saved automatically in History.</span>
      </div>
    </>
  );
}

export default function GeneModule() {
  const [file, setFile] = useState(null);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true); setErr(""); setRes(null);
    try { setRes(await uploadFile("/gene/analyze", file)); }
    catch (e) { setErr(e.message); }
    setBusy(false);
  }

  return (
    <>
      <div className="card">
        <h3>🧬 Gene Expression Analysis (Cancer Diagnosis)</h3>
        <p>Upload a CSV: rows = samples, columns = genes, plus a <code>label</code> column with 2 classes (e.g. Normal / Cancer).</p>
        <input type="file" accept=".csv" onChange={(e) => { setFile(e.target.files[0]); setRes(null); setErr(""); }} />
        <p><button className="btn" disabled={!file || busy} onClick={run}>{busy ? "Analysing…" : "Run analysis"}</button></p>
        {err && <div className="error">{err}</div>}
      </div>
      {res && <GeneResults res={res} />}
    </>
  );
}
