/**
 * 导出知识库脚本
 * 用法: node export-knowledge.js
 *
 * 这个脚本会读取 Obsidian 知识库中的 .md 文件，
 * 转换成 AI 助手能用的 knowledge.json 文件。
 * 当你更新了知识库笔记后，重新运行它即可更新助手。
 */

const fs = require('fs');
const path = require('path');

// 知识库根目录（Obsidian vault 路径）
const VAULT_PATH = path.resolve(__dirname, '..');

// 要导出的文件夹路径（按优先级排序）
const SECTIONS = [
  {
    id: 'my-story',
    title: '创建者的故事',
    dir: '3. Resources/我的故事',
    description: '一个从原生家庭伤痛中走出来的人的真实经历'
  },
  {
    id: 'family-origin',
    title: '原生家庭认知',
    dir: '3. Resources/原生家庭认知',
    description: '原生家庭的概念、影响机制、依恋理论等'
  },
  {
    id: 'mental-health',
    title: '心理健康',
    dir: '2. Areas/心理健康',
    description: '情绪管理、自我关怀、疗愈方法'
  },
  {
    id: 'family-education',
    title: '家庭教育',
    dir: '2. Areas/家庭教育',
    description: '亲子沟通技巧、关系修复方法'
  },
  {
    id: 'trauma-healing',
    title: '创伤与疗愈',
    dir: '3. Resources/创伤与疗愈',
    description: '理解创伤反应、创伤后成长'
  },
  {
    id: 'auto-summaries',
    title: '对话自动总结',
    dir: '3. Resources/原生家庭认知/自动总结',
    description: 'AI 助手在对话过程中自动生成的总结',
    excludeEmpty: true
  }
];

// 解析 .md 文件，去掉 frontmatter，只取正文
function parseMarkdown(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');

  // 去掉 YAML frontmatter (--- 之间的内容)
  const withoutFrontmatter = content.replace(/^---[\s\S]*?---\n*/, '');

  // 提取标题（第一个 # 开头的行）
  const titleMatch = withoutFrontmatter.match(/^# (.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : path.basename(filePath, '.md');

  // 去掉标题行，取正文
  const body = withoutFrontmatter.replace(/^# .+\n*/, '').trim();

  // 提取标签
  const tags = [];
  const tagRegex = /#([\w-\/]+)/g;
  let match;
  while ((match = tagRegex.exec(content)) !== null) {
    tags.push(match[1]);
  }

  return { title, body, tags };
}

// 主函数
function exportKnowledge() {
  const knowledge = {
    version: '1.0',
    lastUpdated: new Date().toISOString().split('T')[0],
    about: '原生家庭疗愈知识库 - 供 AI 助手使用的知识文件',
    sections: [],
    // 一些关键概念速查
    keyConcepts: [
      { term: '原生家庭', summary: '一个人出生和成长的家庭，是你认识世界的第一扇窗' },
      { term: '内在批判者', summary: '你脑子里的那个说你"不够好"的声音，它不是真相' },
      { term: '刮骨', summary: '直面深入骨子里的恐惧和自卑，一点一点刮掉——这是创建者自己的比喻' },
      { term: '躯体化反应', summary: '内心的感受无法被表达时，身体替它说话（头痛、胃痛、心脏痛等）' },
      { term: '代际传递', summary: '家庭的行为和情绪模式不知不觉从上一代传到下一代' },
      { term: '依恋理论', summary: '早期的亲子关系会成为你一生人际关系的模板' },
      { term: '创伤反应', summary: '面对威胁时，人的四种生存反应：战、逃、僵、讨好' }
    ],
    // 核心方法
    keyMethods: [
      {
        name: '找到你喜欢的事',
        steps: [
          '不用急着解决所有问题，先去找一件你喜欢的事',
          '因为喜欢，你会有勇气去做',
          '因为去做了，你不得不面对恐惧',
          '面对了，恐惧就变小了',
          '你不是变勇敢了，是你有了值得勇敢的理由'
        ]
      },
      {
        name: '刮骨法',
        steps: [
          '承认你骨子里的恐惧和自卑',
          '不要试图戴面具掩盖它',
          '一点一点去面对，去刮掉',
          '这个过程很痛，但只有这样才能真正改变'
        ]
      },
      {
        name: '硬着头皮法',
        steps: [
          '不要等不害怕了再去做',
          '先去做，做了才不害怕',
          '恐惧不会自己消失，但会在行动中变小'
        ]
      },
      {
        name: '阅读疗愈',
        steps: [
          '找一本关于你正在经历的痛的书',
          '不用全部读完，一句话有用就够了',
          '边读边对照自己：这说的是我吗？',
          '理解了，就不怕了'
        ]
      }
    ],
    // 创建者的核心语录
    quotes: [
      '走出痛苦的唯一办法是直面痛苦。',
      '我不是变勇敢了，是我找到了一个让我愿意勇敢的理由。',
      '这可不是戴一张人皮面具那么简单，这是刮骨——直面你骨头深处的苦楚，一点一点地刮掉。',
      '我从小到大哪儿经历过无条件的爱，吃口饭都说"多吃点，好好学习将来天天都能吃"。',
      '人生就是活出一种让自己舒服的生活状态。',
      '不是先变勇敢再去做，是因为喜欢，才有勇气去做。',
      '人大部分的恐惧都来源于未知，当我们清楚知道了害怕的东西具体是什么，就不再害怕了。',
      '你不需要通过消失来解决问题。',
      '真正的自由是有能力满足自己的情绪。',
      '我不是走出来了——我是扛过来了，然后发现路上慢慢有了光。',
      '我仍然会难受，但我不再想死了。这是我给自己最好的礼物。'
    ]
  };

  // 读取每个板块
  for (const section of SECTIONS) {
    const sectionPath = path.join(VAULT_PATH, section.dir);

    if (!fs.existsSync(sectionPath)) {
      console.log(`⚠ 目录不存在，跳过: ${sectionPath}`);
      continue;
    }

    const files = fs.readdirSync(sectionPath)
      .filter(f => f.endsWith('.md') && !f.startsWith('_MOC'))
      .sort();

    const notes = [];
    for (const file of files) {
      const filePath = path.join(sectionPath, file);
      try {
        const parsed = parseMarkdown(filePath);
        notes.push({
          fileName: file,
          title: parsed.title,
          content: parsed.body,
          tags: parsed.tags
        });
        console.log(`  ✓ ${file}`);
      } catch (err) {
        console.log(`  ✗ ${file}: ${err.message}`);
      }
    }

    // 如果是可选的空板块（如自动总结目录），没有笔记时跳过
    if (section.excludeEmpty && notes.length === 0) {
      continue;
    }

    knowledge.sections.push({
      id: section.id,
      title: section.title,
      description: section.description,
      notes: notes
    });
  }

  // 写入文件
  const outputPath = path.join(__dirname, 'knowledge.json');
  fs.writeFileSync(outputPath, JSON.stringify(knowledge, null, 2), 'utf-8');
  console.log(`\n✅ 知识库已导出到: ${outputPath}`);
  console.log(`   共 ${knowledge.sections.reduce((s, sec) => s + sec.notes.length, 0)} 篇笔记`);
}

exportKnowledge();
