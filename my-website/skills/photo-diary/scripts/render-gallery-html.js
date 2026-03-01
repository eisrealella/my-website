#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const HOME = process.env.HOME || '/Users/ella';
const dbPath = path.join(HOME, '.openclaw/photo-diary/diary.json');
const outPath = path.join(HOME, '.openclaw/canvas/diary-gallery-shadcn.html');

const data = fs.existsSync(dbPath)
  ? JSON.parse(fs.readFileSync(dbPath, 'utf8'))
  : { entries: [] };
const entries = Array.isArray(data.entries) ? data.entries.slice().reverse().slice(0, 12) : [];

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  } catch {
    return '';
  }
}

function imgSrc(p) {
  if (!p) return '';
  if (/^https?:\/\//.test(p) || /^data:image\//.test(p)) return p;
  try {
    if (p.startsWith('/') && fs.existsSync(p)) {
      const ext = path.extname(p).toLowerCase();
      const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
      const b64 = fs.readFileSync(p).toString('base64');
      return `data:${mime};base64,${b64}`;
    }
  } catch {}
  return '';
}

const cards = entries.map((e) => {
  const title = esc(e.title || '未命名日记');
  const desc = esc((e.description || '').trim() || '无描述');
  const mood = esc(e.mood || '😊');
  const weather = esc(e.weather || '☀️');
  const date = esc(fmtDate(e.createdAt || ''));
  const tags = Array.isArray(e.tags) ? e.tags.slice(0, 4).map((t) => `<span class="tag">${esc(t)}</span>`).join('') : '';
  const src = imgSrc(e.image);

  return `
  <article class="card">
    <header class="card-head">
      <h3>${title}</h3>
      <div class="meta">${date}</div>
    </header>
    <div class="media-wrap">
      ${src ? `<img class="media" src="${src}" alt="${title}" />` : `<div class="media empty">No Image</div>`}
    </div>
    <div class="card-body">
      <p class="desc">${desc}</p>
      <div class="chips">
        <span class="chip">${mood}</span>
        <span class="chip">${weather}</span>
        ${tags}
      </div>
    </div>
  </article>`;
}).join('\n');

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Photo Diary Gallery</title>
<style>
:root {
  --bg-1: #0c111a;
  --bg-2: #1a2432;
  --fg: #f7fbff;
  --muted: #c9d6ec;
  --card: rgba(255, 255, 255, 0.16);
  --card-border: rgba(255, 255, 255, 0.42);
  --chip: rgba(255, 255, 255, 0.18);
  --accent: #eff6ff;
  --shadow: 0 22px 60px rgba(2, 6, 23, 0.55);
}
* { box-sizing: border-box; }
body {
  margin: 0;
  min-height: 100vh;
  color: var(--fg);
  font-family: "SF Pro Text", "PingFang SC", "Helvetica Neue", sans-serif;
  background:
    radial-gradient(1200px 700px at 10% -10%, rgba(72, 130, 255, 0.42) 0%, rgba(72, 130, 255, 0) 55%),
    radial-gradient(900px 560px at 100% 0%, rgba(150, 170, 205, 0.28) 0%, rgba(150, 170, 205, 0) 52%),
    radial-gradient(860px 520px at 30% 100%, rgba(104, 168, 255, 0.18) 0%, rgba(104, 168, 255, 0) 54%),
    linear-gradient(160deg, var(--bg-1), var(--bg-2));
  position: relative;
  overflow-x: hidden;
}
body::before,
body::after {
  content: "";
  position: fixed;
  inset: -20vmax;
  pointer-events: none;
  z-index: 0;
  filter: blur(26px);
  opacity: 0.95;
}
body::before {
  background:
    radial-gradient(34vmax 22vmax at 16% 20%, rgba(150, 205, 255, 0.72), rgba(150, 205, 255, 0)),
    radial-gradient(28vmax 20vmax at 82% 16%, rgba(168, 186, 214, 0.64), rgba(168, 186, 214, 0));
  animation: driftA 8s ease-in-out infinite alternate;
}
body::after {
  background:
    radial-gradient(28vmax 20vmax at 30% 84%, rgba(121, 185, 255, 0.36), rgba(121, 185, 255, 0)),
    radial-gradient(22vmax 16vmax at 84% 72%, rgba(142, 167, 206, 0.34), rgba(142, 167, 206, 0));
  animation: driftB 9s ease-in-out infinite alternate;
}
.shell { max-width: 1260px; margin: 0 auto; padding: 28px 22px 44px; position: relative; z-index: 1; }
.shell::before {
  content: "";
  position: absolute;
  inset: 10px 10px auto 10px;
  height: 180px;
  border-radius: 24px;
  pointer-events: none;
  background: linear-gradient(120deg, rgba(255,255,255,0.46), rgba(255,255,255,0.08) 55%, rgba(255,255,255,0.01));
  filter: blur(14px);
  opacity: 1;
  animation: shimmer 4.5s ease-in-out infinite alternate;
}
.hero {
  display: flex; align-items: end; justify-content: space-between; gap: 16px;
  margin-bottom: 20px; padding: 18px 18px 14px;
  border: 1px solid var(--card-border); border-radius: 18px;
  background: rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(34px) saturate(190%);
  -webkit-backdrop-filter: blur(34px) saturate(190%);
}
.hero h1 { margin: 0; font-size: 28px; letter-spacing: 0.4px; }
.hero p { margin: 6px 0 0; color: var(--muted); }
.badge {
  border: 1px solid var(--card-border); color: var(--accent);
  padding: 6px 12px; border-radius: 999px; font-size: 13px;
  background: rgba(255, 255, 255, 0.20);
}
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
.card {
  border: 1px solid var(--card-border);
  border-radius: 18px;
  background: var(--card);
  box-shadow: var(--shadow);
  backdrop-filter: blur(36px) saturate(200%);
  -webkit-backdrop-filter: blur(36px) saturate(200%);
  overflow: hidden;
}
.card-head { padding: 14px 14px 8px; }
.card-head h3 { margin: 0; font-size: 16px; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
.meta { margin-top: 6px; color: var(--muted); font-size: 12px; }
.media-wrap { margin: 0 12px; border-radius: 14px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.52); }
.media { width: 100%; aspect-ratio: 16 / 10; object-fit: cover; display: block; }
.empty { display: grid; place-items: center; background: rgba(255, 255, 255, 0.22); color: var(--muted); }
.card-body { padding: 12px 14px 14px; }
.desc { margin: 0 0 10px; color: #ecf4ff; font-size: 14px; line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip, .tag { display: inline-flex; align-items: center; gap: 4px; border-radius: 999px; padding: 5px 10px; font-size: 12px; border: 1px solid var(--card-border); }
.chip { background: rgba(255, 255, 255, 0.22); }
.tag { background: var(--chip); color: #e5efff; }
.empty-state { margin-top: 22px; padding: 40px; text-align: center; border: 1px dashed var(--card-border); border-radius: 18px; color: var(--muted); background: rgba(255, 255, 255, 0.16); }
@keyframes driftA { from { transform: translate3d(-2%, -1%, 0) scale(1); } to { transform: translate3d(4%, 3%, 0) scale(1.08); } }
@keyframes driftB { from { transform: translate3d(2%, 3%, 0) scale(1.06); } to { transform: translate3d(-3%, -2%, 0) scale(1); } }
@keyframes shimmer { from { transform: translateX(-2%) translateY(0); opacity: 0.7; } to { transform: translateX(3%) translateY(2%); opacity: 1; } }
</style>
</head>
<body>
  <main class="shell">
    <section class="hero">
      <div>
        <h1>Photo Diary</h1>
        <p>卡片画廊 · 记录瞬间与心情</p>
      </div>
      <div class="badge">${entries.length} records</div>
    </section>
    ${entries.length ? `<section class="grid">${cards}</section>` : `<section class="empty-state">暂无记录，先拍一张照片吧。</section>`}
  </main>
</body>
</html>`;

fs.writeFileSync(outPath, html, 'utf8');
console.log(outPath);
