import { useEffect, useState } from "react";
import { getJson, getToken, setToken } from "./api";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import GeneModule from "./components/GeneModule";
import SatelliteModule from "./components/SatelliteModule";
import ExplorerModule from "./components/ExplorerModule";
import History from "./components/History";

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(!!getToken());
  const [page, setPage] = useState("dashboard");

  useEffect(() => {
    if (getToken()) {
      getJson("/auth/me").then(setUser).catch(() => setToken(null)).finally(() => setChecking(false));
    }
    const expired = () => setUser(null);
    window.addEventListener("auth-expired", expired);
    return () => window.removeEventListener("auth-expired", expired);
  }, []);

  function onLogin(token, u) {
    setToken(token);
    setUser(u);
    setPage("dashboard");
  }
  function logout() {
    setToken(null);
    setUser(null);
  }

  if (checking) return <p style={{ padding: 40 }}>Loading…</p>;
  if (!user) return <Login onLogin={onLogin} />;

  const pages = {
    dashboard: <Dashboard user={user} go={setPage} />,
    gene: <GeneModule />,
    satellite: <SatelliteModule />,
    explorer: <ExplorerModule />,
    history: <History />,
  };

  return (
    <>
      <header>
        <div>
          <h1>ResearchAI Hub</h1>
          <p>Cloud-based research tools: Biology &amp; Geoscience</p>
        </div>
        <nav>
          <button className={page === "dashboard" ? "on" : ""} onClick={() => setPage("dashboard")}>🏠 Modules</button>
          <button className={page === "history" ? "on" : ""} onClick={() => setPage("history")}>🕘 History</button>
          <span className="who">👤 {user.username}</span>
          <button onClick={logout}>Logout</button>
        </nav>
      </header>
      <main>{pages[page]}</main>
    </>
  );
}
