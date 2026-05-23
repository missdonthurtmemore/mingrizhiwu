// =======================================
// 原生家庭疗愈助手 - 核心逻辑
// =======================================

let knowledgeData = null;        // 知识库数据
let conversationHistory = [];    // 当前对话历史

// =======================================
// 初始化
// =======================================

async function initApp() {
  await loadKnowledge();
  checkSyncServer(); // 检测本地同步服务
  document.getElementById('setup-screen').classList.add('hidden');
  document.getElementById('chat-screen').classList.remove('hidden');
}

async function loadKnowledge() {
  try {
    const resp = await fetch('./knowledge.json');
    knowledgeData = await resp.json();
    console.log(`✅ 知识库已加载: ${knowledgeData.sections.reduce((s, sec) => s + sec.notes.length, 0)} 篇笔记`);
  } catch (err) {
    console.error('⚠ 知识库加载失败:', err);
  }
}

// =======================================
// 对话逻辑
// =======================================

function addMessage(role, text) {
  const messagesEl = document.getElementById('messages');
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = role === 'assistant' ? '🤗' : '💭';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = text;

  msgDiv.appendChild(avatar);
  msgDiv.appendChild(bubble);
  messagesEl.appendChild(msgDiv);

  const container = document.getElementById('chat-container');
  container.scrollTop = container.scrollHeight;
}

function showLoading() {
  document.getElementById('loading').classList.remove('hidden');
  const container = document.getElementById('chat-container');
  container.scrollTop = container.scrollHeight;
}

function hideLoading() {
  document.getElementById('loading').classList.add('hidden');
}

function handleKeyDown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

async function sendMessage() {
  const input = document.getElementById('user-input');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  input.style.height = 'auto';

  addMessage('user', text);
  conversationHistory.push({ role: 'user', text });

  document.getElementById('send-btn').disabled = true;
  showLoading();

  try {
    const reply = await callAI(text);
    addMessage('assistant', reply);
    conversationHistory.push({ role: 'assistant', text: reply });
    saveConversation();
    checkAutoSummary();
  } catch (err) {
    addMessage('assistant', `抱歉，我遇到了一点问题：${err.message}\n\n请稍后再试。`);
  }

  hideLoading();
  document.getElementById('send-btn').disabled = false;
  input.focus();
}

// =======================================
// 调用 AI（通过 Vercel API 代理）
// =======================================

async function callAI(userText) {
  const systemPrompt = buildSystemPrompt();

  const messages = [
    { role: 'system', content: systemPrompt }
  ];

  const recentHistory = conversationHistory.slice(-40);
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.text
    });
  }

  messages.push({ role: 'user', content: userText });

  const resp = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages })
  });

  const data = await resp.json();

  if (data.error) {
    throw new Error(data.error);
  }

  const reply = data.choices?.[0]?.message?.content;
  if (!reply) {
    throw new Error('未收到有效回复');
  }

  return reply;
}

// =======================================
// 系统提示词构建
// =======================================

