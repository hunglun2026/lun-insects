-- 常見昆蟲的白話介紹（AI 依維基百科摘要改寫、逐筆查核過，來源 data/ai_plain.json）。
-- 用 iNaturalist 物種編號對應，不跟 species 一起重建：每月重新匯入時不會洗掉。
CREATE TABLE IF NOT EXISTS ai_plain (
  id INTEGER PRIMARY KEY,
  text TEXT NOT NULL,
  src TEXT                      -- 依據的維基百科條目網址
);
