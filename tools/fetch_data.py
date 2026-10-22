"""下載清單類原始資料到 CACHE/raw/：
- specimens.json：林試所昆蟲標本館（data.gov.tw 7278），API 一次最多 1 萬筆，用 $skip 翻頁
- meta.json：各政府資料集的 modifiedDate（每月檢查拿它當基準）
- inat_insects.json：iNaturalist 台灣「研究級」昆蟲物種清單（含觀察筆數）
- inat_others.json：不是昆蟲的節肢動物（蜘蛛、蜈蚣、馬陸…），給「是不是昆蟲」出題
- inat_insects.json 裡另外補上「少的目」（石蛾、蜉蝣、竹節蟲…）各前 EXTRA_N 種，標 extra=true：
  這些目在台灣被拍得少，排不進觀察筆數前 1000 名，不補的話高中分類闖關會缺這些目
用法：python tools/fetch_data.py [--force]（不加 --force 時，已下載的清單不重抓）
"""
import argparse
import json
import sys

from common import RAW, ROOT, get_json

SPECIMEN_URL = "https://data.moa.gov.tw/Service/OpenData/FromM/InsectMuseumData.aspx?IsTransData=1&UnitId=030"
DATASETS = {"7278": "昆蟲標本館資料"}
INAT = "https://api.inaturalist.org/v1"
TAIWAN = 7887
EXTRA_N, EXTRA_MIN = 10, 8  # 前 1000 名裡少於 EXTRA_MIN 種的目，補抓前 EXTRA_N 種
INSECTA = 47158
# 非昆蟲：蛛形綱、唇足綱（蜈蚣）、倍足綱（馬陸）、等足目（鼠婦）
OTHERS = {"Arachnida": 47119, "Chilopoda": 49556, "Diplopoda": 47735, "Isopoda": 48147}


def save(name, data):
    (RAW / name).write_text(json.dumps(data, ensure_ascii=False), "utf-8")
    print(f"  {name}：{len(data)} 筆")


def species_counts(taxon_id, limit=None):
    out, page = [], 1
    while True:
        d = get_json(f"{INAT}/observations/species_counts", {
            "place_id": TAIWAN, "taxon_id": taxon_id, "quality_grade": "research",
            "per_page": 500, "page": page, "locale": "zh-TW"}, min_gap=1.1)
        out += [{"count": r["count"], **r["taxon"]} for r in d["results"]]
        if not d["results"] or len(out) >= d["total_results"] or (limit and len(out) >= limit):
            return out[:limit] if limit else out
        page += 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()
    RAW.mkdir(parents=True, exist_ok=True)

    print("== 政府資料集更新日期")
    meta = {}
    for did, title in DATASETS.items():
        r = get_json(f"https://data.gov.tw/api/v2/rest/dataset/{did}")["result"]
        meta[did] = {"title": r["title"], "modified": r["modifiedDate"]}
    old = json.loads((RAW / "meta.json").read_text("utf-8")) if (RAW / "meta.json").exists() else {}
    changed = a.force or not (RAW / "specimens.json").exists() or old.get("7278", {}).get("modified") != meta["7278"]["modified"]

    if changed:
        print("== 昆蟲標本館（7278）")
        rows, skip = [], 0
        while True:
            part = get_json(SPECIMEN_URL, {"$top": 10000, "$skip": skip})
            rows += part
            print(f"  {skip}：{len(part)} 筆", flush=True)
            if len(part) < 10000:
                break
            skip += len(part)
        if len(rows) < 100000:
            raise SystemExit(f"[失敗] 標本只抓到 {len(rows)} 筆，跟上次（約 14.8 萬）差太多，不覆蓋")
        save("specimens.json", rows)
    else:
        print("== 昆蟲標本館沒有更新，略過")
    (RAW / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), "utf-8")

    if a.force or not (RAW / "inat_insects.json").exists():
        print("== iNaturalist 台灣昆蟲物種")
        save("inat_insects.json", species_counts(INSECTA))
    ins = json.loads((RAW / "inat_insects.json").read_text("utf-8"))
    if not any(t.get("extra") for t in ins):
        print("== 少的目補抓")
        top = sorted(ins, key=lambda t: -t["count"])[:1000]
        anc = {t["id"]: t for t in json.loads((RAW / "inat_ancestors.json").read_text("utf-8"))} if (RAW / "inat_ancestors.json").exists() else {}
        orders = [o["id"] for o in json.loads((ROOT / "data" / "orders.json").read_text("utf-8"))["orders"] if o["lv"]]
        have = {o: sum(1 for t in top if any(anc.get(x, {}).get("name") == o for x in t.get("ancestor_ids", []))) for o in orders}
        ids = {t["id"] for t in top}
        for o in [o for o, n in have.items() if n < EXTRA_MIN]:
            tx = next(r for r in get_json(f"{INAT}/taxa", {"q": o, "rank": "order", "per_page": 5}, min_gap=1.1)["results"] if r["name"] == o)
            got = [t for t in species_counts(tx["id"], limit=EXTRA_N) if t["id"] not in ids]
            for t in got:
                t["extra"] = True
                for x in ins:  # 已在清單裡（排名 1000 以外）就只標記，不重複加
                    if x["id"] == t["id"]:
                        x["extra"] = True
                        break
                else:
                    ins.append(t)
            print(f"  {o}：前 1000 名有 {have[o]} 種，補 {len(got)} 種", flush=True)
        save("inat_insects.json", ins)
    if a.force or not (RAW / "inat_others.json").exists():
        print("== iNaturalist 台灣非昆蟲節肢動物")
        others = []
        for name, tid in OTHERS.items():
            for t in species_counts(tid, limit=30):
                others.append({**t, "group": name})
        save("inat_others.json", others)


if __name__ == "__main__":
    sys.exit(main())