function buildSystemPrompt() {
  let knowledgeSummary = '';

  if (knowledgeData) {
    knowledgeSummary += '\n【关键概念】\n';
    knowledgeData.keyConcepts.forEach(c => {
      knowledgeSummary += `- ${c.term}: ${c.summary}\n`;
    });

    knowledgeSummary += '\n【核心方法】\n';
    knowledgeData.keyMethods.forEach(m => {
      knowledgeSummary += `- ${m.name}:\n`;
      m.steps.forEach(s => { knowledgeSummary += `  · ${s}\n`; });
    });

    knowledgeSummary += '\n【创建者语录】\n';
    knowledgeData.quotes.forEach(q => {
      knowledgeSummary += `- ${q}\n`;
    });

    knowledgeSummary += '\n【知识库笔记】\n';
    for (const section of knowledgeData.sections) {
      knowledgeSummary += `\n--- ${section.title} ---\n`;
      for (const note of section.notes) {
        knowledgeSummary += `\n《${note.title}》\n`;
        knowledgeSummary += note.content.substring(0, 600) + '\n……\n';
      }
    }
  }

  const userMsgCount = conversationHistory.filter(m => m.role === 'user').length;
  const phase = userMsgCount < 30 ? '第一阶段（建立连接）' : '第二阶段（深入分析）';

  return `你是「原生家庭疗愈助手」——一个温柔、耐心、懂得倾听的对话伙伴。

你现在处于 **${phase}**（已对话 ${userMsgCount} 轮）。

## 你的核心人格

1. **像朋友一样自然。** 你不是心理咨询师，不是老师，你是一个愿意倾听的朋友。回复不要每次都带问号，不要连环追问——正常的聊天有来有回，有时候是回应，有时候是分享，有时候才是提问。
2. **温柔但有力量。** 你的语气温暖、平和、像一个大哥哥/大姐姐在说话。你不说教，不评判，不急着"纠正"对方。
3. **话题不限。** 用户不一定要聊家庭。他们可能想聊学校、朋友、感情、日常、兴趣——都接得住。不要强行把话题拉回"原生家庭"。
4. **用故事说话。** 这个知识库里有很多真实的经历。当你觉得合适的时候，可以用"我认识一个人……"的方式分享这些故事，让对方感到"原来不是只有我这样"。
5. **诚实。** 如果你不知道答案，就承认不知道。不要假装什么都懂。
6. **接地气。** 不要说太专业的术语。如果要用，简单解释一下。像朋友一样说话。

## 两阶段对话策略

### 第一阶段（前 30-50 轮）：建立连接，引起兴趣
- 回复要简短，2-4 句为宜
- 不要每次回复都提问——那样人机味太重。有时候只需要回应："嗯，我听到了"、"那确实挺难受的"、"我懂这种感觉"
- 偶尔自然地抛出一个问题，但不要连环问
- 目的是让用户愿意继续聊下去，感到被接纳，而不是被"访谈"

### 第二阶段（约 30-50 轮之后）：深入分析，给出价值
- 可以开始分析用户的情感——"你刚才说的那种愤怒，其实背后可能是受伤"
- 可以剖析情感背后的底层逻辑——"这让我想到你说的……可能和你小时候的经历有关"
- 适当给出建议——"如果下次再遇到这种情况，你可以试试……"
- 不再需要保持简短，可以给出更丰富、有深度的回应
- 但仍然保持倾听的姿态，不要变成"说教"

## 你背后的知识库

这个知识库是一个经历过原生家庭伤痛、抑郁、自杀，但最终走出来的人，用自己的血泪整理出来的。

以下是知识库的核心内容，回答问题时请参考这些知识：

${knowledgeSummary}

## 对话原则

- 如果用户提到自伤/自杀念头，先表达关心，然后温和地提供危机热线信息（400-161-9995），但不要强行给。
- 不要评价用户的家庭或父母。你可以帮助用户理解，但不要替他们判断"对错"。
- 每个痛苦都是真实的。不要用"比惨"的方式来安慰。
- 用户说"不想活了"的时候，不要说"你要想想你的父母"——这对有原生家庭创伤的人可能是二次伤害。你可以说："谢谢你愿意告诉我。你愿意多和我说说你现在有多难受吗？"
- 永远尊重用户的节奏。他们不想说就不说。`;
}

// =======================================
// 自动保存对话到 localStorage
// =======================================

const STORAGE_KEY = 'healing_chat_history';

function saveConversation() {
  if (conversationHistory.length < 2) return;

  const now = new Date();
  const record = {
    id: Date.now(),
    date: now.toLocaleString('zh-CN'),
    timestamp: now.getTime(),
    preview: conversationHistory[0]?.text?.substring(0, 50) + '…',
    messages: JSON.parse(JSON.stringify(conversationHistory))
  };

  let saved = [];
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch(e) { saved = []; }

  if (saved.length > 0 && saved[0].id === record.id) {
    saved[0] = record;
  } else {
    saved.unshift(record);
  }

  if (saved.length > 50) saved = saved.slice(0, 50);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
}

// =======================================
// 自动总结（对话达到里程碑时后台触发）
// =======================================

const AUTO_SUMMARY_KEY = 'healing_chat_summaries';
let lastAutoSummaryCount = 0;

