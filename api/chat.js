/**
 * Vercel Serverless Function
 * 转发聊天请求到 DeepSeek API（使用 https 模块，兼容所有 Node 版本）
 */

const https = require('https');

module.exports = async function handler(req, res) {
  // 只允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '仅支持 POST 请求' });
  }

  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: '缺少 messages 参数' });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: '服务器未配置 API 密钥' });
    }

    const body = JSON.stringify({
      model: 'deepseek-chat',
      messages: messages,
      temperature: 0.8,
      max_tokens: 2048,
      top_p: 0.95,
      frequency_penalty: 0.3,
      presence_penalty: 0.3
    });

    const data = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.deepseek.com',
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(body)
        }
      };

      const apiReq = https.request(options, (apiRes) => {
        let responseData = '';
        apiRes.on('data', chunk => responseData += chunk);
        apiRes.on('end', () => {
          try {
            resolve(JSON.parse(responseData));
          } catch {
            reject(new Error('DeepSeek API 返回了非 JSON 响应'));
          }
        });
      });

      apiReq.on('error', reject);
      apiReq.write(body);
      apiReq.end();
    });

    if (data.error) {
      return res.status(401).json({ error: data.error.message || 'API 请求失败' });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message || '服务器内部错误' });
  }
}
