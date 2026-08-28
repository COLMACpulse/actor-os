
from pathlib import Path
import hashlib, json, sys, html

root = Path(sys.argv[1] if len(sys.argv)>1 else ".")
receipts=list(root.rglob("*.master.json"))
rows=[]
for rp in receipts:
    try:
        meta=json.loads(rp.read_text(encoding="utf-8"))
    except Exception as e:
        rows.append({"receipt":str(rp),"status":"FAIL","reason":"invalid JSON"})
        continue
    mp=Path(meta.get("masterPath",""))
    if not mp.exists():
        # Try receipt sibling matching stem if path is device-local and we're verifying copied evidence.
        candidates=[p for p in rp.parent.iterdir() if p.is_file() and p.suffix.lower() in (".mov",".mp4") and p.stem==rp.name.replace(".master.json","")]
        mp=candidates[0] if candidates else mp
    if not mp.exists():
        rows.append({"receipt":str(rp),"status":"FAIL","reason":"master missing","expectedHash":meta.get("sha256")})
        continue
    h=hashlib.sha256()
    with mp.open("rb") as f:
        for chunk in iter(lambda:f.read(1024*1024),b""): h.update(chunk)
    actual=h.hexdigest(); expected=meta.get("sha256")
    rows.append({"receipt":str(rp),"master":str(mp),"status":"PASS" if actual==expected else "FAIL","expectedHash":expected,"actualHash":actual,"bytes":mp.stat().st_size})
out={"root":str(root.resolve()),"masters":rows,"overall":"PASS" if rows and all(r["status"]=="PASS" for r in rows) else "FAIL"}
Path("post_relaunch_verification.json").write_text(json.dumps(out,indent=2),encoding="utf-8")
trs="".join(f"<tr><td>{html.escape(r.get('master',''))}</td><td>{r['status']}</td><td><code>{html.escape(str(r.get('actualHash','')))}</code></td></tr>" for r in rows)
Path("GAUNTLET_REPORT.html").write_text(f"""<!doctype html><meta charset=utf-8><title>Actor OS Gauntlet Report</title><style>body{{font:14px system-ui;max-width:1000px;margin:30px auto}}table{{width:100%;border-collapse:collapse}}td,th{{border:1px solid #ccc;padding:8px}}code{{font-size:11px}}</style><h1>ACTOR OS — Post-Relaunch Hash Verification</h1><p>Overall: <b>{out['overall']}</b></p><table><tr><th>Master</th><th>Status</th><th>Actual SHA-256</th></tr>{trs}</table>""",encoding="utf-8")
print(json.dumps(out,indent=2))
