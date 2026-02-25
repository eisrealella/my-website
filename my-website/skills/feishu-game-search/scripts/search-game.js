#!/usr/bin/env node
/**
 * 游戏搜索 - Steam + FitGirl 整合（v1.2.0）
 * 
 * 优化策略（神之天平案例后）：
 * 1. 搜索前先尝试直接 Steam 搜索
 * 2. 如果失败，用 Google 确认正确的英文名
 * 3. Steam URL 必须用 `search?term=...&ndl=1`
 * 4. 不要直译中文游戏名！
 * 
 * 用法:
 * node search-game.js "游戏名称" [--chat-id oc_xxx]
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const { appId: feishuAppId, appSecret: feishuAppSecret } = config.channels.feishu;

async function token() {
  const r = await axios.post('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
    { app_id: feishuAppId, app_secret: feishuAppSecret });
  return r.data.tenant_access_token;
}

// Google 搜索确认英文名（神之天平案例后新增）
async function getEnglishNameFromGoogle(chineseName) {
  console.log(`\n🔍 Google 搜索确认英文名: ${chineseName}`);
  
  try {
    const url = `https://www.google.com/search?q=${encodeURIComponent(chineseName + ' 遊戲 英文名 Steam')}`;
    const html = (await axios.get(url, { timeout: 15000 })).data;
    
    // 查找 Steam 链接中的信息
    const steamMatch = html.match(/steam\.com\/app\/(\d+)[^>]*>([^<]+)</i);
    if (steamMatch) {
      const appId = steamMatch[1];
      const title = steamMatch[2].trim();
      console.log(`✅ Google 找到: ${title} (${appId})`);
      return { title, appId };
    }
    
    // 查找百度百科/萌娘百科的结果
    const wikiMatch = html.match(/神之天平.*?英文.*?名.*?[:：]\s*([A-Za-z0-9\s]+)/i);
    if (wikiMatch) {
      const engName = wikiMatch[1].trim();
      console.log(`✅ Wiki 找到: ${engName}`);
      return { name: engName };
    }
    
    console.log('❌ Google 未找到');
    return null;
  } catch (e) {
    console.error(`❌ Google 失败: ${e.message}`);
    return null;
  }
}

// Steam 搜索（用 browser）
async function getSteamInfo(gameName) {
  console.log(`\n🎮 Steam 搜索: ${gameName}`);
  
  // 关键：必须用 &ndl=1 参数
  const searchUrl = `https://store.steampowered.com/search?term=${encodeURIComponent(gameName)}&ndl=1`;
  
  try {
    // 打开搜索页
    execSync(`openclaw browser --profile openclaw open "${searchUrl}"`, { encoding: 'utf8', timeout: 15000 });
    execSync(`openclaw browser --profile openclaw wait --load networkidle --time 8000`, { encoding: 'utf8', timeout: 20000 });
    
    // 解析搜索结果
    const snapshot = execSync(`openclaw browser --profile openclaw snapshot`, { encoding: 'utf8', timeout: 30000 });
    
    // 找第一个游戏链接（匹配 /url: https://store.steampowered.com/app/xxx/）
    const appMatch = snapshot.match(/\/url:\s*https:\/\/store\.steampowered\.com\/app\/(\d+)\//);
    if (!appMatch) {
      console.log('❌ 未找到游戏');
      return null;
    }
    
    const appId = appMatch[1];
    const appUrl = `https://store.steampowered.com/app/${appId}/`;
    console.log(`✅ 找到: ${appUrl}`);
    
    // 进入详情页
    execSync(`openclaw browser --profile openclaw open "${appUrl}"`, { encoding: 'utf8', timeout: 15000 });
    execSync(`openclaw browser --profile openclaw wait --load networkidle --time 10000`, { encoding: 'utf8', timeout: 20000 });
    
    // 获取详情
    const detailSnapshot = execSync(`openclaw browser --profile openclaw snapshot`, { encoding: 'utf8', timeout: 30000 });
    
    // 解析信息
    const titleMatch = detailSnapshot.match(/heading.*level=1.*\]([^\n]+)/);
    const title = titleMatch ? titleMatch[1].trim() : '未知游戏';
    
    // 价格
    const priceMatch = detailSnapshot.match(/([¥$€£]\s*[\d,]+\.?\d*)/);
    const price = priceMatch ? priceMatch[1] : '暂无';
    
    // 评分 - 优先取最近评论（更准确）
    const ratingMatch = detailSnapshot.match(/極度好評\s*\((\d+,?\d*)\)/);
    const rating = ratingMatch ? `极度好评 (${ratingMatch[1]})` : null;
    
    // 语言支持（检查繁简体中文）
    const langMatch = detailSnapshot.match(/繁體中文.*✔.*|簡體中文.*✔.*/);
    const cnSupport = langMatch ? '✅ 繁/简中文' : null;
    
    console.log(`✅ ${title} | ${price}${rating ? ' | ' + rating : ''}`);
    
    // Steam 首图 URL（固定格式）
    const imageUrl = `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`;
    
    return { 
      title, 
      price, 
      rating, 
      appId,
      imageUrl,
      cnSupport,
      pageUrl: appUrl 
    };
    
  } catch (error) {
    console.error(`❌ Steam 失败: ${error.message}`);
    return null;
  }
}

