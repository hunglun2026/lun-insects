"""tools/ 共用：快取位置、有禮貌的 HTTP 抓取（iNaturalist 要求每秒不超過 1 次、帶自己的 User-Agent）。
快取不放 ClaudeOnly（照片與原始資料不能進備份 git）。"""
import json
import os
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

CACHE = Path(os.environ.get("LUN_INSECTS_CACHE", r"D:\lun-insects-cache"))
ROOT = Path(__file__).resolve().parent.parent
RAW = CACHE / "raw"
UA = "lun-insects/0.1 (K-12 insect education site, insects.hunglun.com; hunglun2026@gmail.com)"

_last = {}
_lock = threading.Lock()  # 多執行緒同時抓時，間隔要一起算


def get_json(url: str, params: dict | None = None, min_gap: float = 0.0, tries: int = 5):
    """GET 一個 JSON。min_gap：同一個主機兩次請求至少隔幾秒。失敗退避重試（2、4、8…秒）。"""
    if params:
        url += ("&" if "?" in url else "?") + urllib.parse.urlencode(params)
    host = urllib.parse.urlparse(url).netloc
    for i in range(tries):
        with _lock:
            at = max(time.time(), _last.get(host, 0) + min_gap)  # 這次排在哪個時間點送出
            _last[host] = at
        if at > time.time():
            time.sleep(at - time.time())
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.loads(r.read().decode("utf-8-sig"))
        except urllib.error.HTTPError as e:
            if e.code != 429 and e.code < 500 or i == tries - 1:  # 4xx 是請求本身有問題，重試也沒用
                raise RuntimeError(f"{url}：{e}") from e
            time.sleep(2 ** (i + 1))
        except Exception as e:  # noqa: BLE001  網路錯誤退避重試
            if i == tries - 1:
                raise RuntimeError(f"{url}：{e}") from e
            time.sleep(2 ** (i + 1))


def cached(path: Path, fetch):
    """有快取檔就讀，沒有才抓並存檔（可中斷續跑）。"""
    if path.exists():
        return json.loads(path.read_text("utf-8"))
    data = fetch()
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False), "utf-8")
    tmp.replace(path)
    return data


def read(name: str):
    return json.loads((RAW / name).read_text("utf-8"))
