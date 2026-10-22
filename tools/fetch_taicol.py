"""向 TaiCOL（臺灣物種名錄）查中文名、台語等別名、特有／外來、保育等級、紅皮書、上層分類。
對象：fetch_inat.py 的物種＋標本館裡有完整學名的物種。存 CACHE/raw/taicol/<學名>.json，可續跑。
種的層級沒有中文名時（台灣的蝴蝶常把中文名掛在亞種上，例如 Hebomoia glaucippe formosana），
從 TaiCOL 物種網頁找出台灣亞種的學名，再查亞種的中文名，存在同一檔的 "sub"（normalize.py 會優先用它，不用 iNat 的中國大陸名稱）。
用法：python tools/fetch_taicol.py [--top 1000]
"""
import argparse
import json
import re
import sys
import urllib.request

from common import RAW, ROOT, UA, cached, get_json, read

API = "https://api.taicol.tw/v2/taxon"


def clean(s):
    return re.sub(r"&nbsp;|\s+", " ", s or "").strip()


def binomial(s):
    """「Vespa velutina 」「Anorthoa munda plumbeata」→ 屬＋種小名；只到目或屬（sp.、大寫目名）回 None。"""
    w = clean(s).split()
    if len(w) < 2 or not re.fullmatch(r"[A-Z][a-z]+", w[0]) or not re.fullmatch(r"[a-z][a-z-]+", w[1]) or w[1] in ("sp", "spp"):
        return None
    return f"{w[0]} {w[1]}"


def lookup(name):
    d = get_json(API, {"scientific_name": name}, min_gap=0.25)
    rows = d.get("data") or []
    # 同名可能有多筆（有效名與異名），優先取有效名；同名的屬在植物界也可能有，優先動物界
    rows.sort(key=lambda r: (r.get("kingdom") != "Animalia", r.get("taxon_status") != "accepted"))
    return rows[0] if rows else None


def subspecies_name(sci, taxon_id):
    """TaiCOL 物種網頁裡出現的「學名＋亞種名」逐一查，回傳第一個在台灣、有中文名的亞種。"""
    req = urllib.request.Request(f"https://taicol.tw/zh-hant/taxon/{taxon_id}", headers={"User-Agent": UA})
    html = urllib.request.urlopen(req, timeout=60).read().decode("utf-8", "ignore")
    for sub in sorted(set(re.findall(re.escape(sci) + r" ([a-z][a-z-]+)", html))):
        for r in get_json(API, {"scientific_name": f"{sci} {sub}"}, min_gap=0.25).get("data") or []:
            if r.get("common_name_c") and r.get("is_in_taiwan"):
                return {"name": f"{sci} {sub}", "common_name_c": r["common_name_c"], "alternative_name_c": r.get("alternative_name_c")}
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--top", type=int, default=1000)
    a = ap.parse_args()
    all_ins = sorted(read("inat_insects.json"), key=lambda t: -t["count"])
    names = [t["name"] for t in all_ins[: a.top] + [t for t in all_ins[a.top:] if t.get("extra")]]
    names += [t["name"] for t in read("inat_others.json")]
    names += [v["taicol"] for k, v in json.loads((ROOT / "data" / "name_fix.json").read_text("utf-8")).items() if not k.startswith("_")]
    n_inat = len(names)
    names += sorted({b for r in read("specimens.json") if (b := binomial(r.get("種名")))})
    # 標本只鑑定到屬或科的（「Vespa sp.」「Arctiidae」），查屬名、科名拿它的目
    names += sorted({w[0] for r in read("specimens.json") if (w := clean(r.get("種名")).split()) and re.fullmatch(r"[A-Z][a-z]+", w[0])
                     and not binomial(r.get("種名"))})
    names = list(dict.fromkeys(names))
    print(f"查 {len(names)} 個學名", flush=True)
    hit = 0
    for i, n in enumerate(names, 1):
        r = cached(RAW / "taicol" / f"{n.replace(' ', '_')}.json", lambda: {"q": n, "taxon": lookup(n)})
        hit += bool(r["taxon"])
        if i % 200 == 0:
            print(f"  {i}／{len(names)}，查到 {hit}", flush=True)
    print(f"完成：{len(names)} 個，查到 {hit}")
    # 種的層級沒有中文名的，補查台灣亞種（只查出題池候選，也就是 iNat 物種）
    subs = 0
    for n in names[:n_inat]:
        p = RAW / "taicol" / f"{n.replace(' ', '_')}.json"
        d = json.loads(p.read_text("utf-8"))
        t = d["taxon"]
        if not t or t.get("common_name_c") or "sub" in d:
            continue
        d["sub"] = subspecies_name(n, t["taxon_id"])
        p.write_text(json.dumps(d, ensure_ascii=False), "utf-8")
        subs += bool(d["sub"])
    print(f"亞種補中文名：{subs} 種")


if __name__ == "__main__":
    sys.exit(main())