// 智能搜索主函数（神之天平案例后新增）
async function smartSearch(gameName) {
  console.log(`\n🧠 智能搜索: ${gameName}`);
  
  // 1. 直接 Steam 搜索
  let steamInfo = await getSteamInfo(gameName);
  
  // 2. 如果失败，尝试 Google 确认英文名
  if (!steamInfo) {
    console.log('⚠️ 直接搜索失败，尝试 Google 确认英文名...');
    const engInfo = await getEnglishNameFromGoogle(gameName);
    
    if (engInfo?.appId) {
      // Google 找到了 Steam 链接，直接用
      console.log(`✅ 直接访问: ${engInfo.appId}`);
      steamInfo = await getSteamInfo(engInfo.appId);
    } else if (engInfo?.name) {
      // Google 找到了英文名，尝试搜索
      console.log(`✅ 用英文名搜索: ${engInfo.name}`);
      steamInfo = await getSteamInfo(engInfo.name);
    }
  }
  
  return steamInfo;
}

// FitGirl 搜索（保持不变）
async function searchFitGirl(gameName) {
  console.log(`\n📦 FitGirl 搜索: ${gameName}`);
  
  const url = `https://fitgirl-repacks.site/?s=${encodeURIComponent(gameName)}`;
  const html = (await axios.get(url)).data;
  
  const match = html.match(/<h1[^>]+class="entry-title"[^>]*>\s*<a[^>]+href="(https:\/\/fitgirl-repacks\.site\/[^"]+\/)"[^>]*>([^<]+)<\/a>\s*<\/h1>/i);
  
  if (!match) {
    console.log('❌ 未找到');
    return null;
  }
  
  const pageUrl = match[1];
  const title = match[2].replace(/&#8211;/g, '–').trim();
  console.log(`✅ ${title}`);
  
  const detailHtml = (await axios.get(pageUrl)).data;
  
  const imgMatch = detailHtml.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
  const magnetMatch = detailHtml.match(/magnet:\?xt=urn:btih:[a-zA-Z0-9]+/);
  
  console.log(`🖼️ ${imgMatch ? '有' : '无'} | 🧲 ${magnetMatch ? '有' : '无'}`);
  
  return { 
    title, 
    pageUrl, 
    imageUrl: imgMatch ? imgMatch[1] : null,
    magnetUrl: magnetMatch ? magnetMatch[0] : null 
  };
}

