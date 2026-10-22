"""把原始資料整理成兩份：CACHE/build/species.jsonl（物種，遊戲與小百科用）、specimens.jsonl（林試所標本）。

物種：iNaturalist 台灣研究級觀察（照片、每月筆數）＋ TaiCOL（中文名、別名、特有、保育、紅皮書、科名）。
  出題池 pool＝有中文名、有可商用照片、目在 data/orders.json 裡。難度 lv 依台灣觀察筆數：
  前 LV_E 名國小、前 LV_J 名國中，其餘高中（越常見的越簡單）。
標本：7278 原始欄位＋整理出的學名、目、縣市（舊縣名換成現在的）、年份，並連到物種。
用法：python tools/normalize.py
"""
import json
import re
import sys
from collections import Counter

from common import CACHE, RAW, ROOT, read
from zh import to_tw

LV_E, LV_J = 200, 700
ORD = json.loads((ROOT / "data" / "orders.json").read_text("utf-8"))
ORDERS = {o["id"]: o for o in ORD["orders"]}
ALIAS = ORD["alias"]
# iNat 與 TaiCOL 學名不同時，指定用哪個 TaiCOL 學名（data/name_fix.json，每筆都查證過）
NAME_FIX = {int(k): v["taicol"] for k, v in json.loads((ROOT / "data" / "name_fix.json").read_text("utf-8")).items() if not k.startswith("_")}
CJK = re.compile(r"[㐀-鿿]")
# 2010 年縣市合併升格後的名稱；標本館地點寫的是採集當時的縣名
COUNTY_NOW = {"台北縣": "新北市", "桃園縣": "桃園市", "台中縣": "台中市", "台南縣": "台南市", "高雄縣": "高雄市",
              "花蓮市": "花蓮縣", "苗栗市": "苗栗縣", "臺北市": "台北市", "臺中市": "台中市", "臺南市": "台南市", "臺東縣": "台東縣"}
COUNTIES = ["基隆市", "台北市", "新北市", "桃園市", "新竹縣", "新竹市", "苗栗縣", "台中市", "彰化縣", "南投縣", "雲林縣", "嘉義縣",
            "嘉義市", "台南市", "高雄市", "屏東縣", "宜蘭縣", "花蓮縣", "台東縣", "澎湖縣", "金門縣", "連江縣"]
EN_COUNTRY = {"TAIWAN": "台灣", "CHINA": "中國", "JAPAN": "日本", "MALAYSIA": "馬來西亞", "USA": "美國", "THAILAND": "泰國"}


def order_id(name):
    """學名（任何大小寫、舊目名）→ orders.json 的鍵；不是昆蟲的目回 None。"""
    if not name:
        return None
    n = name.strip().capitalize()
    n = ALIAS.get(n, n)
    return n if n in ORDERS else None


def clean(s):
    return re.sub(r"&nbsp;|\s+", " ", s or "").strip()


def binomial(s):
    w = clean(s).split()
    if len(w) < 2 or not re.fullmatch(r"[A-Z][a-z]+", w[0]) or not re.fullmatch(r"[a-z][a-z-]+", w[1]) or w[1] in ("sp", "spp"):
        return None
    return f"{w[0]} {w[1]}"


def taicol(name):
    """TaiCOL 紀錄；種的層級沒中文名但查到台灣亞種的（fetch_taicol.py 的 sub），中文名與別名用亞種的。"""
    p = RAW / "taicol" / f"{name.replace(' ', '_')}.json"
    if not p.exists():
        return None
    d = json.loads(p.read_text("utf-8"))
    t = d["taxon"]
    if t and not t.get("common_name_c") and d.get("sub"):
        t = {**t, "common_name_c": d["sub"]["common_name_c"], "alternative_name_c": d["sub"]["alternative_name_c"] or t.get("alternative_name_c")}
    return t


def higher(tc, rank):
    """TaiCOL 上層分類：回傳 (學名, 中文名)。"""
    for h in (tc or {}).get("higher_taxa") or []:
        if h["rank"] == rank:
            return h["simple_name"], h.get("common_name_c")
    return None, None


