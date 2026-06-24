#!/usr/bin/env node
/**
 * ws-relay.cjs — AI Avatar Runtime 外部制御リレーサーバー
 *
 * 起動方法:
 *   node ws-relay.cjs           # デフォルト: ws://localhost:8765
 *   node ws-relay.cjs 9000      # ポート指定
 *
 * 使い方:
 *   1. このサーバーを起動する
 *   2. ブラウザのプロパティパネル「外部 WebSocket」で同じ URL に接続する
 *   3. 外部プログラムからこのサーバーに JSON を送ると Avatar に転送される
 *
 * 送信フォーマット (JSON):
 *   {"motion":"walk"}
 *   {"emotion":"happy"}
 *   {"speech":"こんにちは！"}
 *   {"motion":"talk","emotion":"happy","speech":"やあ！"}
 *
 * Python から送信する例:
 *   import asyncio, json, websockets
 *   async def main():
 *       async with websockets.connect("ws://localhost:8765") as ws:
 *           await ws.send(json.dumps({"emotion":"happy","speech":"こんにちは"}))
 *   asyncio.run(main())
 */

const { WebSocketServer, WebSocket } = require('ws');

const PORT = Number(process.argv[2]) || 8765;
const wss = new WebSocketServer({ port: PORT });

const clients = new Set();

wss.on('connection', (ws, req) => {
  clients.add(ws);
  const addr = req.socket.remoteAddress;
  console.log(`[ws-relay] 接続: ${addr}  (合計: ${clients.size})`);

  ws.on('message', (data) => {
    const text = data.toString();
    let action;
    try {
      action = JSON.parse(text);
    } catch {
      console.warn('[ws-relay] JSON parse error:', text.slice(0, 120));
      return;
    }
    console.log(`[ws-relay] 受信:`, JSON.stringify(action));
    // 全クライアントに転送（送信元含む）
    for (const c of clients) {
      if (c.readyState === WebSocket.OPEN) {
        c.send(JSON.stringify(action));
      }
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`[ws-relay] 切断: ${addr}  (合計: ${clients.size})`);
  });

  ws.on('error', (err) => {
    console.error(`[ws-relay] エラー: ${err.message}`);
    clients.delete(ws);
  });
});

console.log(`[ws-relay] 起動しました → ws://localhost:${PORT}`);
console.log('[ws-relay] ブラウザと外部プログラムを同じ URL に接続してください');
