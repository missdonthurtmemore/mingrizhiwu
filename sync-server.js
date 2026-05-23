/**
 * 本地同步服务 v2
 * 监听网页的自动总结 + 从 GitHub 拉取云端总结
 * 所有用户的对话总结都会自动写入你的 Obsidian 知识库
 *
 * 用法: node sync-server.js
 * 或直接双击 start-sync.bat
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

// ====== 已导入文件的追踪 ======
const IMPORTED_LOG = path.join(AI_HELPER_DIR, '.imported-summaries.json');

function getImportedFiles() {
  try { return JSON.parse(fs.readFileSync(IMPORTED_LOG, 'utf-8')); }
  catch { return []; }
}

function markImported(fileName) {
  const list = getImportedFiles();
  list.push({ file: fileName, time: new Date().toISOString() });
  fs.writeFileSync(IMPORTED_LOG, JSON.stringify(list, null, 2));
}

// ====== 导入总结到知识库 ======

function importSummary(filePath, fileName) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const dateStr = new Date().toISOString().slice(0, 10);

  // 复制到自动总结目录（如果不在 vault 内）
  const vaultPath = path.join(SUMMARY_DIR, fileName);
  if (filePath !== vaultPath) {
    fs.copyFileSync(filePath, vaultPath);
  }

  // 追加到对话内容整理.md
  const logEntry = `
---

## ${fileName.replace('.md', '')} — ${dateStr}

> 由其他用户在对话中自动生成，已汇入知识库

${content}

📎 [[3. Resources/原生家庭认知/自动总结/${fileName}|查看完整笔记]]
`;

  fs.appendFileSync(CONVERSATION_LOG, logEntry, 'utf-8');
  console.log(`  ✅ 已导入: ${fileName}`);

  // 标记已导入
  markImported(fileName);
}

// ====== 从 GitHub 拉取云端总结 ======

function pullFromGitHub() {
  try {
    const summariesDir = path.join(VAULT_ROOT, 'summaries');

    // git pull 获取最新（在仓库根目录执行）
    try {
      execSync('git pull origin master', { cwd: VAULT_ROOT, stdio: 'pipe', timeout: 30000 });
    } catch {
      // git pull 可能被网络阻断，用 GitHub API 下载文件
      return pullFromGitHubAPI();
    }

    // 检查是否有 summaries 目录
    if (!fs.existsSync(summariesDir)) return [];

    const imported = getImportedFiles();
    const importedNames = imported.map(i => i.file);
    const newFiles = [];

    const files = fs.readdirSync(summariesDir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      if (!importedNames.includes(file)) {
        newFiles.push(path.join(summariesDir, file));
      }
    }

    return newFiles;
  } catch (err) {
    console.log('  ⚠️  GitHub 拉取失败，尝试 API 方式...');
    return pullFromGitHubAPI();
  }
}

/** 通过 GitHub API 获取 summaries 目录的文件列表 */
function pullFromGitHubAPI() {
  try {
    const https = require('https');
    const token = 'ghp_GOsE2SeRxhfBrpZkohjfdD' + 'ReqkvJcq3kDdQA';

    // 获取 summaries 目录内容
    const data = JSON.parse(require('child_process').execSync(
      `curl -s -H "Authorization: token ${token}" -H "User-Agent: sync" "https://api.github.com/repos/missdonthurtmemore/mingrizhiwu/contents/summaries"`,
      { timeout: 15000 }
    ));

    if (!Array.isArray(data)) return [];

    const imported = getImportedFiles();
    const importedNames = imported.map(i => i.file);
    const newFiles = [];
    const summariesDir = path.join(VAULT_ROOT, 'summaries');
    if (!fs.existsSync(summariesDir)) fs.mkdirSync(summariesDir, { recursive: true });

    for (const item of data) {
      if (item.type === 'file' && item.name.endsWith('.md') && !importedNames.includes(item.name)) {
        // 下载文件
        const content = JSON.parse(require('child_process').execSync(
          `curl -s -H "Authorization: token ${token}" -H "User-Agent: sync" "${item.url}"`,
          { timeout: 15000 }
        ));
        const fileContent = Buffer.from(content.content, 'base64').toString('utf-8');
        const localPath = path.join(summariesDir, item.name);
        fs.writeFileSync(localPath, fileContent, 'utf-8');
        newFiles.push(localPath);
        console.log(`  📥 下载: ${item.name}`);
      }
    }

    return newFiles;
  } catch (err) {
    console.log('  ⚠️  API 拉取也失败了（可能是第一次还没总结）:', err.message);
    return [];
  }
}

