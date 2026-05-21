# 🌱 原生家庭疗愈助手

一个温柔倾听、懂得陪伴的 AI 对话助手，基于 DeepSeek API。

## 如何部署

### 1. 获取 DeepSeek API 密钥

1. 访问 [platform.deepseek.com](https://platform.deepseek.com)，手机号注册
2. 点击左侧「API Keys」→「创建 API Key」
3. 复制生成的密钥（新用户自动送 500 万 token，够用很久）

### 2. 部署到 Vercel（免费）

1. 将 `ai-helper/` 文件夹上传到你的 GitHub 仓库
2. 访问 [vercel.com](https://vercel.com)，用 GitHub 账号登录
3. 点击「Add New」→「Project」
4. 选择你上传的仓库
5. 「Framework Preset」选择「Other」
6. 点击「Deploy」
7. 部署完成后，访问生成的 URL 即可使用

### 3. 在网站中输入 API 密钥

首次打开网站时，输入你的 DeepSeek API 密钥即可开始对话。

> API 密钥只存储在浏览器的本地存储中，不会上传到任何服务器。

## 更新知识库

当你更新了 Obsidian 知识库的笔记后：

```bash
cd ai-helper
node export-knowledge.js
```

然后重新提交并部署到 Vercel 即可。

## 技术栈

- 纯前端：HTML + CSS + JavaScript
- AI：DeepSeek API（deepseek-chat 模型）
- 托管：Vercel（免费）
- 知识库：从 Obsidian 导出的 JSON 文件
