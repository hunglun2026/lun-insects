"""產生匯入 D1 的 SQL：CACHE/build/import_<species|specimens>.sql。

做法：依 migrations/0001_init.sql 建 *_new 新表 → 寫入 → 最後一段才把舊表刪掉、新表換名。
任何一段失敗，網站仍用舊表（失敗保留舊資料）。
用法：python tools/build_sql.py [--only species|specimens] [--photos CACHE/img/uploaded.txt]   之後 tools/import.sh 上傳
"""
import argparse
import json
import re
import sys

from common import CACHE, ROOT
from tokens import index_tokens

MAX_STMT = 90_000  # D1 單一 SQL 敘述上限 100KB，留點空間


def q(v):
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "1" if v else "0"
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def inserts(table, cols, rows):
    """把多列塞進多個 INSERT，每個敘述不超過 MAX_STMT。"""
    head = f"INSERT INTO {table} ({','.join(cols)}) VALUES "
    buf, size = [], len(head.encode())
    for r in rows:
        v = "(" + ",".join(q(x) for x in r) + ")"
        vb = len(v.encode())  # D1 上限是 100KB「位元組」，中文一字 3 bytes，不能用字數算
        if buf and size + vb + 2 > MAX_STMT:
            yield head + ",".join(buf) + ";"
            buf, size = [], len(head.encode())
        buf.append(v)
        size += vb + 1
    if buf:
        yield head + ",".join(buf) + ";"


def schema_for(t):
    """從 migration 取出表 t 的敘述：(建 t_new 與 t_new_fts 的 CREATE, 原名的 CREATE INDEX)。
    索引在換名「之後」才用原名建：舊索引隨舊表刪掉，不會撞名被 IF NOT EXISTS 安靜跳過。"""
    sql = re.sub(r"--[^\n]*", "", (ROOT / "migrations" / "0001_init.sql").read_text("utf-8"))
    tables, indexes = [], []
    for stmt in (s.strip() for s in sql.split(";")):
        if re.search(rf"TABLE IF NOT EXISTS {t}\b", stmt):
            tables.append(re.sub(rf"\b{t}\b", f"{t}_new", stmt, count=1) + ";")
        elif re.search(rf"TABLE IF NOT EXISTS {t}_fts\b", stmt):
            tables.append(stmt.replace(f"{t}_fts", f"{t}_new_fts", 1) + ";")
        elif re.search(rf"INDEX IF NOT EXISTS \w+ ON {t}\b", stmt):
            indexes.append(stmt + ";")
    return tables, indexes


def rows_of(name):
    with open(CACHE / "build" / f"{name}.jsonl", encoding="utf-8") as f:
        for n, line in enumerate(f, 1):
            yield n, json.loads(line)


SP_COLS = ["n", "id", "kind", "grp", "sci", "zh", "alt", "ord", "fam", "fam_zh", "genus", "endemic", "alien", "prot", "red",
           "taicol", "obs", "rank", "lv", "months", "photos", "stages", "img", "spec", "pool", "photo"]
SPEC_COLS = ["n", "no", "raw", "sci", "zh", "ord", "fam", "sp", "country", "county", "place", "who", "year", "date", "ident"]
J = lambda v: json.dumps(v, ensure_ascii=False, separators=(",", ":")) if v else None  # noqa: E731


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", choices=["species", "specimens"])
    ap.add_argument("--photos", help="已上傳到 R2 的照片編號清單檔（每行一個），標 photo=1")
    a = ap.parse_args()
    photos = set()
    if a.photos:
        photos = set(map(int, open(a.photos, encoding="utf-8").read().split()))
    orders = json.loads((ROOT / "data" / "orders.json").read_text("utf-8"))["orders"]
    src_meta = json.loads((CACHE / "raw" / "meta.json").read_text("utf-8"))
    for t in [a.only] if a.only else ["species", "specimens"]:
        path = CACHE / "build" / f"import_{t}.sql"
        with open(path, "w", encoding="utf-8") as f:
            f.write(f"DROP TABLE IF EXISTS {t}_new_fts;\nDROP TABLE IF EXISTS {t}_new;\n")
            tables, indexes = schema_for(t)
            for s in tables:
                f.write(s + "\n")
            rows, fts = [], []
            if t == "species":
                for n, r in rows_of("species"):
                    rows.append([n, r["id"], r["kind"], r["grp"], r["sci"], r["zh"], "、".join(r["alt"]) or None, r["ord"], r["fam"],
                                 r["fam_zh"], r["genus"], r["endemic"], r["alien"], r["prot"], r["red"], r["taicol"], r["obs"],
                                 r["rank"], r["lv"], J(r["months"]), J(r["photos"]), J(r.get("stages")), r["img"], r["spec"],
                                 r["pool"], r["img"] in photos])
                cols = SP_COLS
            else:
                for n, r in rows_of("specimens"):
                    rows.append([n] + [r[c] for c in SPEC_COLS[1:]])
                    fts.append([n, index_tokens(" ".join(filter(None, [r["raw"], r["zh"], r["fam"], r["county"], r["place"], r["who"], r["country"]])))])
                cols = SPEC_COLS
            for s in inserts(f"{t}_new", cols, rows):
                f.write(s + "\n")
            for s in inserts(f"{t}_new_fts", ["rowid", "tok"], fts):
                f.write(s + "\n")
            # 換名：全部寫完才動舊表
            f.write(f"DROP TABLE IF EXISTS {t}_fts;\nDROP TABLE IF EXISTS {t};\n")
            f.write(f"ALTER TABLE {t}_new RENAME TO {t};\n")
            if fts:
                f.write(f"ALTER TABLE {t}_new_fts RENAME TO {t}_fts;\n")
            for s in indexes:
                f.write(s + "\n")
            f.write(f"INSERT OR REPLACE INTO meta (k, v) VALUES ('{t}_count', '{len(rows)}'), ('{t}_imported_at', datetime('now'));\n")
            # 前端的目名表從 meta 拿（data/orders.json 是唯一來源）
            f.write(f"INSERT OR REPLACE INTO meta (k, v) VALUES ('orders', {q(J(orders))});\n")
            # 每月檢查（src/check.ts）拿這份當基準：data.gov.tw 的 modifiedDate 比它新才通知
            f.write(f"INSERT OR REPLACE INTO meta (k, v) VALUES ('source_modified', {q(json.dumps({k: v['modified'] for k, v in src_meta.items()}))});\n")
        print(f"{t}：{len(rows)} 筆 → {path}（{path.stat().st_size / 1e6:.1f} MB）")


if __name__ == "__main__":
    sys.exit(main())
