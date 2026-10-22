"""逐種向 iNaturalist 抓：台灣的可商用授權照片（CC0／CC BY／CC BY-SA）、每月觀察筆數、上層分類。
存在 CACHE/raw/inat/<taxon_id>.json，已抓過的跳過，可中斷續跑。
對象：台灣觀察筆數前 TOP 名的昆蟲＋全部非昆蟲（inat_others.json）。
用法：python tools/fetch_inat.py [--top 1000]
對方回應一次要 2～4 秒，所以 3 個執行緒同時抓；送出間隔仍由 common.get_json 統一控制在 1.1 秒以上。
"""
import argparse
import json
import sys
from concurrent.futures import ThreadPoolExecutor

from common import RAW, cached, get_json, read

INAT = "https://api.inaturalist.org/v1"
TAIWAN = 7887
LICENSES = "cc0,cc-by,cc-by-sa"  # 鴻綸科技網域，不收「非商業」授權
GAP = 1.1  # iNaturalist 請求間隔（秒）


def photos_for(tid):
    """研究級觀察裡，照片授權可商用的前 8 筆（按讚數排序，通常是拍得最好的）。"""
    d = get_json(f"{INAT}/observations", {
        "taxon_id": tid, "place_id": TAIWAN, "quality_grade": "research", "photo_license": LICENSES,
        "per_page": 8, "order_by": "votes", "locale": "zh-TW"}, min_gap=GAP)
    out = []
    for o in d["results"]:
        stages = [a.get("controlled_value", {}).get("label") for a in o.get("annotations", [])
                  if a.get("controlled_attribute", {}).get("label") == "Life Stage"]
        for p in o.get("photos", []):
            if p.get("license_code") in ("cc0", "cc-by", "cc-by-sa"):
                out.append({"id": p["id"], "obs": o["id"], "license": p["license_code"], "by": p.get("attribution", ""),
                            "url": p["url"].replace("square.", "medium."), "stage": stages[0] if stages else None,
                            "taxon": o["taxon"]["id"]})
    return out


def months_for(tid):
    d = get_json(f"{INAT}/observations/histogram", {
        "taxon_id": tid, "place_id": TAIWAN, "quality_grade": "research", "interval": "month_of_year",
        "date_field": "observed"}, min_gap=GAP)
    m = d["results"]["month_of_year"]
    return [m.get(str(i), 0) for i in range(1, 13)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--top", type=int, default=1000)
    a = ap.parse_args()
    all_ins = sorted(read("inat_insects.json"), key=lambda t: -t["count"])
    insects = all_ins[: a.top] + [t for t in all_ins[a.top:] if t.get("extra")]  # 少的目補抓的也要
    targets = insects + read("inat_others.json")
    print(f"對象 {len(targets)} 種", flush=True)
    def one(t):
        tid = t["id"]
        cached(RAW / "inat" / f"{tid}.json", lambda: {"photos": photos_for(tid), "months": months_for(tid)})

    with ThreadPoolExecutor(3) as ex:
        for i, _ in enumerate(ex.map(one, targets), 1):
            if i % 50 == 0:
                print(f"  {i}／{len(targets)}", flush=True)

    # 上層分類（目、科…）的中文名：把還沒查過的祖先編號一次 30 個查回來，跟舊的合併（新增物種時不必全部重查）
    path = RAW / "inat_ancestors.json"
    taxa = read("inat_ancestors.json") if path.exists() else []
    known = {t["id"] for t in taxa}
    ids = sorted({x for t in targets for x in t.get("ancestor_ids", []) if x != t["id"] and x not in known})
    for i in range(0, len(ids), 30):
        for r in get_json(f"{INAT}/taxa/{','.join(map(str, ids[i:i + 30]))}", {"locale": "zh-TW", "per_page": 30}, min_gap=GAP)["results"]:
            taxa.append({"id": r["id"], "rank": r["rank"], "name": r["name"], "zh": r.get("preferred_common_name")})
    if ids:
        path.write_text(json.dumps(taxa, ensure_ascii=False), "utf-8")
    print(f"完成：{len(targets)} 種、上層分類 {len(taxa)} 個")


if __name__ == "__main__":
    sys.exit(main())
