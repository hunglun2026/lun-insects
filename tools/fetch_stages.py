"""變態排排站用的成長階段照片：向 iNaturalist 查同一種昆蟲在台灣被標成「卵、幼蟲、蛹、若蟲、成蟲」的可商用授權照片。
對象：完全變態的目取觀察筆數前 FULL 名、不完全變態取前 HALF 名（越常見越有機會各階段都有人拍）。
存 CACHE/raw/stages/<taxon_id>.json，可續跑。用法：python tools/fetch_stages.py
"""
import json
import sys
from concurrent.futures import ThreadPoolExecutor

from common import RAW, ROOT, cached, get_json, read

INAT = "https://api.inaturalist.org/v1"
FULL, HALF = 260, 90
# iNaturalist controlled_terms：Life Stage（term_id=1）的值
STAGE = {"Egg": 7, "Larva": 6, "Pupa": 4, "Nymph": 5, "Adult": 2}
NEED = {"full": ["Larva", "Pupa", "Adult", "Egg"], "half": ["Nymph", "Adult", "Egg"]}


def first_photo(tid, stage):
    d = get_json(f"{INAT}/observations", {
        "taxon_id": tid, "place_id": 7887, "quality_grade": "research", "photo_license": "cc0,cc-by,cc-by-sa",
        "term_id": 1, "term_value_id": STAGE[stage], "per_page": 3, "order_by": "votes"}, min_gap=1.1)
    for o in d["results"]:
        for p in o.get("photos", []):
            if p.get("license_code") in ("cc0", "cc-by", "cc-by-sa"):
                return {"k": p["id"], "by": p.get("attribution", ""), "lic": p["license_code"], "obs": o["id"]}
    return None


def main():
    meta = {o["id"]: o["meta"] for o in json.loads((ROOT / "data" / "orders.json").read_text("utf-8"))["orders"]}
    anc = {t["id"]: t for t in read("inat_ancestors.json")}
    picked = {"full": [], "half": []}
    for t in sorted(read("inat_insects.json"), key=lambda t: -t["count"]):
        o = next((anc[a]["name"] for a in t.get("ancestor_ids", []) if a in anc and anc[a]["rank"] == "order"), None)
        m = meta.get(o)
        if m in picked and len(picked[m]) < (FULL if m == "full" else HALF):
            picked[m].append(t["id"])
    todo = [(tid, m) for m in picked for tid in picked[m]]
    print(f"查 {len(todo)} 種", flush=True)
    def one(job):
        tid, m = job
        def fetch():
            out = {}
            # 必要階段缺一個就不用再查後面的（省請求）：幼蟲與蛹，或若蟲
            for st in NEED[m]:
                out[st] = first_photo(tid, st)
                if st != "Egg" and st != "Adult" and not out[st]:
                    break
            return {"meta": m, "stages": {k: v for k, v in out.items() if v}}
        r = cached(RAW / "stages" / f"{tid}.json", fetch)
        need = ["Larva", "Pupa", "Adult"] if m == "full" else ["Nymph", "Adult"]
        return all(s in r["stages"] for s in need)

    ok = 0
    with ThreadPoolExecutor(3) as ex:
        for i, got in enumerate(ex.map(one, todo), 1):
            ok += got
            if i % 50 == 0:
                print(f"  {i}／{len(todo)}，湊齊 {ok} 種", flush=True)
    print(f"完成：{len(todo)} 種，各階段湊齊 {ok} 種")


if __name__ == "__main__":
    sys.exit(main())
