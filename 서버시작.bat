@echo off
chcp 65001 > nul
echo AI 자동 단가 검토 시스템 시작 중...
echo.
cd /d "%~dp0backend"
python -m uvicorn main:app --host 0.0.0.0 --port 8765 --reload
pause
