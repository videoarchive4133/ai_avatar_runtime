import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', err => errors.push(err.message));
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

await page.$eval('#splash-api-btn', el => el.click());
await page.waitForTimeout(400);

const modalVisible = await page.$eval('#api-modal', el => !el.classList.contains('is-hidden'));
const uploadDrop = await page.$('.api-meshy-upload-drop');
const uploadInput = await page.$('#api-meshy-upload-input');
const titleText = await page.$eval('.api-modal-title', el => el.textContent.trim());
const splashLabel = await page.$eval('#splash-api-btn .splash-tile-label', el => el.textContent.trim());
const detailsEl = await page.$('.api-meshy-api-details');
const emptyText = await page.$eval('#api-meshy-history-grid', el => el.textContent.trim()).catch(() => '');

console.log('スプラッシュラベル:', splashLabel);
console.log('モーダルタイトル:', titleText);
console.log('モーダル表示:', modalVisible);
console.log('アップロードエリア:', !!uploadDrop);
console.log('ファイル入力:', !!uploadInput);
console.log('APIフォーム折りたたみ:', !!detailsEl);
console.log('グリッド空テキスト:', emptyText.slice(0, 60));
console.log('エラー:', errors);
await browser.close();