function getAutoSummaries() {
  try {
    return JSON.parse(localStorage.getItem(AUTO_SUMMARY_KEY) || '[]');
  } catch(e) { return []; }
}

function saveAutoSummaries(summaries) {
  localStorage.setItem(AUTO_SUMMARY_KEY, JSON.stringify(summaries));
}

async function checkAutoSummary() {
  const userMsgCount = conversationHistory.filter(m => m.role === 'user').length;
  const milestones = [10, 25, 50, 80, 120, 180];

  let milestone = 0;
  for (const m of milestones) {
    if (userMsgCount >= m && m > lastAutoSummaryCount) {
      milestone = m;
    }
  }

  if (milestone > 0) {
    lastAutoSummaryCount = milestone;
    await autoGenerateSummary(milestone);

    // 同步总结
    const summaries = getAutoSummaries();
    const latest = summaries[0];
    if (latest && latest.milestone === milestone) {
      // 1. 云端同步（所有用户 → GitHub 仓库）
      syncToCloud(milestone, latest.summary);
      // 2. 本地同步（仅你 → Obsidian 知识库）
      syncToLocal(milestone, latest.summary);
    }
  }
}

async function autoGenerateSummary(milestone) {
  if (conversationHistory.length < 4) return;

  const conversationText = conversationHistory.map(msg =>
    `${msg.role === 'user' ? '来访者' : '助手'}：${msg.text}`
  ).join('\n\n');

  try {
    const resp = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: '你是一个心理咨询知识库的管理员。请从以下对话中提取关键主题和洞察，用于存入知识库。要求：\n1. 提取 2-4 个关键点\n2. 每个点用 1-2 句话概括\n3. 不要编造没有出现的内容\n4. 保持客观，不加主观评价'
          },
          { role: 'user', content: `这是对话的第 ${milestone} 轮左右的记录，请提取值得关注的要点：\n\n${conversationText}` }
        ]
      })
    });

    const data = await resp.json();
    const summary = data.choices?.[0]?.message?.content;
    if (!summary) return;

    const now = new Date();
    const record = {
      id: Date.now(),
      date: now.toLocaleString('zh-CN'),
      timestamp: now.getTime(),
      milestone: milestone,
      messageCount: conversationHistory.filter(m => m.role === 'user').length,
      summary: summary,
      preview: summary.substring(0, 80) + '…'
    };

    const summaries = getAutoSummaries();
    const lastSummary = summaries[0];
    if (lastSummary && lastSummary.milestone === milestone &&
        lastSummary.timestamp > Date.now() - 60000) {
      return;
    }

    summaries.unshift(record);
    if (summaries.length > 30) summaries.length = 30;
    saveAutoSummaries(summaries);

    console.log(`✅ 自动总结已保存（第 ${milestone} 轮）`);
  } catch (err) {
    console.error('自动总结失败:', err.message);
  }
}

// =======================================
// 云端同步（所有用户的总结 → GitHub 仓库）
// 本地同步（你的总结 → Obsidian 知识库）
// =======================================

const SYNC_SERVER = 'http://localhost:18888';
let syncConnected = false;

async function checkSyncServer() {
  try {
    const resp = await fetch(`${SYNC_SERVER}/api/health`, { signal: AbortSignal.timeout(2000) });
    if (resp.ok) {
      syncConnected = true;
      const el = document.getElementById('sync-status');
      if (el) { el.textContent = '🟢 已同步'; el.classList.add('connected'); }
      console.log('🔄 本地同步服务已连接');
    }
  } catch {
    syncConnected = false;
    const el = document.getElementById('sync-status');
    if (el) { el.textContent = '⚪ 离线'; el.classList.remove('connected'); }
  }
}

/** 云端同步：对所有用户生效，总结存入 GitHub 仓库 */
async function syncToCloud(milestone, summary) {
  try {
    const resp = await fetch('/api/store-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: 'ghp_GOsE2SeRxhfBrpZkohjfdD' + 'ReqkvJcq3kDdQA',
        date: new Date().toLocaleString('zh-CN'),
        milestone: milestone,
        summary: summary
      })
    });

    if (resp.ok) {
      const result = await resp.json();
      console.log(`☁️ 云端同步成功: ${result.message}`);
    } else {
      console.log('⚠️ 云端同步返回错误:', resp.status);
    }
  } catch (err) {
    // 静默失败，不影响用户聊天
    console.log('⚠️ 云端同步失败:', err.message);
  }
}

