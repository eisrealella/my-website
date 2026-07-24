/**
 * 飞书卡片 HTTP 回调服务器
 * 用于测试卡片按钮点击回调
 * 
 * 用法: node card-http-server.js --port 3000
 */

const express = require('express');
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
      const accountConfig = config.channels?.feishu?.accounts?.main;
      if (accountConfig) {
        return {
          appId: accountConfig.appId,
          appSecret: accountConfig.appSecret
        };
      }
      
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

// 创建响应卡片
function createResponseCard(action, gameName) {
  if (action === 'start_download') {
    return {
      config: { wide_screen_mode: true },
      header: {
        title: { content: "✅ 开始下载", tag: "plain_text" },
        template: "green"
      },
      elements: [
        {
          tag: "div",
          text: {
            content: `**🎮 ${gameName}**\n\n✅ 正在启动下载...\n\n💡 迅雷应该已经启动，请检查下载任务。`,
            tag: "lark_md"
          }
        },
        {
          tag: "hr"
        },
        {
          tag: "action",
          actions: [
            {
              tag: "button",
              text: { content: "🔙 返回", tag: "plain_text" },
              type: "default",
              value: { action: "back" }
            }
          ]
        }
      ]
    };
  }
  
  return {
    toast: {
      type: 'success',
      content: '操作成功'
    }
  };
}

// 创建确认卡片
function createConfirmationCard(message) {
  return {
    config: { wide_screen_mode: true },
    header: {
      title: { content: "✅ 测试成功", tag: "plain_text" },
      template: "green"
    },
    elements: [
      {
        tag: "div",
        text: {
          content: message,
          tag: "lark_md"
        }
      }
    ]
  };
}

async function main() {
  const args = process.argv.slice(2);
  let port = 3000;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port') {
      port = parseInt(args[i + 1]) || 3000;
    }
  }
  
  const config = loadFeishuConfig();
  if (!config) {
    console.error('❌ 无法加载飞书配置');
    process.exit(1);
  }
  
  const app = express();
  app.use(express.json());
  
  // 飞书卡片回调端点
  app.post('/card-callback', async (req, res) => {
    try {
      const { action, operator, context, value } = req.body;
      
      console.log('\n📨 收到卡片回调！');
      console.log('👤 操作者:', operator?.open_id || '未知');
      console.log('🔘 动作:', value?.action || '未知');
      console.log('🎮 游戏:', value?.game_name || '无');
      
      let response;
      
      // 根据不同的按钮动作返回不同的响应
      switch (value?.action) {
        case 'start_download':
          console.log('🚀 开始下载游戏:', value?.game_name);
          response = createResponseCard('start_download', value?.game_name);
          break;
          
        case 'open_page':
          console.log('🔗 打开页面:', value?.page_url);
          response = {
            toast: {
              type: 'info',
              content: `正在打开: ${value?.game_name}`
            }
          };
          break;
          
        case 'cancel':
          console.log('❌ 用户取消');
          response = {
            toast: {
              type: 'info',
              content: '已取消'
            }
          };
          break;
          
        case 'confirm':
          response = createConfirmationCard('✅ **确认操作成功！**\n\n回调已通过 HTTP 方式接收。');
          break;
          
        default:
          console.log('⚠️ 未知动作:', value?.action);
          response = {
            toast: {
              type: 'info',
              content: '收到回调'
            }
          };
      }
      
      console.log('✅ 发送响应');
      res.json(response);
      
    } catch (error) {
      console.error('❌ 处理回调出错:', error);
      res.status(500).json({
        toast: {
          type: 'error',
          content: '处理失败'
        }
      });
    }
  });
  
  // 健康检查端点
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });
  
  // 测试端点 - 发送确认卡片
  app.get('/test-send', async (req, res) => {
    try {
      const token = await getTenantAccessToken(config.appId, config.appSecret);
      
      // 获取用户 ID（从环境变量或配置文件）
      const userId = process.env.TEST_USER_ID || 'ou_61bcfba0a48ab1a62898b605358b7d1d';
      
      const card = {
        config: { wide_screen_mode: true },
        header: {
          title: { content: "🎮 HTTP 回调测试", tag: "plain_text" },
          template: "blue"
        },
        elements: [
          {
            tag: "div",
            text: {
              content: "**点击下方按钮测试 HTTP 回调**\n\n回调将发送到: `/card-callback`",
              tag: "lark_md"
            }
          },
          {
            tag: "hr"
          },
          {
            tag: "action",
            actions: [
              {
                tag: "button",
                text: { content: "✅ 确认测试", tag: "plain_text" },
                type: "primary",
                value: { action: "confirm", test: "http_callback" }
              },
              {
                tag: "button",
                text: { content: "❌ 取消", tag: "plain_text" },
                type: "default",
                value: { action: "cancel" }
              }
            ]
          }
        ]
      };
      
      const response = await axios.post(
        `https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id`,
        {
          receive_id: userId,
          msg_type: 'interactive',
          content: JSON.stringify(card)
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      res.json({
        success: true,
        message: '卡片已发送',
        data: response.data
      });
      
    } catch (error) {
      console.error('❌ 发送失败:', error.response?.data || error.message);
      res.status(500).json({
        error: '发送失败',
        details: error.response?.data || error.message
      });
    }
  });
  
  app.listen(port, () => {
    console.log(`\n🚀 飞书卡片 HTTP 回调服务器已启动！`);
    console.log(`📡 监听端口: ${port}`);
    console.log(`🔗 回调端点: http://localhost:${port}/card-callback`);
    console.log(`🧪 测试发送: http://localhost:${port}/test-send`);
    console.log(`💡 下一步:`);
    console.log(`   1. 启动 ngrok: ngrok http ${port}`);
    console.log(`   2. 配置飞书回调 URL: https://your-ngrok-url/card-callback`);
    console.log(`   3. 访问测试页面开始测试\n`);
  });
}

main().catch(console.error);
