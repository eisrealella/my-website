#!/usr/bin/env node

/**
 * Photo Diary - 照片日记
 * 多模态: 拍照 → 生成日记卡片/画廊 → Canvas(A2UI) 展示
 */

const fs = require('fs');
const path = require('path');

const HOME = process.env.HOME || '/Users/ella';
const DIARY_DIR = path.join(HOME, '.openclaw/photo-diary');
const DIARY_DB = path.join(DIARY_DIR, 'diary.json');
const CANVAS_DIR = path.join(HOME, '.openclaw/canvas');

function ensureDir() {
  [DIARY_DIR, CANVAS_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
  if (!fs.existsSync(DIARY_DB)) {
    fs.writeFileSync(DIARY_DB, JSON.stringify({ entries: [] }, null, 2));
  }
}

function saveEntry(entry) {
  ensureDir();
  const data = JSON.parse(fs.readFileSync(DIARY_DB, 'utf-8'));
  entry.id = Date.now().toString();
  entry.createdAt = new Date().toISOString();
  data.entries.push(entry);
  fs.writeFileSync(DIARY_DB, JSON.stringify(data, null, 2));
  return entry;
}

function getEntries() {
  ensureDir();
  return JSON.parse(fs.readFileSync(DIARY_DB, 'utf-8')).entries;
}

function toZhDate(iso) {
  return new Date(iso).toLocaleDateString('zh-CN', {
    weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit'
  });
}

function toZhTime(iso) {
  return new Date(iso).toLocaleTimeString('zh-CN', {
    hour: '2-digit', minute: '2-digit'
  });
}

function guessMimeByExt(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return null;
}

function toImageUrl(value, maxBytes = 1024 * 1024) {
  if (!value || typeof value !== 'string') return null;
  if (value.startsWith('data:image/')) return value;
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  if (value.startsWith('/')) {
    if (!fs.existsSync(value)) return null;
    const stat = fs.statSync(value);
    if (!stat.isFile() || stat.size > maxBytes) return null;
    const mime = guessMimeByExt(value);
    if (!mime) return null;
    const b64 = fs.readFileSync(value).toString('base64');
    return `data:${mime};base64,${b64}`;
  }
  return null;
}

function generateCardA2UI(entry) {
  ensureDir();
  const mood = entry.mood || '😊';
  const weather = entry.weather || '☀️';
  const title = entry.title || '美好瞬间';
  const desc = entry.description || '未填写描述';
  const imageUrl = toImageUrl(entry.image);

  const childIds = ['title'];
  const components = [{
    id: 'root',
    component: { Column: { children: { explicitList: childIds } } }
  }, {
    id: 'title',
    component: { Text: { text: { literalString: `📸 ${title}` }, usageHint: 'title' } }
  }];

  if (imageUrl) {
    childIds.push('img');
    components.push({
      id: 'img',
      component: {
        Image: {
          url: { literalString: imageUrl },
          usageHint: 'largeFeature',
          objectFit: 'cover'
        }
      }
    });
  }

  childIds.push('meta', 'desc');
  components.push({
    id: 'meta',
    component: {
      Text: {
        text: { literalString: `${toZhDate(entry.createdAt)} ${toZhTime(entry.createdAt)}  ${mood} ${weather}` },
        usageHint: 'body'
      }
    }
  }, {
    id: 'desc',
    component: {
      Text: {
        text: { literalString: `📝 ${desc}` },
        usageHint: 'body'
      }
    }
  });

  if (Array.isArray(entry.tags) && entry.tags.length > 0) {
    childIds.push('tags');
    components.push({
      id: 'tags',
      component: {
        Text: {
          text: { literalString: `🏷️ ${entry.tags.join(' · ')}` },
          usageHint: 'body'
        }
      }
    });
  }

  const jsonl = [
    JSON.stringify({ surfaceUpdate: { surfaceId: 'main', components } }),
    JSON.stringify({ beginRendering: { surfaceId: 'main', root: 'root' } })
  ].join('\n');

  const filename = `diary-card-${entry.id || Date.now()}.jsonl`;
  fs.writeFileSync(path.join(CANVAS_DIR, filename), jsonl, 'utf-8');
  return filename;
}

function generateGalleryA2UI(entries) {
  ensureDir();
  const items = entries.slice(-4).reverse();

  const childIds = ['head_title', 'head_subtitle', 'head_count'];
  const components = [{
    id: 'root',
    component: { Column: { children: { explicitList: childIds } } }
  }, {
    id: 'head_title',
    component: { Text: { text: { literalString: 'PHOTO DIARY' }, usageHint: 'title' } }
  }, {
    id: 'head_subtitle',
    component: { Text: { text: { literalString: '记录真实瞬间与当下心情' }, usageHint: 'body' } }
  }, {
    id: 'head_count',
    component: { Text: { text: { literalString: `共 ${entries.length} 条记录 · 展示最近 ${items.length} 条` }, usageHint: 'body' } }
  }];

  if (items.length === 0) {
    childIds.push('empty');
    components.push({
      id: 'empty',
      component: { Text: { text: { literalString: '还没有记录，快去拍照吧。' }, usageHint: 'body' } }
    });
  } else {
    const rows = [];
    for (let i = 0; i < items.length; i += 2) {
      rows.push(items.slice(i, i + 2));
    }

    rows.forEach((rowItems, rowIdx) => {
      const rowId = `grid_row_${rowIdx + 1}`;
      const rowCardIds = [];
      childIds.push(rowId);
      components.push({
        id: rowId,
        component: {
          Row: { children: { explicitList: rowCardIds } }
        }
      });

      rowItems.forEach((e, colIdx) => {
        const idx = rowIdx * 2 + colIdx;
        const cardRootId = `card_${idx + 1}`;
        rowCardIds.push(cardRootId);

        const cardTitleId = `${cardRootId}_title`;
        const cardMetaId = `${cardRootId}_meta`;
        const cardImgId = `${cardRootId}_img`;
        const cardMoodId = `${cardRootId}_mood`;
        const cardDescId = `${cardRootId}_desc`;

        const title = e.title || '未命名日记';
        const desc = (e.description || '').trim();
        const shortDesc = desc.length > 80 ? `${desc.slice(0, 80)}...` : (desc || '无描述');
        const mood = e.mood || '😊';
        const weather = e.weather || '☀️';
        const imageUrl = toImageUrl(e.image);

        const cardChildren = [cardTitleId, cardMetaId];
        if (imageUrl) cardChildren.push(cardImgId);
        cardChildren.push(cardMoodId, cardDescId);

        components.push({
          id: cardRootId,
          component: {
            Column: {
              children: { explicitList: cardChildren }
            }
          }
        }, {
          id: cardTitleId,
          component: {
            Text: {
              text: { literalString: title },
              usageHint: 'title'
            }
          }
        }, {
          id: cardMetaId,
          component: {
            Text: {
              text: { literalString: `${toZhDate(e.createdAt)} ${toZhTime(e.createdAt)}` },
              usageHint: 'body'
            }
          }
        });

        if (imageUrl) {
          components.push({
            id: cardImgId,
            component: {
              Image: {
                url: { literalString: imageUrl },
                usageHint: 'mediumFeature',
                objectFit: 'cover'
              }
            }
          });
        }

        components.push({
          id: cardMoodId,
          component: {
            Text: {
              text: { literalString: `${mood}  ${weather}` },
              usageHint: 'body'
            }
          }
        }, {
          id: cardDescId,
          component: {
            Text: {
              text: { literalString: shortDesc },
              usageHint: 'body'
            }
          }
        });
      });
    });

    /*
     * Fallback sequence rendering is kept as comments below for reference.
     * The active renderer now uses 2-column card rows above.
     */
    /*
    items.forEach((e, idx) => {
      const prefix = `item_${idx + 1}`;
      const title = e.title || '未命名日记';
      const desc = (e.description || '').trim();
      const shortDesc = desc.length > 60 ? `${desc.slice(0, 60)}...` : (desc || '无描述');
      const mood = e.mood || '😊';
      const weather = e.weather || '☀️';
      const imageUrl = toImageUrl(e.image);
      const titleId = `${prefix}_title`;
      const metaId = `${prefix}_meta`;
      const imageId = `${prefix}_img`;
      const descId = `${prefix}_desc`;
      const dividerId = `${prefix}_divider`;

      childIds.push(titleId, metaId);
      components.push({
        id: titleId,
        component: {
          Text: {
            text: { literalString: `${idx + 1}. ${title}` },
            usageHint: 'title'
          }
        }
      }, {
        id: metaId,
        component: {
          Text: {
            text: { literalString: `${toZhDate(e.createdAt)} ${toZhTime(e.createdAt)} · ${mood} ${weather}` },
            usageHint: 'body'
          }
        }
      });

      if (imageUrl) {
        childIds.push(imageId);
        components.push({
          id: imageId,
          component: {
            Image: {
              url: { literalString: imageUrl },
              usageHint: 'largeFeature',
              objectFit: 'cover'
            }
          }
        });
      }

      childIds.push(descId, dividerId);
      components.push({
        id: descId,
        component: {
          Text: {
            text: { literalString: shortDesc },
            usageHint: 'body'
          }
        }
      }, {
        id: dividerId,
        component: {
          Text: {
            text: { literalString: '────────────────────' },
            usageHint: 'body'
          }
        }
      });
    });
    */
  }

  const jsonl = [
    JSON.stringify({ surfaceUpdate: { surfaceId: 'main', components } }),
    JSON.stringify({ beginRendering: { surfaceId: 'main', root: 'root' } })
  ].join('\n');

  const filename = 'diary-gallery.jsonl';
  fs.writeFileSync(path.join(CANVAS_DIR, filename), jsonl, 'utf-8');
  return filename;
}

// Legacy HTML fallback kept for compatibility.
function generateCardHtml(entry) {
  const date = new Date(entry.createdAt).toLocaleDateString('zh-CN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  const time = new Date(entry.createdAt).toLocaleTimeString('zh-CN', {
    hour: '2-digit', minute: '2-digit'
  });
  const mood = entry.mood || '😊';
  const weather = entry.weather || '☀️';

  const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${entry.title || '照片日记'}</title></head><body><h1>${entry.title || '美好瞬间'}</h1><p>${date} ${time} ${mood} ${weather}</p><p>${entry.description || ''}</p><p>${entry.image || ''}</p></body></html>`;
  const filename = `diary-${entry.id || Date.now()}.html`;
  fs.writeFileSync(path.join(CANVAS_DIR, filename), html, 'utf-8');
  return filename;
}

function generateGalleryHtml(entries) {
  const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>照片日记画廊</title></head><body><h1>照片日记</h1><p>共 ${entries.length} 条记录</p></body></html>`;
  const filename = 'diary-gallery.html';
  fs.writeFileSync(path.join(CANVAS_DIR, filename), html, 'utf-8');
  return filename;
}

const generateCard = generateCardA2UI;
const generateGallery = generateGalleryA2UI;

if (require.main === module) {
  ensureDir();
  const cmd = process.argv[2] || 'gallery';
  const all = getEntries();

  if (cmd === 'gallery') {
    const file = generateGallery(all);
    console.log(path.join(CANVAS_DIR, file));
  } else if (cmd === 'card-latest') {
    if (all.length === 0) {
      console.error('No diary entries found');
      process.exit(1);
    }
    const file = generateCard(all[all.length - 1]);
    console.log(path.join(CANVAS_DIR, file));
  } else {
    console.error('Usage: photo-diary.js [gallery|card-latest]');
    process.exit(1);
  }
}

module.exports = {
  ensureDir,
  saveEntry,
  getEntries,
  generateCard,
  generateGallery,
  generateCardA2UI,
  generateGalleryA2UI,
  generateCardHtml,
  generateGalleryHtml
};
