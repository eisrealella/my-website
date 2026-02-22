#!/usr/bin/env node
/**
 * 飞书群聊历史消息读取
 * 
 * 用法:
 * node feishu-history.js --chat-id oc_xxx [--limit 20]
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

// 获取用户 access_token（用于获取用户信息）
async function getUserAccessToken(tenantToken, openId) {
  const response = await axios.post(
    'https://open.feishu.cn/open-apis/authen/v1/access_token',
    {},
    {
      headers: {
        'Authorization': `Bearer ${tenantToken}`
      }
    }
  );
  return response.data.access_token;
}

// 读取群聊历史消息
async function getGroupMessages(tenantToken, chatId, limit = 20) {
  try {
    const response = await axios.get(
      `https://open.feishu.cn/open-apis/im/v1/messages`,
      {
        params: {
          chat_id: chatId,
          page_size: Math.min(limit, 100),
          sort: 'desc_by_time' // 按时间倒序
        },
        headers: {
          'Authorization': `Bearer ${tenantToken}`
        }
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('❌ 获取消息失败:', error.response?.data || error.message);
    return null;
  }
}

// 解析消息内容
function parseMessageContent(message) {
  const type = message.message_type;
  const content = message.content;
  
  try {
    if (type === 'text') {
      const parsed = JSON.parse(content);
      return parsed.text || content;
    } else if (type === 'image') {
      const parsed = JSON.parse(content);
      return `[图片: ${parsed.image_key}]`;
    } else if (type === 'file') {
      const parsed = JSON.parse(content);
      return `[文件: ${parsed.file_name}]`;
    } else if (type === 'card') {
      return '[交互卡片]';
    } else {
      return `[${type}类型消息]`;
    }
  } catch (e) {
    return content;
  }
}

// 格式化时间
function formatTime(timestamp) {
  const date = new Date(timestamp / 1000); // 飞书时间戳是毫秒
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// 主函数
async function main() {
  // 解析命令行参数
  const args = process.argv.slice(2);
  let chatId = '';
  let limit = 20;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--chat-id' || args[i] === '-c') {
      chatId = args[i + 1] || '';
    } else if (args[i] === '--limit' || args[i] === '-l') {
      limit = parseInt(args[i + 1]) || 20;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
用法: node feishu-history.js [选项]

选项:
  --chat-id, -c  群聊 ID (必需)
  --limit, -l     获取消息数量 (默认 20, 最大 100)
  --help, -h      显示帮助

示例:
  node feishu-history.js -c oc_c0e696365291ca163ebec7e5ada0113f
  node feishu-history.js --chat-id oc_xxx --limit 50
`);
      process.exit(0);
    }
  }
  
  if (!chatId) {
    console.error('❌ 缺少必需参数: --chat-id');
    console.log('\n用法: node feishu-history.js --chat-id oc_xxx');
    process.exit(1);
  }
  
  console.log(`📖 读取群聊历史消息...`);
  console.log(`📋 Chat ID: ${chatId}`);
  console.log(`📊 数量限制: ${limit}\n`);
  
  // 加载配置
  const config = loadFeishuConfig();
  if (!config) {
    console.error('❌ 无法加载飞书配置，请检查 ~/.openclaw/openclaw.json');
    process.exit(1);
  }
  
  try {
    // 获取 token
    console.log('🔐 获取访问令牌...');
    const tenantToken = await getTenantAccessToken(config.appId, config.appSecret);
    console.log('✅ 获取成功\n');
    
    // 获取消息
    console.log('📥 获取消息中...\n');
    const result = await getGroupMessages(tenantToken, chatId, limit);
    
    if (!result || !result.data) {
      console.error('❌ 获取消息失败');
      process.exit(1);
    }
    
    const messages = result.data.items || [];
    
    if (messages.length === 0) {
      console.log('📭 没有找到消息');
      process.exit(0);
    }
    
    // 显示消息
    console.log(`📝 共 ${messages.length} 条消息:\n`);
    console.log('─'.repeat(50));
    
    for (const msg of messages) {
      const sender = msg.sender?.sender_id?.open_id || '未知';
      const time = formatTime(msg.create_time);
      const content = parseMessageContent(msg);
      const type = msg.message_type;
      
      console.log(`[${time}] ${content}`);
      console.log(`    └ 类型: ${type} | 发送者: ${sender}`);
      console.log('─'.repeat(50));
    }
    
    // 分页信息
    if (result.data.has_more) {
      console.log('\n💡 还有更多消息，使用 --page-token 参数获取下一页');
    }
    
  } catch (error) {
    console.error('\n❌ 错误:', error.response?.data || error.message);
    console.log('\n💡 可能原因:');
    console.log('   1. 应用缺少 im:message 权限');
    console.log('   2. 机器人不在该群聊中');
    console.log('   3. 群聊设置禁止机器人读取消息');
    
    process.exit(1);
  }
}

main();
