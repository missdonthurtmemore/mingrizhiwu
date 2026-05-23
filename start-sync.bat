@echo off
echo ================================
echo  🔄 启动本地同步服务
echo ================================
echo.
echo 启动后，网页的自动总结将自动写入 Obsidian 知识库
echo 按 Ctrl+C 停止服务
echo.
cd /d "%~dp0"
node sync-server.js
pause
