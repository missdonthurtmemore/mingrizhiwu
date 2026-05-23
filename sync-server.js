/**
 * 本地同步服务
 * 监听来自网页的自动总结，自动写入 Obsidian 知识库
 *
 * 用法: node sync-server.js
 * 然后在浏览器打开网页 -> 自动总结 -> 自动存入本地知识库
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = 18888;
const VAULT_ROOT = path.resolve(__dirname, '..');
const AI_HELPER_DIR = __dirname;
const SUMMARY_DIR = path.join(VAULT_ROOT, '3. Resources', '原生家庭认知', '自动总结');
const CONVERSATION_LOG = path.join(VAULT_ROOT, '对话内容整理.md');

// 确保目录存在
if (!fs.existsSync(SUMMARY_DIR)) {
  fs.mkdirSync(SUMMARY_DIR, { recursive: true });
}

// ====== 处理总结写入 ======

function writeSummaryToVault(data) {
  const { date, milestone, summary, conversationPreview } = data;
  const dateStr = new Date().toISOString().slice(0, 10);
  const timeStr = new Date().toLocaleString('zh-CN');

  // 1. 创建独立笔记
  const noteTitle = `自动总结_第${milestone}轮_${dateStr}`;
  const noteContent = `---
created: ${dateStr}
tags:
  - type/auto-summary
  - topic/relationship
milestone: ${milestone}
---

# 📝 自动总结（第 ${milestone} 轮）

> 由 AI 助手在对话过程中自动生成
> 生成时间：${timeStr}

---

${summary}

---

*本条总结由本地同步服务自动导入*
`;

  const notePath = path.join(SUMMARY_DIR, `${noteTitle}.md`);
  fs.writeFileSync(notePath, noteContent, 'utf-8');
  console.log(`  ✅ 写入笔记: ${noteTitle}`);

  // 2. 追加到对话内容整理.md
  const logEntry = `
---

## 自动总结（第 ${milestone} 轮）— ${dateStr}

> 生成时间：${timeStr}

${summary}

📎 [[3. Resources/原生家庭认知/自动总结/${noteTitle}|查看完整笔记]]
`;

  fs.appendFileSync(CONVERSATION_LOG, logEntry, 'utf-8');
  console.log(`  ✅ 追加到: 对话内容整理.md`);

  return { noteTitle, notePath };
}

function exportKnowledge() {
  console.log('  📦 重新导出 knowledge.json...');
  try {
    execSync('node export-knowledge.js', { cwd: AI_HELPER_DIR, stdio: 'pipe' });
    console.log('  ✅ knowledge.json 已更新');
    return true;
  } catch (err) {
    console.error('  ❌ 导出失败:', err.message);
    return false;
  }
}

function pushToGitHub() {
  console.log('  🚀 推送到 GitHub...');
  try {
    execSync('node github-push.js', { cwd: AI_HELPER_DIR, stdio: 'pipe', timeout: 60000 });
    console.log('  ✅ 已推送到 GitHub');
    return true;
  } catch (err) {
    console.error('  ❌ 推送失败:', err.message);
    return false;
  }
}

// ====== HTTP 服务 ======

const server = http.createServer((req, res) => {
  // CORS - 允许来自任何来源的请求（包括 Vercel）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 健康检查（网页用它检测本地服务是否运行）
  if (req.method === 'GET' && req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'connected', vault: VAULT_ROOT }));
    return;
  }

  // 接收总结
  if (req.method === 'POST' && req.url === '/api/sync') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);

        if (data.action === 'import-summary') {
          console.log(`\n📥 收到自动总结（第 ${data.milestone} 轮）`);

          // 写入知识库
          const result = writeSummaryToVault(data);

          // 重新导出 + 推送（异步，不影响返回）
          setTimeout(() => {
            exportKnowledge();
            pushToGitHub();
          }, 100);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            message: `已导入：${result.noteTitle}`,
            note: result.notePath
          }));
        } else {
          res.writeHead(400);
          res.end(JSON.stringify({ error: '未知动作' }));
        }
      } catch (err) {
        console.error('  ❌ 处理失败:', err.message);
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('╔══════════════════════════════════════╗');
  console.log('║  🔄 本地同步服务已启动                ║');
  console.log('║                                      ║');
  console.log(`║  地址: http://localhost:${PORT}          ║`);
  console.log(`║  知识库: ${VAULT_ROOT}  ║`);
  console.log('║                                      ║');
  console.log('║  现在打开网页聊天，自动总结将自动      ║');
  console.log('║  写入你的 Obsidian 知识库！           ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('\n按 Ctrl+C 停止服务\n');
});
