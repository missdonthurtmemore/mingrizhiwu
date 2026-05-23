# 🌱 原生家庭疗愈助手

一个温柔倾听、懂得陪伴的 AI 对话助手。
用户打开网页直接聊天，无需任何设置。

## 部署到 Vercel

1. **Fork 或上传** 这个仓库到你的 GitHub

2. **在 Vercel 中设置环境变量**
   - 访问 [vercel.com](https://vercel.com)，用 GitHub 登录
   - 点「Add New」→「Project」→ 导入此仓库
   - 在 **Environment Variables** 中添加：
     - 名称：`DEEPSEEK_API_KEY`
     - 值：你的 DeepSeek API 密钥
   - 点「Deploy」

3. **部署完成后**，访问生成的网址即可使用

## 更新知识库

在 Obsidian 中更新笔记后：

```bash
cd ai-helper
node export-knowledge.js
```

提交 `knowledge.json` 到 GitHub，Vercel 会自动重新部署。

## 技术栈

- 前端：HTML + CSS + JavaScript
- AI：DeepSeek API（通过 Vercel Serverless Function 代理）
- 托管：Vercel（免费）
