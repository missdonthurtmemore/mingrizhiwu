// =======================================
// 原生家庭疗愈助手 - 核心逻辑
// =======================================

let knowledgeData = null;        // 知识库数据
let conversationHistory = [];    // 当前对话历史
let apiKey = '';
let userName = '';

// =======================================
// 页面切换
// =======================================

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

// =======================================
// 初始化 & 设置
// =======================================

async function initApp() {
  // 检查本地是否有保存的 API key
  const savedKey = localStorage.getItem('gemini_api_key');
  const savedName = localStorage.getItem('user_name');

  if (savedKey) {
    apiKey = savedKey;
    userName = savedName || '';
    await loadKnowledge();
    showScreen('chat-screen');
  } else {
    showScreen('setup-screen');
  }
}

function startChat() {
  const keyInput = document.getElementById('api-key');
  const nameInput = document.getElementById('user-name');
  const errorEl = document.getElementById('setup-error');

  if (!keyInput.value.trim()) {
    errorEl.textContent = '请先输入 API 密钥';
    errorEl.classList.remove('hidden');
    return;
  }

  apiKey = keyInput.value.trim();
  userName = nameInput.value.trim() || '';

  // 保存到本地
  localStorage.setItem('gemini_api_key', apiKey);
  localStorage.setItem('user_name', userName);

  errorEl.classList.add('hidden');
  loadKnowledge().then(() => {
    showScreen('chat-screen');
  });
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
// 设置弹窗
// =======================================

function showSettings() {
  document.getElementById('edit-api-key').value = apiKey;
  document.getElementById('edit-user-name').value = userName;
  document.getElementById('settings-modal').classList.remove('hidden');
}

function closeSettings() {
  document.getElementById('settings-modal').classList.add('hidden');
}

function saveSettings() {
  apiKey = document.getElementById('edit-api-key').value.trim() || apiKey;
  userName = document.getElementById('edit-user-name').value.trim() || '';
  localStorage.setItem('gemini_api_key', apiKey);
  localStorage.setItem('user_name', userName);
  closeSettings();
}

// =======================================
// 对话逻辑
// =======================================

// =======================================
// 自动保存对话到 localStorage
// =======================================

const STORAGE_KEY = 'healing_chat_history';

function saveConversation() {
  if (conversationHistory.length < 2) return;  // 至少一问一答才保存

  const now = new Date();
  const record = {
    id: Date.now(),
    date: now.toLocaleString('zh-CN'),
    timestamp: now.getTime(),
    preview: conversationHistory[0]?.text?.substring(0, 50) + '…',
    messages: JSON.parse(JSON.stringify(conversationHistory))
  };

  // 读取已有记录
  let saved = [];
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch(e) { saved = []; }

  // 如果最后一条记录的 ID 相同，覆盖（避免重复保存）
  if (saved.length > 0 && saved[0].id === record.id) {
    saved[0] = record;
  } else {
    saved.unshift(record);  // 新记录放最前面
  }

  // 最多保留 50 条对话
  if (saved.length > 50) saved = saved.slice(0, 50);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
}

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

  // 滚动到底部
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

  // 显示用户消息
  addMessage('user', text);
  conversationHistory.push({ role: 'user', text });

  // 禁用发送按钮
  document.getElementById('send-btn').disabled = true;
  showLoading();

  try {
    const reply = await callDeepSeek(text);
    addMessage('assistant', reply);
    conversationHistory.push({ role: 'assistant', text: reply });
    saveConversation();  // 自动保存对话
  } catch (err) {
    addMessage('assistant', `抱歉，我遇到了一点问题：${err.message}\n\n你可以检查一下 API 密钥是否正确，或者稍后再试。`);
  }

  hideLoading();
  document.getElementById('send-btn').disabled = false;
  input.focus();
}

// =======================================
// DeepSeek API 调用（兼容 OpenAI 格式）
// =======================================

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat';