def zh_name(tc, inat_zh):
    """中文名：TaiCOL 的正式中文名優先，沒有才用 iNaturalist 的（要真的是中文，iNat 沒中文時會給英文）。"""
    for v in ((tc or {}).get("common_name_c"), inat_zh):
        v = (v or "").split(",")[0].strip()
        if v and CJK.search(v):
            return to_tw(v)
    return None


def alt_names(tc, zh):
    out = []
    for v in ((tc or {}).get("alternative_name_c") or "").split(","):
        v = to_tw(v.strip())
        if v and v != zh and CJK.search(v) and v not in out:
            out.append(v)
    return out[:6]


def pick_photos(photos, n=4):
    """最多 n 張，盡量來自不同觀察；第一張當主照片，優先成蟲或沒標成長階段的。"""
    photos = sorted(photos, key=lambda p: p["stage"] not in (None, "Adult"))
    out, obs = [], set()
    for p in photos:
        if p["obs"] in obs:
            continue
        obs.add(p["obs"])
        out.append({"k": p["id"], "by": p["by"], "lic": p["license"], "obs": p["obs"]})
        if len(out) == n:
            break
    return out


def stages_of(tid):
    """成長階段照片（fetch_stages.py）：完全變態要有幼蟲、蛹、成蟲，不完全變態要有若蟲、成蟲，湊不齊就不給（不出排排站題）。"""
    p = RAW / "stages" / f"{tid}.json"
    if not p.exists():
        return None
    d = json.loads(p.read_text("utf-8"))
    need = ["Larva", "Pupa", "Adult"] if d["meta"] == "full" else ["Nymph", "Adult"]
    st = d["stages"]
    if not all(s in st for s in need):
        return None
    return {k: {"k": v["k"], "by": v["by"], "lic": v["lic"]} for k, v in st.items()}


def species():
    anc = {t["id"]: t for t in read("inat_ancestors.json")} if (RAW / "inat_ancestors.json").exists() else {}
    rows = []
    for kind, src in (("insect", read("inat_insects.json")), ("other", read("inat_others.json"))):
        for t in src:
            p = RAW / "inat" / f"{t['id']}.json"
            if not p.exists():
                continue
            d = json.loads(p.read_text("utf-8"))
            tc = taicol(NAME_FIX.get(t["id"], t["name"])) if len(t["name"].split()) >= 2 else None
            ranks = {anc[a]["rank"]: anc[a] for a in t.get("ancestor_ids", []) if a in anc}
            o = ranks.get("order", {})
            f = ranks.get("family", {})
            ordk = order_id(o.get("name")) if kind == "insect" else None
            # 科：iNaturalist 的科名為準；中文用 TaiCOL（同一個科才用），沒有再用 iNat 的中文
            fam_sci, fam_zh = higher(tc, "Family")
            fam = f.get("name") or fam_sci
            famzh = fam_zh if fam_sci == fam else None
            if not famzh and f.get("zh") and CJK.search(f["zh"]):
                famzh = to_tw(f["zh"])
            zh = zh_name(tc, t.get("preferred_common_name"))
            photos = pick_photos(d["photos"])
            stages = stages_of(t["id"])
            rows.append({
                "id": t["id"], "kind": kind, "grp": t.get("group"), "sci": t["name"], "zh": zh, "alt": alt_names(tc, zh),
                "ord": ordk, "ord_sci": o.get("name"), "fam": fam, "fam_zh": famzh,
                "genus": t["name"].split()[0],
                "endemic": 1 if (tc or {}).get("is_endemic") else 0, "alien": (tc or {}).get("alien_type"),
                "prot": (tc or {}).get("protected"), "red": (tc or {}).get("redlist"),
                "taicol": (tc or {}).get("taxon_id"), "obs": t["count"], "months": d["months"],
                "photos": photos, "img": photos[0]["k"] if photos else None, "stages": stages,
                "pool": 1 if zh and photos and (ordk or kind == "other") else 0,
            })
    # 難度：出題池裡依觀察筆數排名（非昆蟲另外排，給「是不是昆蟲」用，一律國小起）
    ins = sorted((r for r in rows if r["pool"] and r["kind"] == "insect"), key=lambda r: -r["obs"])
    for i, r in enumerate(ins):
        r["rank"] = i + 1
        r["lv"] = "e" if i < LV_E else "j" if i < LV_J else "s"
    for r in rows:
        r.setdefault("rank", None)
        r.setdefault("lv", "e" if r["pool"] else None)
    return rows


