"""Déploiement ASSOCIA COMPTA sur Vercel via l'API REST.

Le jeton est injecté par le proxy réseau de la session (secret « api.vercel.com »).
Usage : python3 scripts/vercel-deploy.py project | env <projectId> <appUrl> | deploy <projectId> | status <id> | logs <id>
"""
import json, secrets, sys, urllib.request, urllib.error

API = "https://api.vercel.com"
NAME = "associa-compta"

def call(method, path, body=None):
    req = urllib.request.Request(API + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json", "Authorization": "Bearer proxy-injected"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")

step = sys.argv[1]
if step == "project":
    st, p = call("GET", f"/v9/projects/{NAME}")
    if st == 404:
        st, p = call("POST", "/v10/projects", {
            "name": NAME, "framework": "nextjs", "rootDirectory": "apps/web",
            "gitRepository": {"type": "github", "repo": "fglg-cmd/associa-compta"},
        })
    print(st, json.dumps({k: p.get(k) for k in ("id", "name", "rootDirectory", "link", "error")}, default=str)[:600])
elif step == "env":
    pid = sys.argv[2]; app_url = sys.argv[3]
    envs = {
        "NEXT_PUBLIC_SUPABASE_URL": ("https://bnakednfoksziuwxzhxx.supabase.co", "plain"),
        "NEXT_PUBLIC_SUPABASE_ANON_KEY": ("sb_publishable_DW8A8-Lwv3u6Q51lohz-KQ_KBkz2UoM", "plain"),
        "NEXT_PUBLIC_APP_URL": (app_url, "plain"),
        "CRON_SECRET": (secrets.token_urlsafe(32), "encrypted"),
    }
    for k, (v, t) in envs.items():
        st, r = call("POST", f"/v10/projects/{pid}/env?upsert=true", {"key": k, "value": v, "type": t, "target": ["production", "preview"]})
        print(k, st, (r.get("error") or {}).get("message", "ok"))
elif step == "deploy":
    st, d = call("POST", "/v13/deployments", {
        "name": NAME, "project": sys.argv[2], "target": "production",
        "gitSource": {"type": "github", "org": "fglg-cmd", "repo": "associa-compta", "ref": "main"},
    })
    print(st, json.dumps({k: d.get(k) for k in ("id", "url", "readyState", "error")}, default=str)[:600])
elif step == "status":
    st, d = call("GET", f"/v13/deployments/{sys.argv[2]}")
    print(st, d.get("readyState"), d.get("url"), (d.get("errorMessage") or "")[:300])
elif step == "logs":
    st, ev = call("GET", f"/v3/deployments/{sys.argv[2]}/events?limit=-1")
    lines = [e.get("payload", {}).get("text", "") for e in (ev if isinstance(ev, list) else [])]
    print("\n".join(l for l in lines if l)[-4000:])
