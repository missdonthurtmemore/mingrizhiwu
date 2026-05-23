/**
 * Vercel Serverless Function
 * 转发聊天请求到 DeepSeek API，API 密钥保存在 Vercel 环境变量中
 */

module.exports = async function handler(req, res) {
  // 只允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '仅支持 POST 请求' });
  }

  try {
    const { messages, signal } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: '缺少 messages 参数' });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: '服务器未配置 API 密钥' });
    }

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: messages,
        temperature: 0.8,
        max_tokens: 2048,
        top_p: 0.95,
        frequency_penalty: 0.3,
        presence_penalty: 0.3
      })
    });

    const data = await response.json();

    if (data.error) {
      return res.status(401).json({ error: data.error.message || 'API 请求失败' });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message || '服务器内部错误' });
  }
}
