"""離線測試：目名對照、學名判斷、採集地點與縣市換算、簡體字轉換、照片挑選、搜尋切詞。"""
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
from normalize import binomial, order_id, pick_photos, place  # noqa: E402
from tokens import index_tokens, query_tokens  # noqa: E402
from zh import bad_chars, to_tw  # noqa: E402


class Names(unittest.TestCase):
    def test_order_id(self):
        self.assertEqual(order_id("LEPIDOPTERA"), "Lepidoptera")
        self.assertEqual(order_id("HOMOPTERA"), "Hemiptera")   # 舊的同翅目已併入半翅目
        self.assertEqual(order_id("Psocoptera"), "Psocodea")
        self.assertIsNone(order_id("Araneae"))                  # 蜘蛛不是昆蟲的目
        self.assertIsNone(order_id(None))

    def test_binomial(self):
        self.assertEqual(binomial("Vespa velutina "), "Vespa velutina")
        self.assertEqual(binomial("Anorthoa munda plumbeata"), "Anorthoa munda")
        self.assertEqual(binomial("Loepa formosensis&nbsp;&nbsp;"), "Loepa formosensis")
        for s in ("LEPIDOPTERA sp. ", "Vespa sp.", "Scopula sp6", "Arctiidae Arctiidae", "", None):
            self.assertIsNone(binomial(s), s)


class Places(unittest.TestCase):
    def test_taiwan_county_now(self):
        self.assertEqual(place("TAIWAN Hualien Co. Ci'en【台灣 花蓮縣 慈恩】"), ("台灣", "花蓮縣", "慈恩"))
        self.assertEqual(place("TAIWAN Taipei Hsien【台灣 台北縣 烏來】"), ("台灣", "新北市", "烏來"))  # 2010 年升格
        self.assertEqual(place("【台灣 高雄縣 藤枝】"), ("台灣", "高雄市", "藤枝"))
        self.assertEqual(place("【台灣 未知】"), ("台灣", None, "未知"))

    def test_abroad_and_missing(self):
        self.assertEqual(place("MALAYSIA Sarawak【馬來西亞 沙勞越】"), ("馬來西亞", None, "沙勞越"))
        self.assertEqual(place("TAIWAN Nantou"), ("台灣", None, "TAIWAN Nantou"))
        self.assertEqual(place(None)[0], "未知")


class Chinese(unittest.TestCase):
    def test_to_tw(self):
        self.assertEqual(to_tw("黄脚胡蜂"), "黃腳胡蜂")
        self.assertEqual(to_tw("台灣特有種"), "台灣特有種")  # 「台」在白名單，不換成「臺」
        self.assertEqual(bad_chars("岩游泄"), {})          # 一簡對多繁但繁體合法的字不算錯


class Photos(unittest.TestCase):
    def test_pick_photos(self):
        ph = [{"id": i, "obs": o, "license": "cc-by", "by": "x", "stage": st}
              for i, o, st in [(1, 10, "Larva"), (2, 10, None), (3, 11, None), (4, 11, None), (5, 12, "Adult")]]
        got = pick_photos(ph, 3)
        self.assertEqual([p["k"] for p in got], [2, 3, 5])  # 每筆觀察一張、成蟲或沒標的優先
        self.assertEqual(len({p["obs"] for p in got}), 3)


class Tokens(unittest.TestCase):
    def test_shared_cases(self):
        for c in json.loads((Path(__file__).parent / "tokens.json").read_text("utf-8")):
            self.assertEqual(query_tokens(c["q"]), c["query"], c["q"])

    def test_index_covers_query(self):
        # 建索引的詞一定要包含查詢的詞，否則查不到
        idx = set(index_tokens("黃腳虎頭蜂 Vespa velutina 宜蘭縣 福山").split())
        for q in ("虎頭蜂", "福山", "vespa", "宜蘭"):
            self.assertTrue(set(query_tokens(q)) <= idx, q)


if __name__ == "__main__":
    unittest.main()
