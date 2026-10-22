"""把 CACHE/img/600 與 240 的 webp 上傳到線上 R2（POST /admin/img，每批 BATCH 件），主照片上傳成功的物種會被標 photo=1。

已上傳的代號記在 CACHE/img/uploaded.txt，可以中斷續傳、邊抓邊傳。
用法：python tools/upload_images.py [--base https://insects.hunglun.com]
"""
import argparse
import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor

import requests

from common import CACHE, ROOT

BATCH = 100
PARALLEL = 4  # 同時送幾批


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="https://insects.hunglun.com")
    a = ap.parse_args()
    token = json.loads((ROOT / ".prod.secrets").read_text("utf-8"))["ADMIN_TOKEN"]
    done_path = CACHE / "img" / "uploaded.txt"
    done = set(done_path.read_text("utf-8").split()) if done_path.exists() else set()
    keys = sorted(p.stem for p in (CACHE / "img" / "240").glob("*.webp")
                  if p.stem not in done and (CACHE / "img" / "600" / f"{p.stem}.webp").exists())
    print(f"待上傳 {len(keys)} 件（已上傳 {len(done)}）", flush=True)
    sess = requests.Session()
    sess.headers["Authorization"] = f"Bearer {token}"

    def send(part):
        """送一批，回傳 (part, 伺服器回應 dict 或錯誤字串)。失敗退避重試 3 次。"""
        files = []
        for k in part:
            for size in (600, 240):
                files.append((f"{size}/{k}.webp", (f"{k}.webp", (CACHE / "img" / str(size) / f"{k}.webp").read_bytes(), "image/webp")))
        err = ""
        for wait in (0, 10, 30, 90):
            time.sleep(wait)
            try:
                r = sess.post(a.base + "/admin/img", files=files, timeout=180)
                if r.ok:
                    return part, r.json()
                err = f"HTTP {r.status_code} {r.text[:200]}"
            except requests.RequestException as e:
                err = str(e)
        return part, err

    batches = [keys[i: i + BATCH] for i in range(0, len(keys), BATCH)]
    stored = marked = failed = 0
    with ThreadPoolExecutor(PARALLEL) as ex, open(done_path, "a", encoding="utf-8") as log:
        for n, (part, res) in enumerate(ex.map(send, batches), 1):
            if isinstance(res, str) or res["stored"] != len(part):
                failed += 1
                print(f"  [失敗] 一批 {len(part)} 件沒傳成功（{res if isinstance(res, str) else res}），重跑會再傳", flush=True)
                continue
            stored += res["stored"]
            marked += res["marked"]
            log.write("\n".join(part) + "\n")
            log.flush()
            if n % 20 == 0:
                print(f"  已傳 {stored}／{len(keys)}，標記 {marked} 種", flush=True)
    print(f"完成：上傳 {stored} 件，標記 {marked} 種有照片，失敗 {failed} 批")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
