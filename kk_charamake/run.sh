#!/bin/bash
# KoiKatsu Character Maker - 起動スクリプト
cd "$(dirname "$0")"

# 既存プロセスを停止
pkill -f "vite --port 5181" 2>/dev/null
pkill -f "kk_charamake/src-tauri/target/debug/app" 2>/dev/null
sleep 1

# Viteサーバー起動 (IPv4+IPv6)
DISPLAY=:0 node_modules/.bin/vite --port 5181 --host 0.0.0.0 &
VITE_PID=$!
echo "Vite PID: $VITE_PID"
sleep 2

# Tauriアプリ起動
DISPLAY=:0 WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1 \
  src-tauri/target/debug/app &
APP_PID=$!
echo "App PID: $APP_PID"

echo "起動完了。終了するには Ctrl+C"
wait $APP_PID
kill $VITE_PID 2>/dev/null
