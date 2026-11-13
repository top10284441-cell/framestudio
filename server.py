#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FrameStudio Local Backend Server
================================
- 정적 웹 파일 서빙 (index.html, style.css, app.js 등)
- 유튜브 및 웹 비디오 링크(URL)를 yt-dlp를 통해 안전하게 추출/다운로드하여 웹 앱에 공급하는 API 제공
"""

import os
import sys
import json
import re
import time
import threading
import urllib.parse
from pathlib import Path
from http.server import HTTPServer, ThreadingHTTPServer, SimpleHTTPRequestHandler

# Windows 콘솔 cp949 인코딩 에러 방지
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

try:
    import yt_dlp
except ImportError:
    yt_dlp = None

try:
    from curl_cffi import requests as cffi_requests
except ImportError:
    cffi_requests = None

# 클라우드 호스팅(Render, Railway 등) 환경변수 PORT 자동 지원 (기본값: 8080)
PORT = int(os.environ.get('PORT', 8080))
BASE_DIR = Path(__file__).resolve().parent
TEMP_DOWNLOAD_DIR = BASE_DIR / "temp_downloads"
TEMP_DOWNLOAD_DIR.mkdir(exist_ok=True)


def start_temp_cleaner(max_age_seconds=1800, check_interval_seconds=600):
    """
    클라우드 배포 시 디스크 용량 고갈 방지:
    30분(1800초) 이상 지난 임시 동영상 파일을 주기적으로 자동 청소
    """
    def cleaner_job():
        while True:
            try:
                now = time.time()
                for file_path in TEMP_DOWNLOAD_DIR.iterdir():
                    if file_path.is_file() and file_path.name != ".gitkeep":
                        # 파일 생성/수정 시간이 max_age_seconds 이상 지났으면 삭제
                        if now - file_path.stat().st_mtime > max_age_seconds:
                            try:
                                file_path.unlink()
                                print(f"[임시 파일 자동 청소] 삭제됨: {file_path.name}")
                            except Exception:
                                pass
            except Exception as e:
                print(f"[자동 청소 스레드 예외] {e}")
            time.sleep(check_interval_seconds)

    thread = threading.Thread(target=cleaner_job, daemon=True)
    thread.start()


class RangeFileWrapper:
    def __init__(self, file_obj, length):
        self.file_obj = file_obj
        self.remaining = length

    def read(self, size=-1):
        if self.remaining <= 0:
            return b""
        read_size = self.remaining if size < 0 else min(size, self.remaining)
        data = self.file_obj.read(read_size)
        self.remaining -= len(data)
        return data

    def close(self):
        self.file_obj.close()


class FrameStudioRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Range')
        self.send_header('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges')
        super().end_headers()

    def send_head(self):
        """HTTP Range 요청(206 Partial Content)을 지원하여 동영상 Seeking 및 버퍼링 완벽 지원"""
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            return super().send_head()

        if not os.path.exists(path):
            self.send_error(404, "File not found")
            return None

        ctype = self.guess_type(path)
        try:
            f = open(path, 'rb')
        except OSError:
            self.send_error(404, "File not found")
            return None

        fs = os.fstat(f.fileno())
        file_size = fs.st_size

        range_header = self.headers.get('Range')
        if range_header and range_header.startswith('bytes='):
            try:
                ranges = range_header[6:].split('-')
                start = int(ranges[0]) if ranges[0] else 0
                end = int(ranges[1]) if ranges[1] else file_size - 1
                if start >= file_size or start > end:
                    self.send_error(416, "Requested Range Not Satisfiable")
                    f.close()
                    return None
                end = min(end, file_size - 1)
                content_length = end - start + 1

                self.send_response(206)
                self.send_header('Content-Type', ctype)
                self.send_header('Content-Range', f'bytes {start}-{end}/{file_size}')
                self.send_header('Content-Length', str(content_length))
                self.send_header('Accept-Ranges', 'bytes')
                self.end_headers()

                f.seek(start)
                return RangeFileWrapper(f, content_length)
            except Exception:
                f.seek(0)

        self.send_response(200)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(file_size))
        self.send_header('Accept-Ranges', 'bytes')
        self.end_headers()
        return f

    def copyfile(self, source, outputfile):
        """클라이언트가 탐색(Seek) 중 소켓을 닫아도 서버가 죽지 않도록 방어"""
        try:
            super().copyfile(source, outputfile)
        except (ConnectionResetError, ConnectionAbortedError, BrokenPipeError, OSError):
            pass

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_HEAD(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == '/api/download-video':
            self.handle_download_video(parsed, head_only=True)
        else:
            super().do_HEAD()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == '/api/ping':
            self.send_json_response(200, {"success": True, "status": "online"})
        elif parsed.path == '/api/download-video':
            self.handle_download_video(parsed)
        else:
            super().do_GET()

    def handle_download_video(self, parsed, head_only=False):
        try:
            qs = urllib.parse.parse_qs(parsed.query)
            filename = qs.get('file', [''])[0].strip()
            custom_name = qs.get('name', [''])[0].strip()

            if not filename:
                self.send_error(400, "Missing filename")
                return

            clean_filename = os.path.basename(filename)
            file_path = TEMP_DOWNLOAD_DIR / clean_filename

            if not file_path.exists() or not file_path.is_file():
                stem = os.path.splitext(clean_filename)[0]
                found = list(TEMP_DOWNLOAD_DIR.glob(f"{stem}.*"))
                if found:
                    file_path = found[0]
                else:
                    self.send_error(404, "Video File Not Found")
                    return

            file_size = file_path.stat().st_size
            ext = file_path.suffix or '.mp4'
            
            display_name = custom_name or clean_filename
            if not display_name.lower().endswith(ext.lower()):
                display_name += ext

            safe_ascii_name = re.sub(r'[^a-zA-Z0-9_.-]', '_', display_name)
            utf8_encoded_name = urllib.parse.quote(display_name)

            self.send_response(200)
            self.send_header('Content-Type', 'application/octet-stream')
            self.send_header('Content-Length', str(file_size))
            self.send_header(
                'Content-Disposition',
                f'attachment; filename="{safe_ascii_name}"; filename*=UTF-8\'\'{utf8_encoded_name}'
            )
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()

            if head_only:
                return
            with open(file_path, 'rb') as f:
                while chunk := f.read(65536):
                    self.wfile.write(chunk)
            print(f"[동영상 다운로드 전송 완료] {display_name} ({file_size:,} bytes)")
        except Exception as e:
            print(f"[다운로드 오류] {e}")

    def do_POST(self):
        if self.path == '/api/fetch-url':
            self.handle_fetch_url()
        elif self.path == '/api/ping':
            self.send_json_response(200, {"success": True, "status": "online"})
        else:
            self.send_error(404, "Not Found")

    def download_xiaohongshu(self, target_url):
        """
        샤오홍슈(小红书, RedNote) 전용 다운로드 파이프라인
        1. xhslink.com / xhslink.cn 단축 링크 리다이렉트 추적 및 원본 URL 확장
        2. 모바일 브라우저(Weibo/Mobile WebView) 에뮬레이션으로 로그인 차단 우회
        3. masterUrl / originVideoKey 고화질 무워터마크 MP4 스트림 추출 및 저장
        """
        import requests
        print(f"[샤오홍슈 전용 파서 가동] {target_url}")
        resolved_url = target_url

        # 1. 단축 URL (xhslink.com, xhslink.cn 등) 리다이렉트 해결
        if "xhslink." in target_url:
            try:
                headers = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Referer': 'https://www.xiaohongshu.com/'
                }
                r = requests.get(target_url, headers=headers, allow_redirects=False, timeout=8)
                loc = r.headers.get("Location")
                if loc:
                    if not loc.startswith("http"):
                        loc = urllib.parse.urljoin("https://www.xiaohongshu.com", loc)
                    resolved_url = loc
                    print(f"[샤오홍슈 1차 리다이렉트 확인] {target_url} -> {resolved_url}")
            except Exception as e:
                print(f"[샤오홍슈 리다이렉트 추적 경고] {e}")

        # 만약 리다이렉트 경로가 login?redirectPath= 로 빠진 경우 실제 item URL 복원
        if "redirectPath=" in resolved_url:
            parsed_redir = urllib.parse.urlparse(resolved_url)
            qs = urllib.parse.parse_qs(parsed_redir.query)
            if "redirectPath" in qs:
                actual_path = urllib.parse.unquote(qs["redirectPath"][0])
                if not actual_path.startswith("http"):
                    actual_path = urllib.parse.urljoin("https://www.xiaohongshu.com", actual_path)
                resolved_url = actual_path
                print(f"[샤오홍슈 redirectPath에서 실제 URL 복원] -> {resolved_url}")

        video_stream_url = None
        video_title = "샤오홍슈_영상"
        video_id = re.sub(r'[^a-zA-Z0-9_]', '', resolved_url[-24:]) or "xhs_video"

        # 2. 모바일 User-Agent로 샤오홍슈 페이지 요청 (로그인 차단 원천 우회)
        mobile_uas = [
            'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Weibo (iPhone14,2__weibo__13.8.1__ios16.6)',
            'Mozilla/5.0 (Linux; Android 13; SM-S908N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
        ]

        html = ""
        for ua in mobile_uas:
            try:
                session = cffi_requests.Session(impersonate="chrome120") if cffi_requests else requests.Session()
                m_headers = {
                    'User-Agent': ua,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'zh-CN,zh;q=0.9,ko;q=0.8,en;q=0.7',
                    'Referer': 'https://www.xiaohongshu.com/',
                }
                resp = session.get(resolved_url, headers=m_headers, timeout=12)
                if resp.status_code == 200 and ("masterUrl" in resp.text or "originVideoKey" in resp.text):
                    html = resp.text
                    print(f"[샤오홍슈 페이지 로드 성공] (UA: {ua[:35]}...)")
                    break
                elif not html:
                    html = resp.text
            except Exception as req_err:
                print(f"[샤오홍슈 페이지 요청 시도 실패] {req_err}")

        # 3. 비디오 스트림 URL 파싱
        if html:
            # 제목 추출
            t_match = re.search(r'<title>(.*?)</title>', html)
            if t_match:
                clean_t = re.sub(r' - 小红书| - rednote.*', '', t_match.group(1)).strip()
                if clean_t and "登录" not in clean_t and "login" not in clean_t.lower():
                    video_title = clean_t

            # masterUrl (실제 CDN 고화질 스트림)
            master_urls = re.findall(r'["\']masterUrl["\']\s*:\s*["\']([^"\']+)["\']', html)
            if master_urls:
                raw_u = master_urls[0]
                try:
                    video_stream_url = json.loads(f'"{raw_u}"')
                except Exception:
                    video_stream_url = raw_u.replace(r'\/', '/').replace(r'\u002F', '/')
                print(f"[샤오홍슈 masterUrl 추출 성공] {video_stream_url}")

            # originVideoKey (워터마크 없는 원본 비디오)
            if not video_stream_url:
                origin_keys = re.findall(r'["\']originVideoKey["\']\s*:\s*["\']([^"\']+)["\']', html)
                if origin_keys:
                    raw_k = origin_keys[0]
                    clean_k = raw_k.replace(r'\/', '/').replace(r'\u002F', '/')
                    video_stream_url = f"https://sns-video-bd.xhscdn.com/{clean_k}"
                    print(f"[샤오홍슈 originVideoKey 추출 성공] {video_stream_url}")

            # 백업 CDN mp4 직접 탐색
            if not video_stream_url:
                mp4s = re.findall(r'https?://[a-zA-Z0-9.-]+(?:xhscdn|rednotecdn)\.com/[^\s"\'<>]+\.mp4[^\s"\'<>]*', html)
                if mp4s:
                    raw_m = mp4s[0]
                    try:
                        video_stream_url = json.loads(f'"{raw_m}"')
                    except Exception:
                        video_stream_url = raw_m.replace(r'\/', '/').replace(r'\u002F', '/')
                    print(f"[샤오홍슈 cdn mp4 추출 성공] {video_stream_url}")

        # 4. 추출된 스트림 다운로드
        if video_stream_url:
            save_name = f"xhs_{video_id}.mp4"
            save_path = TEMP_DOWNLOAD_DIR / save_name
            dl_headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                'Referer': 'https://www.xiaohongshu.com/'
            }
            with requests.get(video_stream_url, headers=dl_headers, stream=True, timeout=25) as r:
                r.raise_for_status()
                with open(save_path, 'wb') as f:
                    for chunk in r.iter_content(chunk_size=65536):
                        if chunk:
                            f.write(chunk)

            relative_url = f"/temp_downloads/{save_name}"
            print(f"[샤오홍슈 다운로드 완료] {video_title} -> {relative_url}")
            return {
                "success": True,
                "title": video_title,
                "duration": 0,
                "videoUrl": relative_url,
                "filename": save_name
            }

        # 5. yt-dlp 폴백 시도
        if yt_dlp is not None:
            try:
                out_template = str(TEMP_DOWNLOAD_DIR / f"%(id)s.%(ext)s")
                ydl_opts = {
                    'format': 'bestvideo+bestaudio/best',
                    'outtmpl': out_template,
                    'merge_output_format': 'mp4',
                    'overwrites': True,
                    'noplaylist': True,
                    'quiet': True,
                    'no_warnings': True,
                }
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(resolved_url, download=True)
                    vid = info.get('id', 'xhs_video')
                    title = info.get('title', '샤오홍슈 동영상')
                    duration = info.get('duration', 0)
                    
                    expected_fn = ydl.prepare_filename(info)
                    base_fn = os.path.splitext(expected_fn)[0]
                    final_p = expected_fn
                    if not os.path.exists(final_p) and os.path.exists(base_fn + '.mp4'):
                        final_p = base_fn + '.mp4'

                    if not os.path.exists(final_p):
                        for f in TEMP_DOWNLOAD_DIR.glob(f"{vid}.*"):
                            final_p = str(f)
                            break

                    if os.path.exists(final_p):
                        relative_url = f"/temp_downloads/{os.path.basename(final_p)}"
                        print(f"[샤오홍슈 yt-dlp 성공] {title} -> {relative_url}")
                        return {
                            "success": True,
                            "title": title,
                            "duration": duration,
                            "videoUrl": relative_url,
                            "filename": os.path.basename(final_p)
                        }
            except Exception as ydl_err:
                print(f"[샤오홍슈 yt-dlp 시도 실패] {ydl_err}")

        # 모든 다운로드 시도 실패 시
        raise Exception(
            "샤오홍슈 영상 링크를 바로 가져오지 못했습니다. 게시물이 사진 전용이거나 만료된 링크일 수 있습니다.\n"
            "💡 앱에서 최신 링크를 다시 복사하거나, 영상을 폰에 저장 후 [📁 파일 직접 올리기]로 넣어주세요!"
        )

    def handle_fetch_url(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            data = json.loads(body)
            target_url = data.get('url', '').strip()

            # URL에서 텍스트 분리 (도우인/샤오홍슈 공유 텍스트 등 포함 시 실제 링크만 추출)
            url_match = re.search(r'https?://[^\s"\'<>，。！？]+', target_url)
            if url_match:
                target_url = url_match.group(0).rstrip('，。！？')

            if not target_url:
                self.send_json_response(400, {"success": False, "error": "URL이 입력되지 않았습니다."})
                return

            print(f"\n[URL 요청 수신] {target_url}")

            # 샤오홍슈 링크 감지 (xhslink.com, xhslink.cn, xiaohongshu, rednote 등 모든 도메인)
            is_xhs = bool(re.search(r'xhslink\.|xiaohongshu\.|rednote\.', target_url, re.IGNORECASE))
            if is_xhs:
                try:
                    res_data = self.download_xiaohongshu(target_url)
                    self.send_json_response(200, res_data)
                    return
                except Exception as xhs_e:
                    self.send_json_response(500, {
                        "success": False,
                        "error": str(xhs_e)
                    })
                    return

            if yt_dlp is None:
                self.send_json_response(500, {
                    "success": False,
                    "error": "yt-dlp 라이브러리가 설치되어 있지 않습니다. pip install yt-dlp 를 실행해주세요."
                })
                return

            # 안전한 파일명 접두사 생성
            clean_name = re.sub(r'[^a-zA-Z0-9_-]', '_', target_url[-15:])
            out_template = str(TEMP_DOWNLOAD_DIR / f"%(id)s.%(ext)s")

            # 직접 비디오 링크 여부 확인 (.mp4, .webm, .mov)
            is_direct_file = bool(re.search(r'\.(mp4|webm|mov|m4v)(\?.*)?$', target_url, re.IGNORECASE))

            ydl_opts = {
                'format': 'bestvideo[vcodec^=avc]+bestaudio[ext=m4a]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best',
                'outtmpl': out_template,
                'merge_output_format': 'mp4',
                'overwrites': True,
                'noplaylist': True,
                'quiet': True,
                'no_warnings': True,
                'http_headers': {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            }

            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(target_url, download=True)
                    video_id = info.get('id', 'video')
                    title = info.get('title', '웹 동영상')
                    duration = info.get('duration', 0)
                    
                    expected_filename = ydl.prepare_filename(info)
                    base_without_ext = os.path.splitext(expected_filename)[0]
                    final_path = expected_filename
                    if not os.path.exists(final_path) and os.path.exists(base_without_ext + '.mp4'):
                        final_path = base_without_ext + '.mp4'

                    # temp_downloads에서 video_id로 시작하는 파일 찾기 (fallback)
                    if not os.path.exists(final_path):
                        for f in TEMP_DOWNLOAD_DIR.glob(f"{video_id}.*"):
                            final_path = str(f)
                            break

                    relative_url = f"/temp_downloads/{os.path.basename(final_path)}"
                    print(f"[다운로드 완료] {title} -> {relative_url}")

                    self.send_json_response(200, {
                        "success": True,
                        "title": title,
                        "duration": duration,
                        "videoUrl": relative_url,
                        "filename": os.path.basename(final_path)
                    })
                    return
            except Exception as yt_err:
                if not is_direct_file:
                    raise yt_err
                
                print(f"[yt-dlp 직접 다운로드 폴백 진행] {yt_err}")
                # 직접 HTTP 파일 다운로드 처리
                req = urllib.request.Request(
                    target_url,
                    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'}
                )
                with urllib.request.urlopen(req) as resp:
                    filename = os.path.basename(urllib.parse.urlparse(target_url).path) or "downloaded_video.mp4"
                    save_path = TEMP_DOWNLOAD_DIR / filename
                    with open(save_path, 'wb') as f:
                        f.write(resp.read())

                relative_url = f"/temp_downloads/{filename}"
                print(f"[직접 다운로드 완료] -> {relative_url}")
                self.send_json_response(200, {
                    "success": True,
                    "title": filename,
                    "duration": 0,
                    "videoUrl": relative_url,
                    "filename": filename
                })

        except Exception as e:
            err_msg = str(e)
            print(f"[URL 처리 오류] {err_msg}")
            self.send_json_response(500, {
                "success": False,
                "error": f"동영상을 불러오지 못했습니다: {err_msg}"
            })

    def send_json_response(self, status_code, data):
        response_bytes = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Length', str(len(response_bytes)))
        self.end_headers()
        self.wfile.write(response_bytes)


def run_server():
    # 임시 파일 자동 정리기 가동 (클라우드 디스크 보호)
    start_temp_cleaner()

    server_address = ('0.0.0.0', PORT)
    print("=" * 60)
    print(f"[FrameStudio] Backend & Web Studio Server Online")
    print(f" - Local URL: http://localhost:{PORT}")
    print(f" - Bound to: 0.0.0.0:{PORT} (Cloud & Local Ready)")
    print(f" - Auto temp cleaner: Active (every 10 min)")
    print("=" * 60)

    try:
        with ThreadingHTTPServer(server_address, FrameStudioRequestHandler) as httpd:
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n서버를 종료합니다.")


if __name__ == '__main__':
    run_server()
