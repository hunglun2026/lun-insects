"""簡體字判斷（tools/normalize.py 與 scripts/check-simplified.py 共用）。
用 zhconv 逐字轉成繁體，跟原字不同、而且不在台灣用的 Big5 字集裡，才算簡體字（不手寫字表，避免誤列兩岸共用字；
只靠 zhconv 會把岩、游、泄、祕、污、凶、苧…這些繁體本來就合法的一簡對多繁字誤報）。需要：pip install zhconv"""
from zhconv import convert

ALWAYS_OK = set("准划占栗虱郁台里后干范")  # 核准、划算、占用、苗栗、虱目魚、濃郁、台、里、后、干、范


def in_big5(ch: str) -> bool:
    try:
        ch.encode("cp950")
        return True
    except UnicodeEncodeError:
        return False


def bad_chars(text: str) -> dict:
    out = {}
    for ch in set(text or ""):
        if ord(ch) > 0x2E80 and ch not in ALWAYS_OK and convert(ch, "zh-tw") != ch and not in_big5(ch):
            out[ch] = convert(ch, "zh-tw")
    return out


def to_tw(text):
    """只把簡體字逐字換成繁體，其他字不動（iNaturalist 沒有台灣名時會給中國大陸的名稱）。"""
    if not text:
        return text
    bad = bad_chars(text)
    return "".join(bad.get(c, c) for c in text)
