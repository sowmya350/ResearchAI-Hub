"""SQLite storage: users + saved analyses (history)."""
import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone

DB_PATH = os.environ.get("RESEARCHAI_DB") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "researchai.db")


@contextmanager
def db():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    try:
        yield c
        c.commit()
    finally:
        c.close()


def init_db():
    with db() as c:
        c.execute("""CREATE TABLE IF NOT EXISTS users(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL)""")
        c.execute("""CREATE TABLE IF NOT EXISTS analyses(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            module TEXT NOT NULL,
            filename TEXT,
            summary TEXT,
            result_json TEXT NOT NULL,
            created_at TEXT NOT NULL)""")


def _now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def create_user(username, password_hash):
    try:
        with db() as c:
            cur = c.execute("INSERT INTO users(username,password_hash,created_at) VALUES(?,?,?)",
                            (username, password_hash, _now()))
            return cur.lastrowid
    except sqlite3.IntegrityError:
        return None


def get_user(username):
    with db() as c:
        r = c.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()
        return dict(r) if r else None


def get_user_by_id(uid):
    with db() as c:
        r = c.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
        return dict(r) if r else None


def save_analysis(user_id, module, filename, summary, result):
    with db() as c:
        cur = c.execute(
            "INSERT INTO analyses(user_id,module,filename,summary,result_json,created_at) VALUES(?,?,?,?,?,?)",
            (user_id, module, filename, summary, json.dumps(result), _now()))
        return cur.lastrowid


def list_analyses(user_id):
    with db() as c:
        rows = c.execute("SELECT id,module,filename,summary,created_at FROM analyses "
                         "WHERE user_id=? ORDER BY id DESC LIMIT 200", (user_id,)).fetchall()
        return [dict(r) for r in rows]


def get_analysis(user_id, aid):
    with db() as c:
        r = c.execute("SELECT * FROM analyses WHERE id=? AND user_id=?", (aid, user_id)).fetchone()
        if not r:
            return None
        d = dict(r)
        d["result"] = json.loads(d.pop("result_json"))
        return d


def delete_analysis(user_id, aid):
    with db() as c:
        return c.execute("DELETE FROM analyses WHERE id=? AND user_id=?", (aid, user_id)).rowcount > 0
