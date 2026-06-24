#!/bin/bash
# KoiKatsu Character Maker ランチャー
# アプリモードで起動（ブラウザUIなし）

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT=5181
PID_FILE="/tmp/kk_charamake_server.pid"

# 既存サーバー停止
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    kill "$OLD_PID" 2>/dev/null
    rm -f "$PID_FILE"
fi

# ポートが使用中か確認
if lsof -i :$PORT -t &>/dev/null; then
    echo "Port $PORT already in use, using existing server"
else
    # 静的ファイルサーバー起動
    node -e "
const http = require('http');
const fs = require('fs');
const path = require('path');
const distDir = '$SCRIPT_DIR/dist';

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js':   'application/javascript',
    '.css':  'text/css',
    '.glb':  'model/gltf-binary',
    '.png':  'image/png',
    '.json': 'application/json',
};

const server = http.createServer((req, res) => {
    let url = req.url.split('?')[0];
    if (url === '/') url = '/index.html';
    let filePath = path.join(distDir, url);
    if (!fs.existsSync(filePath)) {
        res.writeHead(404); res.end('Not found'); return;
    }
    const ext = path.extname(filePath);
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    fs.createReadStream(filePath).pipe(res);
});
server.listen($PORT, '127.0.0.1', () => {
    console.log('Server running on http://127.0.0.1:$PORT');
});
process.on('SIGTERM', () => server.close());
" &
    SERVER_PID=$!
    echo $SERVER_PID > "$PID_FILE"
    sleep 1
fi

# ブラウザをアプリモードで起動
exec brave-browser \
    --app=http://127.0.0.1:$PORT \
    --window-size=1600,900 \
    --disable-extensions \
    --no-first-run \
    --no-default-browser-check \
    2>/dev/null
