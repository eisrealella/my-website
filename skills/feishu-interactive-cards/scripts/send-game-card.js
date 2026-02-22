/**
 * 发送游戏下载确认卡片
 * 
 * 用法:
 * node send-game-card.js --game "游戏名称" --genres "动作,冒险" --languages "中文,英文" 
 *    --size "50GB" --date "2024-01-01" --magnet "magnet:..." --page "https://..."
 *    --chat-id ou_xxx
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 从 OpenClaw 配置文件读取飞书配置
function loadFeishuConfig() {
  try {
    const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
    
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      
      // 适配不同的配置结构
      // 结构1: channels.feishu.accounts.main
      const accountConfig = config.channels?.feishu?.accounts?.main;
      if (accountConfig) {
        return {
          appId: accountConfig.appId,
          appSecret: accountConfig.appSecret
        };
      }
      
      // 结构2: channels.feishu 直接配置
      const directConfig = config.channels?.feishu;
      if (directConfig && (directConfig.appId || directConfig.app_secret)) {
        return {
          appId: directConfig.appId || directConfig.app_id,
          appSecret: directConfig.appSecret || directConfig.app_secret
        };
      }
    }
  } catch (error) {
    console.error('⚠️ 无法读取 OpenClaw 配置:', error.message);
  }
  
  return null;
}

// 获取租户访问令牌
async function getTenantAccessToken(appId, appSecret) {
  const response = await axios.post(
    'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
    { app_id: appId, app_secret: appSecret }
  );
  return response.data.tenant_access_token;
}

// 上传图片到飞书并获取 imgKey
async function uploadImageToFeishu(imageUrl, appId, appSecret) {
  try {
    console.log('📥 正在下载图片:', imageUrl);
    
    // 下载图片
    const imageResponse = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000
    });
    
    const imageBuffer = Buffer.from(imageResponse.data);
    const contentType = imageResponse.headers['content-type'] || 'image/jpeg';
    const ext = contentType.split('/')[1] || 'jpg';
    const tempPath = path.join(os.tmpdir(), `game_cover_${Date.now()}.${ext}`);
    
    // 保存临时文件
    fs.writeFileSync(tempPath, imageBuffer);
    console.log('💾 临时保存图片:', tempPath);
    
    // 上传到飞书
    console.log('☁️ 正在上传到飞书...');
    const token = await getTenantAccessToken(appId, appSecret);
    
    const formData = new (require('form-data'))();
    formData.append('image_type', 'message');
    formData.append('image', fs.createReadStream(tempPath));
    
    const uploadResponse = await axios.post(
      'https://open.feishu.cn/open-apis/im/v1/images',
      formData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          ...formData.getHeaders()
        }
      }
    );
    
    const imgKey = uploadResponse.data.data.image_key;
    console.log('✅ 图片上传成功! imgKey:', imgKey);
    
    // 清理临时文件
    fs.unlinkSync(tempPath);
    
    return imgKey;
  } catch (error) {
    console.error('❌ 图片上传失败:', error.message);
    return null;
  }
}

// 从游戏页面提取首图 URL
async function extractGameCoverImage(gamePageUrl) {
  try {
    console.log('🔍 正在提取游戏页面首图...', gamePageUrl);
    
    const response = await axios.get(gamePageUrl, {
      timeout: 15000
    });
    
    // 查找 og:image 或页面中的第一张图片
    const html = response.data;
    
    // 方法1: 查找 og:image
    const ogImageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
    if (ogImageMatch && ogImageMatch[1]) {
      console.log('✅ 找到 og:image:', ogImageMatch[1]);
      return ogImageMatch[1];
    }
    
    // 方法2: 查找游戏截图区域的第一张图片
    const screenshotMatch = html.match(/<a[^>]+href="(https:\/\/en\.riotpixels\.com\/games\/[^"]+\/screenshots\/[^"]+\.jpg)"/i);
    if (screenshotMatch && screenshotMatch[1]) {
      console.log('✅ 找到游戏截图:', screenshotMatch[1]);
      return screenshotMatch[1];
    }
    
    console.log('⚠️ 未找到游戏首图');
    return null;
  } catch (error) {
    console.error('❌ 提取首图失败:', error.message);
    return null;
  }
}

// 创建游戏下载卡片
function createGameCard(params) {
  const {
    gameName,
    genresTags,
    languages,
    fileSize,
    publishDate,
    magnetUrl,
    torrentUrl,
    screenshotUrl,
    pageUrl,
    imageKey // 飞书图片上传后的 imgKey
  } = params;

  const elements = [];
  
  // 添加图片（如果有）
  if (imageKey) {
    elements.push({
      tag: "img",
      img_key: imageKey,
      alt: {
        content: `${gameName} 封面`,
        tag: "plain_text"
      }
    });
  }
  
  // 添加游戏信息
  elements.push({
    tag: "div",
    text: {
      content: `**🎮 游戏名称**\n${gameName}\n\n---\n\n**🏷️ 类型/标签**\n${genresTags}\n\n**🌍 语言**\n${languages}\n\n---\n\n**💾 大小**：${fileSize}\n\n**📅 发布时间**：${publishDate}`,
      tag: "lark_md"
    }
  });
  
  // 添加分隔线
  elements.push({
    tag: "hr"
  });
  
  // 添加按钮
  elements.push({
    tag: "action",
    actions: [
      {
        tag: "button",
        text: { content: "✅ 开始下载", tag: "plain_text" },
        type: "primary",
        value: {
          action: "start_download",
          game_name: gameName,
          magnet_url: magnetUrl,
          torrent_url: torrentUrl,
          screenshot_url: screenshotUrl
        }
      },
      {
        tag: "button",
        text: { content: "🔗 访问页面", tag: "plain_text" },
        type: "default",
        value: {
          action: "open_page",
          game_name: gameName,
          page_url: pageUrl
        }
      },
      {
        tag: "button",
        text: { content: "❌ 取消", tag: "plain_text" },
        type: "default",
        value: { action: "cancel" }
      }
    ]
  });
  
  // 添加提示
  elements.push({
    tag: "note",
    elements: [
      {
        tag: "plain_text",
        content: "💡 点击\"开始下载\"后，迅雷将自动启动"
      }
    ]
  });

  return {
    config: { wide_screen_mode: true },
    header: {
      title: { content: "🎮 游戏下载确认", tag: "plain_text" },
      template: "blue"
    },
    elements: elements
  };
}

// 发送卡片到指定 ID（支持用户和群聊）
async function sendCardToChatId(appId, appSecret, receiveId, card) {
  const token = await getTenantAccessToken(appId, appSecret);
  
  // 根据 ID 前缀判断类型
  const isUserId = receiveId.startsWith('ou_');
  const receiveIdType = isUserId ? 'open_id' : 'chat_id';
  
  const response = await axios.post(
    `https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=${receiveIdType}`,
    {
      receive_id: receiveId,
      msg_type: 'interactive',
      content: JSON.stringify(card)
    },
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8'
      }
    }
  );
  return response.data;
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  
  // 解析命令行参数
  let gameName = '';
  let genresTags = '';
  let languages = '';
  let fileSize = '';
  let publishDate = '';
  let magnetUrl = '';
  let torrentUrl = '';
  let screenshotUrl = '';
  let pageUrl = '';
  let chatId = '';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    
    if (arg === '--game') gameName = next || '';
    else if (arg === '--genres') genresTags = next || '';
    else if (arg === '--languages') languages = next || '';
    else if (arg === '--size') fileSize = next || '';
    else if (arg === '--date') publishDate = next || '';
    else if (arg === '--magnet') magnetUrl = next || '';
    else if (arg === '--torrent') torrentUrl = next || '';
    else if (arg === '--screenshot') screenshotUrl = next || '';
    else if (arg === '--page') pageUrl = next || '';
    else if (arg === '--chat-id') chatId = next || '';
  }

  // 验证必填参数
  if (!chatId) {
    console.error('❌ 缺少必填参数: --chat-id');
    console.log('\n用法:');
    console.log('  node send-game-card.js \\');
    console.log('    --game "游戏名称" \\');
    console.log('    --genres "动作,冒险" \\');
    console.log('    --languages "中文,英文" \\');
    console.log('    --size "50GB" \\');
    console.log('    --date "2024-01-01" \\');
    console.log('    --magnet "magnet:..." \\');
    console.log('    --page "https://..." \\');
    console.log('    --chat-id ou_xxx');
    process.exit(1);
  }

  if (!gameName || !magnetUrl) {
    console.error('❌ 缺少必填参数: --game 和 --magnet');
    process.exit(1);
  }

  // 加载配置
  const config = loadFeishuConfig();
  if (!config) {
    console.error('❌ 无法加载飞书配置，请检查 ~/.openclaw/openclaw.json');
    process.exit(1);
  }

  // 处理图片（自动提取并上传）
  let imageKey = null;
  if (pageUrl) {
    try {
      // 1. 从游戏页面提取首图 URL
      const imageUrl = await extractGameCoverImage(pageUrl);
      
      if (imageUrl) {
        // 2. 上传到飞书获取 imgKey
        imageKey = await uploadImageToFeishu(imageUrl, config.appId, config.appSecret);
        
        if (!imageKey) {
          console.log('⚠️ 图片上传失败，将跳过图片显示');
        }
      }
    } catch (error) {
      console.error('❌ 图片处理失败:', error.message);
      console.log('⚠️ 将跳过图片显示');
    }
  }

  // 创建卡片
  const card = createGameCard({
    gameName,
    genresTags: genresTags || '未分类',
    languages: languages || '未知',
    fileSize: fileSize || '未知',
    publishDate: publishDate || '未知',
    magnetUrl,
    torrentUrl,
    screenshotUrl,
    pageUrl,
    imageKey
  });

  // 发送卡片
  try {
    const result = await sendCardToChatId(config.appId, config.appSecret, chatId, card);
    console.log('✅ 游戏下载卡片发送成功！');
    console.log('🎮 游戏:', gameName);
    console.log('📨 Message ID:', result.data?.message_id);
    console.log('💬 Chat ID:', chatId);
  } catch (error) {
    console.error('❌ 发送失败:', error.response?.data || error.message);
    if (error.response?.data?.msg) {
      console.error('飞书错误信息:', error.response.data.msg);
    }
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch(error => {
    console.error('❌ 错误:', error);
    process.exit(1);
  });
}

module.exports = { createGameCard, sendCardToChatId };
