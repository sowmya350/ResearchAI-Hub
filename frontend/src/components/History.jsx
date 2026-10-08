import { useEffect, useState } from "react";
import { getJson, deleteJson } from "../api";
import { MODULE_NAMES } from "./Dashboard";
import { GeneResults } from "./GeneModule";
import { SatelliteResults } from "./SatelliteModule";
import { ExplorerResults } from "./ExplorerModule";

export default function History() {
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(null);
  const [err, setErr] = useState("");

  const load = () => getJson("/history").then(setRows).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  async function view(id) {
    setErr("");
    try { setOpen(await getJson(`/history/${id}`)); } catch (e) { setErr(e.message); }
  }
  async function remove(id) {
    if (!window.confirm("Delete this saved result?")) return;
    await deleteJson(`/history/${id}`);
    load();
  }

  if (open) {
    return (
      <>
        <p><button className="btn secondary" onClick={() => setOpen(null)}>← Back to history</button></p>
        <div className="card">
          <h3>{MODULE_NAMES[open.module]}: {open.filename}</h3>
          <p className="muted">{new Date(open.created_at).toLocaleString()} · {open.summary}</p>
        </div>
        {open.module === "gene" && <GeneResults res={open.result} />}
        {open.module === "satellite" && <SatelliteResults res={open.result} />}
        {open.module === "explorer" && <ExplorerResults res={open.result} />}
      </>
    );
  }

  return (
    <div className="card">
      <h3>Saved results</h3>
      {err && <div className="error">{err}</div>}
      {rows === null ? <p>Loading…</p> : rows.length === 0 ? (
        <p className="muted">Nothing saved yet. Every analysis you run is saved here automatically.</p>
      ) : (
        <table>
          <thead><tr><th>Date</th><th>Module</th><th>File</th><th>Summary</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.created_at).toLocaleString()}</td>
                <td>{MODULE_NAMES[r.module]}</td><td>{r.filename}</td><td>{r.summary}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="btn small" onClick={() => view(r.id)}>View</button>
                  <button className="btn small danger" onClick={() => remove(r.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