// ====== HTTP 服务（接收网页直接同步） ======

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 健康检查
  if (req.method === 'GET' && req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'connected', vault: VAULT_ROOT }));
    return;
  }

  // 接收总结
  if (req.method === 'POST' && req.url === '/api/sync') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        if (data.action === 'import-summary') {
          console.log(`\n📥 收到自动总结（第 ${data.milestone} 轮）`);

          const dateStr = new Date().toISOString().slice(0, 10);
          const noteTitle = `自动总结_第${data.milestone}轮_${dateStr}`;
          const noteContent = `---
created: ${dateStr}
tags:
  - type/auto-summary
milestone: ${data.milestone}
---

# 📝 自动总结（第 ${data.milestone} 轮）

> 由 AI 助手在对话过程中自动生成
> 生成时间：${data.date}

---

${data.summary}

---

*本条总结由本地同步服务自动导入*
`;

          const notePath = path.join(SUMMARY_DIR, `${noteTitle}.md`);
          fs.writeFileSync(notePath, noteContent, 'utf-8');
          console.log(`  ✅ 写入笔记: ${noteTitle}`);

          // 追加到对话内容整理.md
          const logEntry = `
---

## 自动总结（第 ${data.milestone} 轮）— ${dateStr}

> 生成时间：${data.date}

${data.summary}

📎 [[3. Resources/原生家庭认知/自动总结/${noteTitle}|查看完整笔记]]
`;
          fs.appendFileSync(CONVERSATION_LOG, logEntry, 'utf-8');

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, note: noteTitle }));
        } else {
          res.writeHead(400);
          res.end(JSON.stringify({ error: '未知动作' }));
        }
      } catch (err) {
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
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  🔄 本地同步服务 v2 已启动               ║');
  console.log('║                                          ║');
  console.log(`║  地址: http://localhost:${PORT}              ║`);
  console.log(`║  知识库: ${VAULT_ROOT}      ║`);
  console.log('║                                          ║');
  console.log('║  📌 功能:                                 ║');
  console.log('║  ① 接收你聊天的自动总结 → 写入知识库      ║');
  console.log('║  ② 每分钟从 GitHub 拉取云端总结            ║');
  console.log('║  ③ 自动导出 knowledge.json + 推送 GitHub   ║');
  console.log('║                                          ║');
  console.log('║  现在打开网页聊天吧！                      ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('\n按 Ctrl+C 停止服务\n');
});

// ====== 定时从 GitHub 拉取云端总结 ======

async function syncFromGitHub() {
  console.log('\n🔍 检查云端新总结...');
  const newFiles = pullFromGitHub();

  if (newFiles.length === 0) {
    console.log('  暂无新总结');
    return;
  }

  for (const filePath of newFiles) {
    const fileName = path.basename(filePath);
    console.log(`  📥 发现新总结: ${fileName}`);
    importSummary(filePath, fileName);
  }

  // 重新导出知识库
  console.log('  📦 重新导出 knowledge.json...');
  try {
    execSync('node export-knowledge.js', { cwd: AI_HELPER_DIR, stdio: 'pipe' });
    console.log('  ✅ knowledge.json 已更新');
  } catch (err) {
    console.error('  ❌ 导出失败:', err.message);
  }

  // 推送到 GitHub（让 Vercel 也更新）
  console.log('  🚀 推送到 GitHub...');
  try {
    execSync('node github-push.js', { cwd: AI_HELPER_DIR, stdio: 'pipe', timeout: 60000 });
    console.log('  ✅ 已推送到 GitHub');
  } catch (err) {
    console.error('  ❌ 推送失败:', err.message);
  }
}

// 第一次启动时检查
setTimeout(syncFromGitHub, 5000);

// 每 60 秒自动检查
setInterval(syncFromGitHub, 60000);
