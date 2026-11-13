#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Video Frame Extractor (Python CLI & GUI Automation)
===================================================
동영상 파일에서 고화질 프레임 이미지를 자동으로 일괄 추출하는 자동화 도구입니다.

사용법:
  1) GUI 모드 (더블클릭 또는 인자 없이 실행 시 파일 선택 창이 뜹니다):
     python extract_frames.py

  2) CLI 모드 (시간 간격 지정 - 1초마다 1장):
     python extract_frames.py my_video.mp4 --interval 1.0

  3) CLI 모드 (균등하게 총 30장 추출):
     python extract_frames.py my_video.mp4 --count 30

  4) CLI 모드 (초당 프레임 FPS 지정):
     python extract_frames.py my_video.mp4 --fps 2 --format png
"""

import os
import sys
import argparse
from pathlib import Path

try:
    import cv2
except ImportError:
    print("[오류] OpenCV 패키지가 설치되어 있지 않습니다.")
    print("다음 명령어를 실행하여 설치해주세요:")
    print("pip install opencv-python\n")
    sys.exit(1)


def format_time_code(seconds: float) -> str:
    """초 단위를 00m00s00 포맷으로 변환"""
    minutes = int(seconds // 60)
    secs = int(seconds % 60)
    hundredths = int((seconds % 1) * 100)
    return f"{minutes:02d}m{secs:02d}s{hundredths:02d}"


def extract_frames(
    video_path: str,
    output_dir: str = None,
    mode: str = "interval",
    interval: float = 1.0,
    total_count: int = 30,
    target_fps: float = 1.0,
    img_format: str = "png",
    quality: int = 95,
    prefix: str = "frame",
    scene_threshold: float = 0.25,
    scene_min_duration: float = 0.8
):
    """비디오 파일에서 프레임을 추출하여 폴더에 저장합니다."""
    video_file = Path(video_path)
    if not video_file.exists():
        print(f"[오류] 비디오 파일을 찾을 수 없습니다: {video_path}")
        return

    # 출력 폴더 기본값 설정: output_<파일명>
    if not output_dir:
        output_dir = video_file.parent / f"output_{video_file.stem}"
    else:
        output_dir = Path(output_dir)

    output_dir.mkdir(parents=True, exist_ok=True)

    # 비디오 열기
    cap = cv2.VideoCapture(str(video_file))
    if not cap.isOpened():
        print(f"[오류] 비디오 파일을 열 수 없습니다: {video_path}")
        return

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / fps if fps > 0 else 0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    print("\n" + "=" * 60)
    print(f"🎬 동영상 정보: {video_file.name}")
    print(f" • 해상도: {width} x {height}")
    print(f" • 재생시간: {duration:.2f}초 ({int(duration//60)}분 {int(duration%60)}초)")
    print(f" • 원본 FPS: {fps:.2f} | 총 프레임: {total_frames:,}개")
    print(f" • 추출 모드: {mode.upper()}")
    print(f" • 저장 폴더: {output_dir.resolve()}")
    print("=" * 60)

    # 포맷 인코딩 파라미터
    save_params = []
    ext = img_format.lower().replace(".", "")
    if ext in ["jpg", "jpeg"]:
        save_params = [cv2.IMWRITE_JPEG_QUALITY, quality]
    elif ext == "webp":
        save_params = [cv2.IMWRITE_WEBP_QUALITY, quality]
    elif ext == "png":
        save_params = [cv2.IMWRITE_PNG_COMPRESSION, 3]

    saved_count = 0

    # =========================================================
    # 1. 장면 전환 감지 모드 (Scene Change Detection)
    # =========================================================
    if mode == "scene":
        print(f"🔍 영상 전체의 장면 전환(Scene Cut)을 자동 감지합니다...")
        print(f" • 감지 임계값: {scene_threshold*100:.0f}% 변화 | 최소 간격: {scene_min_duration}초\n")

        sample_step = 0.5  # 0.5초마다 검사
        last_captured_sec = -999.0
        prev_small_gray = None

        t = 0.0
        while t < duration:
            cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000.0)
            ret, frame = cap.read()
            if not ret:
                break

            # 고속 비교를 위해 80x45 흑백으로 다운스케일
            small_gray = cv2.cvtColor(cv2.resize(frame, (80, 45)), cv2.COLOR_BGR2GRAY)

            # 첫 프레임은 무조건 저장
            if prev_small_gray is None:
                saved_count += 1
                out_filename = f"{prefix}_scene{saved_count:04d}_{format_time_code(t)}.{ext}"
                cv2.imwrite(str(output_dir / out_filename), frame, save_params)
                last_captured_sec = t
                prev_small_gray = small_gray
            else:
                # 픽셀 평균 차이 계산 (0.0 ~ 1.0)
                diff = cv2.absdiff(prev_small_gray, small_gray)
                diff_score = float(diff.mean()) / 255.0

                time_since_last = t - last_captured_sec
                if time_since_last >= scene_min_duration and diff_score >= scene_threshold:
                    saved_count += 1
                    out_filename = f"{prefix}_scene{saved_count:04d}_{format_time_code(t)}.{ext}"
                    cv2.imwrite(str(output_dir / out_filename), frame, save_params)
                    last_captured_sec = t
                    prev_small_gray = small_gray

            pct = min(100.0, (t / max(0.1, duration)) * 100.0)
            bar = "█" * int(pct // 4) + "░" * (25 - int(pct // 4))
            print(f"\r[{bar}] {pct:5.1f}% | 감지된 장면: {saved_count}개 (시간: {t:5.1f}s)", end="", flush=True)

            t += sample_step

    # =========================================================
    # 2. 일반 타임스탬프 모드 (Interval, Count, FPS)
    # =========================================================
    else:
        target_times = []
        if mode == "interval":
            t = 0.0
            while t < duration:
                target_times.append(t)
                t += interval
        elif mode == "count":
            count = max(1, total_count)
            if count == 1:
                target_times.append(0.0)
            else:
                step = duration / (count - 1)
                for i in range(count):
                    target_times.append(min(duration - 0.01, i * step))
        elif mode == "fps":
            step = 1.0 / max(0.1, target_fps)
            t = 0.0
            while t < duration:
                target_times.append(t)
                t += step

        total_targets = len(target_times)
        print(f"총 추출 예정 이미지: {total_targets}장 (모드: {mode})\n")

        for idx, target_sec in enumerate(target_times, 1):
            cap.set(cv2.CAP_PROP_POS_MSEC, target_sec * 1000.0)
            ret, frame = cap.read()
            if not ret:
                continue

            time_str = format_time_code(target_sec)
            out_filename = f"{prefix}_{idx:04d}_{time_str}.{ext}"
            out_path = output_dir / out_filename

            cv2.imwrite(str(out_path), frame, save_params)
            saved_count += 1

            pct = (idx / total_targets) * 100
            bar = "█" * int(pct // 4) + "░" * (25 - int(pct // 4))
            print(f"\r[{bar}] {pct:5.1f}% ({saved_count}/{total_targets}) -> {out_filename}", end="", flush=True)

    cap.release()
    print(f"\n\n✨ 완료! 총 {saved_count}개의 이미지가 성공적으로 추출되었습니다.")
    print(f"📂 저장 경로: {output_dir.resolve()}\n")


def prompt_gui_file_selector():
    """인자가 없을 때 윈도우 파일 선택창을 띄웁니다."""
    import tkinter as tk
    from tkinter import filedialog

    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)

    file_path = filedialog.askopenfilename(
        title="프레임을 추출할 동영상 파일을 선택하세요",
        filetypes=[
            ("비디오 파일", "*.mp4;*.mkv;*.mov;*.webm;*.avi;*.flv;*.wmv"),
            ("모든 파일", "*.*")
        ]
    )
    return file_path


def main():
    parser = argparse.ArgumentParser(description="비디오 프레임 이미지 자동 추출 프로그램")
    parser.add_argument("video", nargs="?", help="입력 동영상 파일 경로 (생략 시 파일 선택창 오픈)")
    parser.add_argument("-o", "--output", help="출력 디렉토리 (기본값: output_<동영상명>)")
    parser.add_argument("-m", "--mode", choices=["interval", "count", "fps", "scene"], default="interval", help="추출 모드: interval(시간 간격), count(총 개수), fps(초당 프레임), scene(장면 전환 감지)")
    parser.add_argument("-i", "--interval", type=float, default=1.0, help="프레임 간격 (초 단위, 기본값: 1.0초)")
    parser.add_argument("-c", "--count", type=int, default=30, help="총 추출 개수 (기본값: 30장)")
    parser.add_argument("-f", "--fps", type=float, default=1.0, help="초당 프레임 수 (기본값: 1.0)")
    parser.add_argument("--scene-threshold", type=float, default=0.25, help="장면 전환 감지 임계값 (0.05 ~ 0.80, 기본값: 0.25 = 25%%)")
    parser.add_argument("--scene-min-duration", type=float, default=0.8, help="최소 장면 간격 초 단위 (기본값: 0.8초)")
    parser.add_argument("--format", choices=["png", "jpg", "jpeg", "webp"], default="png", help="저장 이미지 포맷 (기본값: png)")
    parser.add_argument("-q", "--quality", type=int, default=95, help="JPG/WEBP 압축 화질 (1-100, 기본값: 95)")
    parser.add_argument("-p", "--prefix", default="frame", help="파일명 접두사 (기본값: frame)")

    args = parser.parse_args()

    video_path = args.video
    if not video_path:
        print("동영상 파일 경로 인자가 지정되지 않았습니다. 파일 선택창을 엽니다...")
        video_path = prompt_gui_file_selector()
        if not video_path:
            print("선택이 취소되었습니다. 프로그램을 종료합니다.")
            return

    # 웹 URL (유튜브/웹 링크)인 경우 자동 다운로드 처리
    if video_path.startswith(('http://', 'https://')):
        print(f"\n🌐 웹 동영상 링크 감지: {video_path}")
        try:
            import yt_dlp
            temp_dir = Path("./temp_downloads")
            temp_dir.mkdir(exist_ok=True)
            print("yt-dlp를 통해 동영상을 다운로드 중입니다...")
            ydl_opts = {
                'format': 'bestvideo[vcodec^=avc]+bestaudio[ext=m4a]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best',
                'outtmpl': str(temp_dir / '%(id)s.%(ext)s'),
                'merge_output_format': 'mp4',
                'overwrites': True,
                'quiet': False
            }
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(video_path, download=True)
                expected_fn = ydl.prepare_filename(info)
                base_no_ext = os.path.splitext(expected_fn)[0]
                if not os.path.exists(expected_fn) and os.path.exists(base_no_ext + '.mp4'):
                    video_path = base_no_ext + '.mp4'
                else:
                    video_path = expected_fn
                print(f"다운로드 완료: {video_path}\n")
        except ImportError:
            print("[오류] 웹 링크 처리를 위해서는 yt-dlp 패키지가 필요합니다: pip install yt-dlp")
            return
        except Exception as e:
            print(f"[오류] 영상 다운로드 실패: {e}")
            return

    extract_frames(
        video_path=video_path,
        output_dir=args.output,
        mode=args.mode,
        interval=args.interval,
        total_count=args.count,
        target_fps=args.fps,
        img_format=args.format,
        quality=args.quality,
        prefix=args.prefix,
        scene_threshold=args.scene_threshold,
        scene_min_duration=args.scene_min_duration
    )


if __name__ == "__main__":
    main()
