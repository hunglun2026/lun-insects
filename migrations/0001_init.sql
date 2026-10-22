-- 資料表結構的唯一來源。tools/build_sql.py 讀這份，把 species／specimens 換成 *_new 建新表，
-- 匯入全部成功才換名，失敗時舊資料不動。改欄位要兩邊一起看。

-- 物種（iNaturalist 台灣研究級觀察＋TaiCOL）。n 是整數主鍵
CREATE TABLE IF NOT EXISTS species (
  n INTEGER PRIMARY KEY,
  id INTEGER NOT NULL UNIQUE,   -- iNaturalist 物種編號（網址 /sp#編號 用它）
  kind TEXT NOT NULL,           -- insect 昆蟲／other 不是昆蟲的節肢動物
  grp TEXT,                     -- 非昆蟲的類群（Arachnida…）
  sci TEXT NOT NULL, zh TEXT, alt TEXT,   -- 學名、中文名、別名（以「、」隔開）
  ord TEXT, fam TEXT, fam_zh TEXT, genus TEXT,  -- 目（data/orders.json 的鍵）、科
  endemic INTEGER NOT NULL DEFAULT 0, alien TEXT, prot TEXT, red TEXT, taicol TEXT,
  obs INTEGER NOT NULL DEFAULT 0, rank INTEGER, lv TEXT,  -- 台灣觀察筆數、出題池排名、最早出現的難度
  months TEXT,                  -- 12 個月的觀察筆數（JSON）
  photos TEXT,                  -- [{k 照片編號, by 作者標示, lic 授權, obs 觀察編號}]（JSON）
  stages TEXT,                  -- 成長階段照片 {Egg|Larva|Pupa|Nymph|Adult: {k, by, lic}}（JSON，變態排排站用）
  img INTEGER,                  -- 主照片編號，R2 檔名也用它
  spec INTEGER NOT NULL DEFAULT 0,  -- 林試所標本館的標本數
  pool INTEGER NOT NULL,        -- 1＝出題池（有中文名、有照片、目確定）
  photo INTEGER NOT NULL DEFAULT 0  -- 1＝主照片已上傳到本站 R2
);
CREATE INDEX IF NOT EXISTS species_pool ON species (pool, photo);

-- 林試所昆蟲標本館（data.gov.tw 7278）
CREATE TABLE IF NOT EXISTS specimens (
  n INTEGER PRIMARY KEY,
  no TEXT NOT NULL UNIQUE,      -- 館號
  raw TEXT, sci TEXT, zh TEXT,  -- 原始種名、整理後學名（屬＋種小名）、中文名
  ord TEXT, fam TEXT,
  sp INTEGER,                   -- 對應的物種編號（species.id），有照片可看
  country TEXT, county TEXT, place TEXT,
  who TEXT, year INTEGER, date TEXT, ident TEXT
);
CREATE INDEX IF NOT EXISTS specimens_sp ON specimens (sp);
CREATE INDEX IF NOT EXISTS specimens_ord ON specimens (ord, county);
CREATE INDEX IF NOT EXISTS specimens_county ON specimens (county, year);

-- 搜尋索引：tok 是「單字＋兩字一組」以空白隔開的詞（tools/tokens.py、src/tokens.ts）
CREATE VIRTUAL TABLE IF NOT EXISTS specimens_fts USING fts5(tok, content='', tokenize='unicode61');

-- 匯入紀錄與每月檢查紀錄
CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);
CREATE TABLE IF NOT EXISTS check_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ran_at TEXT NOT NULL, status TEXT NOT NULL, message TEXT
);