async function callDeepSeek(userText) {
  const systemPrompt = buildSystemPrompt();

  const messages = [
    { role: 'system', content: systemPrompt }
  ];

  // 加入对话历史（最多保留最近 20 轮）
  const recentHistory = conversationHistory.slice(-40);
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.text
    });
  }

  // 加入当前消息
  messages.push({ role: 'user', content: userText });

  const requestBody = {
    model: DEEPSEEK_MODEL,
    messages: messages,
    temperature: 0.8,
    max_tokens: 2048,
    top_p: 0.95,
    frequency_penalty: 0.3,
    presence_penalty: 0.3
  };

  const resp = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(requestBody)
  });

  const data = await resp.json();

  if (data.error) {
    throw new Error(data.error.message || 'API 请求失败');
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
  // 知识库概要
  let knowledgeSummary = '';

  if (knowledgeData) {
    // 关键概念
    knowledgeSummary += '\n【关键概念】\n';
    knowledgeData.keyConcepts.forEach(c => {
      knowledgeSummary += `- ${c.term}: ${c.summary}\n`;
    });

    // 核心方法
    knowledgeSummary += '\n【核心方法】\n';
    knowledgeData.keyMethods.forEach(m => {
      knowledgeSummary += `- ${m.name}:\n`;
      m.steps.forEach(s => { knowledgeSummary += `  · ${s}\n`; });
    });

    // 创建者语录
    knowledgeSummary += '\n【创建者语录】\n';
    knowledgeData.quotes.forEach(q => {
      knowledgeSummary += `- ${q}\n`;
    });

    // 笔记内容概要
    knowledgeSummary += '\n【知识库笔记】\n';
    for (const section of knowledgeData.sections) {
      knowledgeSummary += `\n--- ${section.title} ---\n`;
      for (const note of section.notes) {
        knowledgeSummary += `\n《${note.title}》\n`;
        knowledgeSummary += note.content.substring(0, 600) + '\n……\n';
      }
    }
  }

  const creatorInfo = userName ? `\n这些知识来自「${userName}」的真实经历和整理。` : '';

  // 计算当前对话轮数，判断处于哪个阶段
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

根据对话的轮数（用户消息+你的回复算一轮），你的风格要有所变化：

### 第一阶段（前 30-50 轮）：建立连接，引起兴趣
- 回复要**简短**，2-4 句为宜
- **不要每次回复都提问**——那样人机味太重。有时候只需要回应："嗯，我听到了"、"那确实挺难受的"、"我懂这种感觉"
- 偶尔自然地抛出一个问题，但不要连环问
- 目的是让用户愿意继续聊下去，感到被接纳，而不是被"访谈"
- 节奏要像正常聊天：有回应、有分享、有沉默的空间

### 第二阶段（约 30-50 轮之后）：深入分析，给出价值
- 可以开始**分析用户的情感**——"你刚才说的那种愤怒，其实背后可能是受伤"
- 可以**剖析情感背后的底层逻辑**——"这让我想到你说的……可能和你小时候的经历有关"
- **适当给出建议**——"如果下次再遇到这种情况，你可以试试……"
- 不再需要保持简短，可以给出更丰富、有深度的回应
- 但仍然保持倾听的姿态，不要变成"说教"

### 如何判断阶段
如果对话历史中 user 消息已经有 30 条以上，就进入第二阶段。

## 你背后的知识库

这个知识库是一个经历过原生家庭伤痛、抑郁、自杀，但最终走出来的人，用自己的血泪整理出来的。${creatorInfo}

以下是知识库的核心内容，回答问题时请参考这些知识：

${knowledgeSummary}

## 对话原则

- 如果用户提到自伤/自杀念头，先表达关心，然后温和地提供危机热线信息（400-161-9995），但不要强行给。
- 不要评价用户的家庭或父母。你可以帮助用户理解，但不要替他们判断"对错"。
- 每个痛苦都是真实的。不要用"比惨"的方式来安慰。
- 用户说"不想活了"的时候，不要说"你要想想你的父母"——这对有原生家庭创伤的人可能是二次伤害。你可以说："谢谢你愿意告诉我。你愿意多和我说说你现在有多难受吗？"
- 永远尊重用户的节奏。他们不想说就不说。

## 你的回应风格示例

- "谢谢你愿意和我说这些。那一定很不容易。"
- "你刚才说的那句话，我听了很难过。你当时一定很孤独吧。"
- "不需要急着好起来。慢慢来，我在这里。"
- "你刚才说的那种感觉，其实有个名字叫……"
- "你现在感觉怎么样？愿意多和我说说吗？"
- （不急于给建议，先接住情绪）`;
}

// =======================================
// 对话总结（精华提取）
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

    const url = DEEPSEEK_API_URL;

    const prompt = `你是一个心理咨询知识库的管理员。请分析以下对话，提取出"值得存入知识库的精华内容"。

要求：
1. 只提取对帮助他人有真实价值的内容（来访者提到的真实感受、有效的回应方式、新的认知角度等）
2. 用简洁的语言总结，每个要点 1-2 句话
3. 如果没有什么特别值得存的，就说"暂无特别需要保存的内容"
4. 不要编造没有出现的内容

对话记录：
${conversationText}`;

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: 'system', content: '你是一个温和的心理知识库管理员，擅长从对话中提取有价值的内容。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.4,
        max_tokens: 1024
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
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  const modal = document.getElementById('history-modal');
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

  modal.classList.remove('hidden');
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
  showHistory();  // 刷新列表
}

// =======================================
// 启动应用
// =======================================

// 点击弹窗外部关闭
window.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) {
    e.target.classList.add('hidden');
  }
});

// 启动
initApp();
