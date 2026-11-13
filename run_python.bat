@echo off
chcp 65001 > nul
echo ===================================================
echo [Python Frame Extractor] 비디오 프레임 추출기
echo ===================================================

echo 의존성 패키지(OpenCV) 확인 중...
python -c "import cv2" 2>nul
if %errorlevel% neq 0 (
    echo OpenCV가 설치되어 있지 않습니다. 자동 설치를 진행합니다...
    pip install -r requirements.txt
    if %errorlevel% neq 0 (
        echo [오류] 패키지 설치에 실패했습니다. 파이썬 환경을 확인해주세요.
        pause
        exit /b
    )
)

echo.
echo 파일 선택 창을 엽니다. 비디오 파일을 선택해주세요...
python extract_frames.py
echo.
pause
