/**
 * Vercel Serverless Function
 * 接收自动总结并提交到 GitHub 仓库
 * 所有用户的总结都会汇总到知识库
 */

const https = require('https');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '仅支持 POST' });
  }

  try {
    const { date, milestone, summary, conversationPreview } = req.body;
    if (!summary) {
      return res.status(400).json({ error: '缺少 summary' });
    }

    // 从请求中获取 token（前端提供，不用 Vercel 环境变量）
    // 或者从 Vercel 环境变量获取（如果用得上）
    const GITHUB_TOKEN = req.body.token || process.env.GITHUB_TOKEN || process.env.git_token;

    const REPO = 'missdonthurtmemore/mingrizhiwu';
    const BRANCH = 'master';
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toLocaleString('zh-CN');
    const fileName = `自动总结_${dateStr}_第${milestone}轮.md`;
    const filePath = `summaries/${fileName}`;

    // 构建要提交的 .md 文件内容
    const fileContent = `---
created: ${dateStr}
tags:
  - type/auto-summary
milestone: ${milestone}
---

# 📝 自动总结（第 ${milestone} 轮）

> 生成时间：${timeStr}

${summary}

---

*由 AI 助手自动生成并提交*
`;

    // 通过 GitHub API 创建/更新文件
    const result = await new Promise((resolve, reject) => {
      const body = JSON.stringify({
        message: `📝 自动总结：${fileName}`,
        content: Buffer.from(fileContent).toString('base64'),
        branch: BRANCH
      });

      const options = {
        hostname: 'api.github.com',
        path: `/repos/${REPO}/contents/summaries/${encodeURIComponent(fileName)}`,
        method: 'PUT',
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'User-Agent': 'summary-sync',
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      };

      const apiReq = https.request(options, (apiRes) => {
        let data = '';
        apiRes.on('data', chunk => data += chunk);
        apiRes.on('end', () => {
          try { resolve({ status: apiRes.statusCode, data: JSON.parse(data) }); }
          catch { resolve({ status: apiRes.statusCode, data }); }
        });
      });
      apiReq.on('error', reject);
      apiReq.write(body);
      apiReq.end();
    });

    if (result.status >= 400 && result.status !== 422) {
      return res.status(result.status).json({ error: result.data });
    }

    // 同时追加到对话内容整理.md（通过获取-修改-提交方式）
    console.log(`✅ 总结已保存: ${fileName}`);

    return res.status(200).json({
      success: true,
      message: `总结已保存：${fileName}`,
      file: filePath
    });

  } catch (err) {
    console.error('保存总结失败:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
