const TOKEN_KEY = "researchai_token";
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(`/api${path}`, { ...options, headers });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && token) {
    setToken(null);
    window.dispatchEvent(new Event("auth-expired"));
  }
  if (!r.ok) throw new Error(typeof data.detail === "string" ? data.detail : `Request failed (${r.status})`);
  return data;
}

export const getJson = (path) => request(path);
export const deleteJson = (path) => request(path, { method: "DELETE" });
export const postJson = (path, body) =>
  request(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
export function uploadFile(path, file) {
  const fd = new FormData();
  fd.append("file", file);
  return request(path, { method: "POST", body: fd });
}

export function saveFile(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
