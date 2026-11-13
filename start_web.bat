@echo off
chcp 65001 > nul
title FrameStudio - 비디오 프레임 추출
echo ===================================================
echo [FrameStudio] 비디오 프레임 추출 웹 실행 중...
echo 주소: http://localhost:8080
echo ===================================================

REM 이전에 이미 켜져 있던 8080 포트 프로세스 스스로 닫기
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr /r ":8080 " ^| findstr LISTENING') do (
    taskkill /PID %%a /F >nul 2>&1
)

start chrome http://localhost:8080 2>nul || start http://localhost:8080
python server.py
pause
