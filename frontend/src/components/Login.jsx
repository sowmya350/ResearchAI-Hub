import { useState } from "react";
import { postJson } from "../api";

export default function Login({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    if (mode === "register" && password !== confirm) {
      setErr("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const data = await postJson(`/auth/${mode}`, { username, password });
      onLogin(data.token, data.user);
    } catch (e2) {
      setErr(e2.message);
    }
    setBusy(false);
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>ResearchAI Hub</h1>
        <p className="muted">Cloud-based research tools for Biology &amp; Geoscience</p>
        <div className="tabs">
          <button className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setErr(""); }}>Login</button>
          <button className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setErr(""); }}>Register</button>
        </div>
        <form onSubmit={submit}>
          <label>Username</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required />
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {mode === "register" && (
            <>
              <label>Confirm password</label>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </>
          )}
          <button className="btn wide" disabled={busy}>
            {busy ? "Please wait…" : mode === "login" ? "Login" : "Create account"}
          </button>
        </form>
        {err && <div className="error">{err}</div>}
      </div>
    </div>
  );
}
