"""白話介紹的依據：中文維基百科條目的導言（台灣正體）。先用學名查，查不到再用 TaiCOL 中文名查。
為了不抓錯條目，導言裡一定要出現這個物種的學名（屬＋種小名）才收。
對象：台灣觀察筆數前 TOP 名的昆蟲。存 CACHE/raw/wiki/<iNat 編號>.json，可續跑。
維基百科內容是 CC BY-SA 4.0，改寫後的白話介紹也照這個授權標示。
用法：python tools/fetch_wiki.py [--top 300]
"""
import argparse
import json
import re
import sys

from common import RAW, cached, get_json, read

API = "https://zh.wikipedia.org/w/api.php"


def extract(title):
    d = get_json(API, {"action": "query", "prop": "extracts|info", "inprop": "url", "exintro": 1, "explaintext": 1, "redirects": 1,
                       "titles": title, "variant": "zh-tw", "format": "json"}, min_gap=0.5)
    pg = next(iter(d["query"]["pages"].values()))
    return {"title": pg.get("title"), "url": pg.get("fullurl"), "text": (pg.get("extract") or "").strip()} if "missing" not in pg else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--top", type=int, default=300)
    a = ap.parse_args()
    ins = sorted(read("inat_insects.json"), key=lambda t: -t["count"])[: a.top]
    ok = 0
    for t in ins:
        def fetch():
            tc = RAW / "taicol" / f"{t['name'].replace(' ', '_')}.json"
            zh = (json.loads(tc.read_text("utf-8"))["taxon"] or {}).get("common_name_c") if tc.exists() else None
            for title in filter(None, [t["name"], zh]):
                r = extract(title)
                # 導言要出現學名才算對的條目（同名、屬的條目都排除）
                if r and len(r["text"]) >= 40 and re.search(re.escape(t["name"]), r["text"], re.I):
                    return r
            return None
        r = cached(RAW / "wiki" / f"{t['id']}.json", lambda: {"page": fetch()})
        ok += bool(r["page"])
    print(f"完成：{len(ins)} 種，找到條目 {ok} 種")


if __name__ == "__main__":
    sys.exit(main())
