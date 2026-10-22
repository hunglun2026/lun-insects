#!/usr/bin/env bash
# 把 CACHE/build/import_<表>.sql 匯入線上 D1，再核對筆數。
# wrangler 出錯時離場碼仍是 0（2026-10-21 實測 SQLITE_TOOBIG），所以看輸出有沒有 ERROR。
# 用法：bash tools/import.sh species|specimens|ai
set -euo pipefail
T="$1"
TABLE="$T"; [ "$T" = ai ] && TABLE=ai_plain
cd "$(dirname "$0")/.."
source scripts/cfenv.sh
F="${LUN_INSECTS_CACHE:-D:/lun-insects-cache}/build/import_$T.sql"
OUT="$(npx wrangler d1 execute insects-db --remote --yes --file "$F" 2>&1)" || true
echo "$OUT" | tail -5
if echo "$OUT" | grep -q "ERROR"; then echo "[失敗] 匯入 $T 出錯，線上仍是舊資料"; exit 1; fi
WANT="$(grep -o "'${T}_count', '[0-9]*'" "$F" | grep -o "[0-9]*'$" | tr -d "'")"
GOT="$(npx wrangler d1 execute insects-db --remote --json --command "SELECT count(*) AS n FROM $TABLE" 2>/dev/null | grep -o '"n": *[0-9]*' | grep -o '[0-9]*$')"
echo "應有 $WANT 筆，線上 $GOT 筆"
[ "$WANT" = "$GOT" ] || { echo "[失敗] 筆數不符"; exit 1; }
echo "[完成] $T 匯入並核對"
# 匯入期間背景上傳標的照片會落在舊表上，依已上傳清單補標
if [ "$T" = species ]; then
  python -X utf8 tools/remark_photos.py
  OUT="$(npx wrangler d1 execute insects-db --remote --yes --file "${LUN_INSECTS_CACHE:-D:/lun-insects-cache}/build/remark_photos.sql" 2>&1)" || true
  echo "$OUT" | grep -q "ERROR" && { echo "[失敗] 補標照片出錯"; exit 1; }
  echo "[完成] 已補標照片"
fi
