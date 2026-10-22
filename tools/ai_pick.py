"""挑要寫白話介紹的物種：出題池裡有維基百科條目（fetch_wiki.py）的，寫成 CACHE/build/ai_src.jsonl 給寫作與查核用。
每行：{id, zh, sci, alt, ord_zh, folk, fam_zh, wiki（導言）, url}
用法：python tools/ai_pick.py（先跑 normalize.py）
      python tools/ai_pick.py --merge CACHE/build/ai  把寫好的各批 {編號: 白話} 合進 data/ai_plain.json，出處網址自動帶入
"""
import argparse
import json
import sys
from pathlib import Path

from common import CACHE, RAW, ROOT

ORD = {o["id"]: o for o in json.loads((ROOT / "data" / "orders.json").read_text("utf-8"))["orders"]}


def merge(folder):
    path = ROOT / "data" / "ai_plain.json"
    data = json.loads(path.read_text("utf-8")) if path.exists() else {}
    for f in sorted(Path(folder).glob("*.json")):
        for k, text in json.loads(f.read_text("utf-8")).items():
            w = json.loads((RAW / "wiki" / f"{k}.json").read_text("utf-8"))["page"]
            data[k] = {"text": text, "src": w["url"]}
    path.write_text(json.dumps(dict(sorted(data.items(), key=lambda x: int(x[0]))), ensure_ascii=False, indent=1) + "\n", "utf-8")
    print(f"data/ai_plain.json：{len(data)} 種")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--merge")
    a = ap.parse_args()
    if a.merge:
        return merge(a.merge)
    out = []
    for line in open(CACHE / "build" / "species.jsonl", encoding="utf-8"):
        r = json.loads(line)
        p = RAW / "wiki" / f"{r['id']}.json"
        if not r["pool"] or r["kind"] != "insect" or not p.exists():
            continue
        w = json.loads(p.read_text("utf-8"))["page"]
        if not w:
            continue
        o = ORD.get(r["ord"], {})
        out.append({"id": r["id"], "zh": r["zh"], "sci": r["sci"], "alt": r["alt"], "ord_zh": o.get("zh"), "folk": o.get("folk"),
                    "fam_zh": r["fam_zh"], "wiki": w["text"][:900], "url": w["url"], "rank": r["rank"]})
    out.sort(key=lambda x: x["rank"] or 9e9)
    with open(CACHE / "build" / "ai_src.jsonl", "w", encoding="utf-8") as f:
        for x in out:
            f.write(json.dumps(x, ensure_ascii=False) + "\n")
    print(f"要寫白話介紹的物種 {len(out)} 種 → build/ai_src.jsonl")


if __name__ == "__main__":
    sys.exit(main())
