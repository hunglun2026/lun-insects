"""下載物種照片原檔到 CACHE/img/src/<照片編號>.jpg（iNaturalist 開放資料庫 inaturalist-open-data，只有可商用授權的照片在這裡）。
對象：build/species.jsonl 出題池裡每一種的照片（最多 4 張）＋成長階段照片。已下載或已上傳的跳過。
用法：python tools/fetch_images.py
"""
import json
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

from common import CACHE, UA

BASE = "https://inaturalist-open-data.s3.amazonaws.com/photos/{}/large.jpg"  # 長邊 1024，夠轉 600


def keys():
    out = set()
    with open(CACHE / "build" / "species.jsonl", encoding="utf-8") as f:
        for line in f:
            r = json.loads(line)
            if not r["pool"]:
                continue
            out.update(p["k"] for p in r["photos"])
            out.update(s["k"] for s in (r.get("stages") or {}).values())
    return out


def get(k):
    dst = CACHE / "img" / "src" / f"{k}.jpg"
    err = ""
    for wait in (0, 3, 10, 30):
        time.sleep(wait)
        try:
            # 有的照片原檔是 jpeg 副檔名，先試 jpg 再試 jpeg
            for ext in ("jpg", "jpeg", "png"):
                url = BASE.format(k).replace(".jpg", "." + ext)
                try:
                    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60) as r:
                        data = r.read()
                    break
                except urllib.error.HTTPError as e:
                    if e.code != 403 and e.code != 404:
                        raise
                    data = None
            if not data:
                return k, "找不到原檔"
            if len(data) < 2000:
                return k, f"檔案太小（{len(data)} bytes）"
            tmp = dst.with_suffix(".tmp")
            tmp.write_bytes(data)
            tmp.replace(dst)
            return k, ""
        except Exception as e:  # noqa: BLE001
            err = str(e)
    return k, err


def main():
    (CACHE / "img" / "src").mkdir(parents=True, exist_ok=True)
    up = CACHE / "img" / "uploaded.txt"
    done = set(map(int, up.read_text("utf-8").split())) if up.exists() else set()
    todo = sorted(k for k in keys() if k not in done and not (CACHE / "img" / "src" / f"{k}.jpg").exists())
    print(f"待下載 {len(todo)} 張", flush=True)
    bad = 0
    with ThreadPoolExecutor(8) as ex:  # S3 公開資料空間，8 個同時下載沒問題
        for i, (k, err) in enumerate(ex.map(get, todo), 1):
            if err:
                bad += 1
                print(f"  [失敗] {k}：{err}", flush=True)
            if i % 500 == 0:
                print(f"  {i}／{len(todo)}", flush=True)
    print(f"完成，失敗 {bad} 張")
    return 1 if bad > len(todo) * 0.02 else 0


if __name__ == "__main__":
    sys.exit(main())