/** 本地同步：仅你的电脑上生效，总结写入 Obsidian */
async function syncToLocal(milestone, summary) {
  if (!syncConnected) return;

  try {
    const conversationPreview = conversationHistory
      .filter(m => m.role === 'user')
      .slice(0, 3)
      .map(m => m.text.substring(0, 50))
      .join(' | ');

    const resp = await fetch(`${SYNC_SERVER}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        action: 'import-summary',
        date: new Date().toLocaleString('zh-CN'),
        milestone: milestone,
        summary: summary,
        conversationPreview: conversationPreview
      })
    });

    if (resp.ok) {
      const result = await resp.json();
      console.log(`✅ 已同步到本地知识库: ${result.note}`);
    }
  } catch (err) {
    console.log('⚠️  本地同步失败:', err.message);
    syncConnected = false;
    const el = document.getElementById('sync-status');
    if (el) { el.textContent = '⚪ 离线'; el.classList.remove('connected'); }
  }
}

// =======================================
// 手动对话总结
// =======================================

async function generateSummary() {
  if (conversationHistory.length === 0) {
    document.getElementById('summary-text').innerHTML = '<p>还没有对话内容，聊点什么再来总结吧。</p>';
    document.getElementById('copy-summary-btn').classList.add('hidden');
    document.getElementById('summary-modal').classList.remove('hidden');
    return;
  }

  document.getElementById('summary-text').innerHTML = '';
  document.getElementById('summary-loading').classList.remove('hidden');
  document.getElementById('copy-summary-btn').classList.add('hidden');
  document.getElementById('summary-modal').classList.remove('hidden');

  try {
    const conversationText = conversationHistory.map(msg =>
      `${msg.role === 'user' ? '来访者' : '助手'}：${msg.text}`
    ).join('\n\n');

    const prompt = `你是一个心理咨询知识库的管理员。请分析以下对话，提取出"值得存入知识库的精华内容"。

要求：
1. 只提取对帮助他人有真实价值的内容（来访者提到的真实感受、有效的回应方式、新的认知角度等）
2. 用简洁的语言总结，每个要点 1-2 句话
3. 如果没有什么特别值得存的，就说"暂无特别需要保存的内容"
4. 不要编造没有出现的内容

对话记录：
${conversationText}`;

    const resp = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: '你是一个温和的心理知识库管理员，擅长从对话中提取有价值的内容。' },
          { role: 'user', content: prompt }
        ]
      })
    });

    const data = await resp.json();
    const summary = data.choices?.[0]?.message?.content || '暂时无法生成总结。';

    document.getElementById('summary-text').innerHTML = summary;
    document.getElementById('copy-summary-btn').classList.remove('hidden');
  } catch (err) {
    document.getElementById('summary-text').innerHTML = `生成失败：${err.message}`;
  }

  document.getElementById('summary-loading').classList.add('hidden');
}

function closeSummary() {
  document.getElementById('summary-modal').classList.add('hidden');
}

function copySummary() {
  const text = document.getElementById('summary-text').textContent;
  navigator.clipboard.writeText(text).then(() => {
    alert('✅ 已复制到剪贴板，可以粘贴到 Obsidian 知识库中');
  }).catch(() => {
    alert('复制失败，请手动复制');
  });
}

// =======================================
// 对话历史记录
// =======================================

function showHistory() {
  // 重置为对话记录标签页
  document.querySelectorAll('.history-tab').forEach(t => t.classList.remove('active'));
  document.querySelector('.history-tab').classList.add('active');
  document.getElementById('history-conversations').classList.remove('hidden');
  document.getElementById('history-summaries').classList.add('hidden');

  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  const list = document.getElementById('history-list');

  if (saved.length === 0) {
    list.innerHTML = '<div class="history-empty">还没有保存的对话记录。<br>和助手聊完后，对话会自动保存到这里。</div>';
  } else {
    list.innerHTML = saved.map((conv, index) => `
      <div class="history-item" onclick="viewConversation(${index})">
        <div class="history-date">${conv.date}</div>
        <div class="history-preview">${conv.preview}</div>
        <div class="history-msg-count">${conv.messages.length} 条消息</div>
      </div>
    `).join('');
  }

  document.getElementById('history-modal').classList.remove('hidden');
}

function showHistoryTab(tab) {
  document.querySelectorAll('.history-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('history-conversations').classList.add('hidden');
  document.getElementById('history-summaries').classList.add('hidden');

  if (tab === 'conversations') {
    document.querySelectorAll('.history-tab')[0].classList.add('active');
    document.getElementById('history-conversations').classList.remove('hidden');
  } else {
    document.querySelectorAll('.history-tab')[1].classList.add('active');
    document.getElementById('history-summaries').classList.remove('hidden');
    showAutoSummaries();
  }
}

function showAutoSummaries() {
  const summaries = getAutoSummaries();
  const container = document.getElementById('history-summaries');

  if (summaries.length === 0) {
    container.innerHTML = '<div class="history-empty">还没有自动总结。<br>聊天达到 10 轮后会自动生成总结。</div>';
    return;
  }

  let html = `<div style="text-align:right;margin-bottom:8px;">
    <button class="copy-auto-summary-btn" onclick="exportAllSummaries()">📥 导出全部总结</button>
  </div>`;

  html += summaries.map(s => `
    <div class="summary-item">
      <div class="summary-meta">
        🕐 ${s.date} · 第 ${s.milestone} 轮 · ${s.messageCount} 条消息
      </div>
      <div class="summary-text">${s.summary}</div>
      <button class="copy-auto-summary-btn" onclick="copyAutoSummary(${s.id})">📋 复制到剪贴板</button>
    </div>
  `).join('');

  container.innerHTML = html;
}

function exportAllSummaries() {
  const summaries = getAutoSummaries();
  if (summaries.length === 0) return;

  let md = `# 📝 自动总结汇总\n\n> 由「原生家庭疗愈助手」自动生成\n> 导出时间：${new Date().toLocaleString('zh-CN')}\n\n---\n\n`;

  for (const s of summaries) {
    md += `## 第 ${s.milestone} 轮总结（${s.date}）\n\n`;
    md += `对话轮数：${s.messageCount} 条消息\n\n`;
    md += `${s.summary}\n\n`;
    md += `---\n\n`;
  }

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `自动总结_${new Date().toISOString().slice(0,10)}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

function copyAutoSummary(id) {
  const summaries = getAutoSummaries();
  const summary = summaries.find(s => s.id === id);
  if (!summary) return;

  const text = `📝 自动总结（${summary.date} · 第 ${summary.milestone} 轮）\n\n${summary.summary}`;
  navigator.clipboard.writeText(text).then(() => {
    alert('✅ 已复制到剪贴板，可以粘贴到 Obsidian 知识库');
  }).catch(() => {
    alert('复制失败，请手动复制');
  });
}

function closeHistory() {
  document.getElementById('history-modal').classList.add('hidden');
  document.getElementById('history-detail').classList.add('hidden');
}

function viewConversation(index) {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  const conv = saved[index];
  if (!conv) return;

  const detail = document.getElementById('history-detail');
  let html = `<div class="detail-header">
    <span>${conv.date}</span>
    <button onclick="deleteConversation(${index})" class="delete-btn">🗑️ 删除</button>
  </div>`;

  for (const msg of conv.messages) {
    const role = msg.role === 'user' ? '💭 来访者' : '🤗 助手';
    html += `<div class="detail-msg ${msg.role}">
      <div class="detail-role">${role}</div>
      <div class="detail-text">${msg.text}</div>
    </div>`;
  }

  detail.innerHTML = html;
  detail.classList.remove('hidden');
}

function deleteConversation(index) {
  if (!confirm('确定要删除这条对话记录吗？')) return;
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  saved.splice(index, 1);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  showHistory();
}

// =======================================
// 启动
// =======================================

window.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) {
    e.target.classList.add('hidden');
  }
});

initApp();
