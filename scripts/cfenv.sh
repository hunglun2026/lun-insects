#!/usr/bin/env bash
# 讓這個程序裡的 wrangler 一定打到 hunglun2026：同時指定 API token 與帳號編號，
# 蓋過使用者環境變數與全機 OAuth 登入（steve-tools.md：直接打 wrangler 可能靜默打到錯帳號）。
# 用法：source scripts/cfenv.sh
CLOUDFLARE_API_TOKEN="$(grep '^hunglun2026=' /d/ClaudeOnly/steve0802/cf-tokens.txt | cut -d= -f2- | tr -d '\r\n ')"
export CLOUDFLARE_API_TOKEN
export CLOUDFLARE_ACCOUNT_ID=d286dc43743f9a5e5dea99efea359ee5