def place(raw):
    """「TAIWAN Hualien Co. Ci'en【台灣 花蓮縣 慈恩】」→（國家, 縣市, 其餘地點）。縣市只整理台灣的。"""
    m = re.search(r"【(.*?)】", raw or "")
    if not m:
        en = (raw or "").split()
        return EN_COUNTRY.get(en[0].upper(), "未知") if en else "未知", None, clean(raw) or None
    z = m.group(1).split()
    country = z[0] if z else "未知"
    county = None
    rest = z[1:]
    if country == "台灣" and rest:
        c = COUNTY_NOW.get(rest[0], rest[0])
        if c in COUNTIES:
            county, rest = c, rest[1:]
    return country, county, " ".join(rest) or None


def specimens(sp_rows):
    by_sci = {r["sci"]: r for r in sp_rows if r["kind"] == "insect"}
    by_tc = {r["taicol"]: r for r in sp_rows if r["taicol"] and r["kind"] == "insect"}
    out, seen = [], set()
    for x in read("specimens.json"):
        no = (x.get("館號") or "").strip()
        if not no or no in seen:
            continue
        seen.add(no)
        raw = clean(x.get("種名"))
        w = raw.split()
        sci = binomial(raw)
        tc = taicol(sci) if sci else (taicol(w[0]) if w and re.fullmatch(r"[A-Z][a-z]+", w[0]) else None)
        ordk = order_id(w[0]) if w and w[0].isupper() else order_id(higher(tc, "Order")[0])
        sp = (by_tc.get(tc["taxon_id"]) if sci and tc else None) or (by_sci.get(sci) if sci else None)
        country, county, rest = place(x.get("採集地點"))
        t = x.get("採集時間") or ""
        year = int(t[:4]) if re.match(r"(1[89]|20)\d\d", t) else None
        out.append({
            "no": no, "raw": raw or None, "sci": sci, "ord": ordk,
            "fam": higher(tc, "Family")[0] if tc else (w[0] if w and w[0].endswith("idae") else None),
            "zh": (sp["zh"] if sp else None) or (zh_name(tc, None) if sci else None),
            "sp": sp["id"] if sp and sp["pool"] else None,
            "country": country, "county": county, "place": rest,
            "who": (x.get("採集者") or "").strip() or None, "year": year, "date": t[:10] or None,
            "ident": (x.get("鑑定者") or "").strip() or None,
        })
    return out


def main():
    out = CACHE / "build"
    out.mkdir(parents=True, exist_ok=True)
    sp = species()
    spec = specimens(sp)
    cnt = Counter(s["sp"] for s in spec if s["sp"])
    for r in sp:
        r["spec"] = cnt.get(r["id"], 0)
    for name, rows in (("species", sp), ("specimens", spec)):
        with open(out / f"{name}.jsonl", "w", encoding="utf-8") as f:
            for r in rows:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
    pool = [r for r in sp if r["pool"]]
    print(f"物種 {len(sp)}，出題池 {len(pool)}（昆蟲 {sum(r['kind'] == 'insect' for r in pool)}、非昆蟲 {sum(r['kind'] == 'other' for r in pool)}）")
    print("  難度：", Counter(r["lv"] for r in pool if r["kind"] == "insect"))
    print("  各目：", Counter(r["ord"] for r in pool if r["kind"] == "insect").most_common())
    print("  沒進池的原因：沒中文名", sum(1 for r in sp if not r["zh"]), "、沒照片", sum(1 for r in sp if not r["photos"]),
          "、目不在表內", sum(1 for r in sp if r["kind"] == "insect" and not r["ord"]))
    print(f"標本 {len(spec)}：有目 {sum(1 for s in spec if s['ord'])}、有中文名 {sum(1 for s in spec if s['zh'])}、"
          f"連到出題池物種 {sum(1 for s in spec if s['sp'])}、台灣有縣市 {sum(1 for s in spec if s['county'])}")
    print("  標本目：", Counter(s["ord"] for s in spec).most_common(8))


if __name__ == "__main__":
    sys.exit(main())
