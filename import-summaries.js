/**
 * 导入自动总结到 Obsidian 知识库
 * 用法：
 *   1. 在网页上点「导出全部总结」下载 .md 文件
 *   2. 将下载的文件放到 ai-helper/ 目录下
 *   3. 运行: node import-summaries.js <文件名>
 *
 * 示例: node import-summaries.js 自动总结_2026-05-23.md
 */

const fs = require('fs');
const path = require('path');

// ====== 配置 ======
const VAULT_ROOT = path.resolve(__dirname, '..'); // Obsidian 知识库根目录
const CONVERSATION_LOG = path.join(VAULT_ROOT, '对话内容整理.md');

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('📖 用法: node import-summaries.js <导出文件名>');
    console.log('   示例: node import-summaries.js 自动总结_2026-05-23.md');
    console.log('\n📁 当前目录下的 .md 文件:');
    const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.md'));
    files.forEach(f => console.log(`   ${f}`));
    process.exit(0);
  }

  const filePath = path.resolve(__dirname, args[0]);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ 文件不存在: ${filePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  // 解析每个总结块（按 ## 标题分割）
  const sections = [];
  let currentSection = null;

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (currentSection) sections.push(currentSection);
      currentSection = { title: line.replace('## ', '').trim(), body: '' };
    } else if (currentSection) {
      currentSection.body += line + '\n';
    }
  }
  if (currentSection) sections.push(currentSection);

  if (sections.length === 0) {
    console.log('⚠️  未找到总结内容');
    process.exit(0);
  }

  console.log(`📦 找到 ${sections.length} 条总结`);

  // 追加到 对话内容整理.md
  let appendContent = `\n---\n\n## 自动总结（${new Date().toISOString().slice(0, 10)}）\n\n`;
  appendContent += `> 以下内容由 AI 助手在对话过程中自动生成\n\n`;

  for (const sec of sections) {
    appendContent += `### ${sec.title}\n\n`;
    appendContent += `${sec.body.trim()}\n\n`;
  }

  fs.appendFileSync(CONVERSATION_LOG, appendContent, 'utf-8');
  console.log(`✅ 已追加到: 对话内容整理.md`);
  console.log(`📝 共导入 ${sections.length} 条自动总结`);
}

main();