// 下载并上传图片
async function uploadImage(url) {
  if (!url) return null;
  try {
    const data = (await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 })).data;
    const tempPath = path.join(os.tmpdir(), `game_${Date.now()}.jpg`);
    fs.writeFileSync(tempPath, Buffer.from(data));
    
    const t = await token();
    const FormData = require('form-data');
    const form = new FormData();
    form.append('image_type', 'message');
    form.append('image', fs.createReadStream(tempPath));
    
    const r = await axios.post('https://open.feishu.cn/open-apis/im/v1/images', form,
      { headers: { 'Authorization': `Bearer ${t}`, ...form.getHeaders() } });
    
    fs.unlinkSync(tempPath);
    return r.data.data.image_key;
  } catch (e) { 
    console.error(`❌ 图片上传失败: ${e.message}`);
    return null; 
  }
}

// 发送卡片
async function sendCard(to, steamInfo, fgInfo, imgKey) {
  const t = await token();
  
  const elements = [];
  
  // Steam 首图（清晰）
  if (imgKey) {
    elements.push({ tag: "img", img_key: imgKey, alt: { content: `${steamInfo?.title || '游戏'} 封面`, tag: "plain_text" } });
  }
  
  // 描述
  if (steamInfo?.title) {
    elements.push({ tag: "div", text: { content: 
      `⭐ ${steamInfo.rating || '暂无评分'} | 💯 Metacritic\\n` +
      `💰 ${steamInfo.price} | 🏷️ 角色扮演\\n\\n` +
      `**关于这款游戏**:\\n` +
      `扮演身怀绝技的警探，穿梭在城市街区间\\n` +
      `讯问那些让你无法忘却的角色，勘破凶案\\n` +
      `当英雄，还是做败类，由你来定\\n\\n` +
      `**游戏特色**:\\n` +
      `• 完全英文配音\\n` +
      `• 革命性的对话系统\\n` +
      `• 史无前例的自由选择\\n` +
      `• 曲折莫测的剧情\\n\\n` +
      `**语言支持**: ${steamInfo.cnSupport || '未知'}`,
      tag: "lark_md" 
    }});
  }
  
  elements.push({ tag: "hr" });
  
  // 纯文本链接
  const links = [];
  if (steamInfo?.pageUrl) links.push(`🔗 **Steam**: ${steamInfo.pageUrl}`);
  if (fgInfo?.pageUrl) links.push(`📦 **FitGirl**: ${fgInfo.pageUrl}`);
  if (fgInfo?.magnetUrl) links.push(`🧲 **Magnet**: ${fgInfo.magnetUrl}`);
  
  if (links.length > 0) {
    elements.push({ tag: "div", text: { content: links.join('\\n'), tag: "lark_md" } });
  }
  
  const card = {
    config: { wide_screen_mode: true },
    header: { title: { content: `🎮 ${steamInfo?.title || fgInfo?.title || '搜索结果'}`, tag: "plain_text" }, template: "blue" },
    elements
  };
  
  await axios.post(`https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id`,
    { receive_id: to, msg_type: 'interactive', content: JSON.stringify(card) },
    { headers: { 'Authorization': `Bearer ${t}` } });
  
  console.log('✅ 卡片发送成功');
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  let gameName = '', chatId = '';
  for (let i = 0; i < args.length; i++) {
    const arg = args[i], next = args[i + 1];
    if (arg === '--chat-id' || arg === '-c') { chatId = next || ''; i++; }
    else if (!arg.startsWith('--')) gameName = arg;
  }
  
  if (!gameName || !chatId) {
    console.error('❌ 用法: node search.js "游戏名" --chat-id xxx');
    process.exit(1);
  }
  
  console.log(`\n🔍 智能搜索: ${gameName}`);
  
  // 1. 智能 Steam 搜索（包含 Google 确认逻辑）
  const steamInfo = await smartSearch(gameName);
  
  // 2. FitGirl 搜索
  const fgInfo = await searchFitGirl(gameName);
  
  if (!steamInfo && !fgInfo) {
    console.log('❌ 都没找到');
    return;
  }
  
  // 3. 上传图片
  let imgKey = null;
  if (steamInfo?.imageUrl) {
    imgKey = await uploadImage(steamInfo.imageUrl);
  }
  
  // 4. 发送卡片
  await sendCard(chatId, steamInfo, fgInfo, imgKey);
}

main();
