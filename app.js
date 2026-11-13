
  // 영상 비율 자동 감지 및 세로/가로 모드 동적 전환 함수
  function updateVideoAspectRatio(w, h) {
    if (!w || !h) return;
    const isPortrait = h > w;
    const ratio = `${w} / ${h}`;
    document.documentElement.style.setProperty('--frame-aspect-ratio', ratio);
    if (isPortrait) {
      document.body.classList.add('is-portrait-video');
    } else {
      document.body.classList.remove('is-portrait-video');
    }
  }
/**
 * FrameStudio - Video Frame Extractor Core Logic
 * High-performance browser-based video-to-image extraction engine
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const dropCard = document.getElementById('dropCard');
  const dropzone = document.getElementById('dropzone');
  const videoFileInput = document.getElementById('videoFileInput');
  const browseBtn = document.getElementById('browseBtn');
  const loadSampleBtn = document.getElementById('loadSampleBtn');
  const videoInfoBox = document.getElementById('videoInfoBox');
  const previewVideo = document.getElementById('previewVideo');
  const videoFileName = document.getElementById('videoFileName');
  const videoResolutionBadge = document.getElementById('videoResolutionBadge');
  const metaDuration = document.getElementById('metaDuration');
  const metaSize = document.getElementById('metaSize');
  const metaFPS = document.getElementById('metaFPS');
  const removeVideoBtn = document.getElementById('removeVideoBtn');
    const downloadVideoBtn = document.getElementById('downloadVideoBtn');
    const downloadVideoBigBtn = document.getElementById('downloadVideoBigBtn');

  // Input Source Tabs (File vs URL)
  const tabSourceFile = document.getElementById('tabSourceFile');
  const tabSourceUrl = document.getElementById('tabSourceUrl');
  const urlInputContainer = document.getElementById('urlInputContainer');
  const videoUrlInput = document.getElementById('videoUrlInput');
  const loadUrlBtn = document.getElementById('loadUrlBtn');
  const urlLoadingIndicator = document.getElementById('urlLoadingIndicator');
  const urlLoadingStatusText = document.getElementById('urlLoadingStatusText');

  // Mode Tabs & Settings
  const tabButtons = document.querySelectorAll('.tab-btn');
  const modeContents = {
    interval: document.getElementById('modeInterval'),
    totalCount: document.getElementById('modeTotalCount'),
    fps: document.getElementById('modeFps'),
    scene: document.getElementById('modeScene')
  };

  const intervalSlider = document.getElementById('intervalSlider');
  const intervalInput = document.getElementById('intervalInput');
  const intervalValueLabel = document.getElementById('intervalValueLabel');
  const totalCountSlider = document.getElementById('totalCountSlider');
  const totalCountInput = document.getElementById('totalCountInput');
  const fpsSelect = document.getElementById('fpsSelect');

  // Scene Detection Controls
  const sceneThresholdSlider = document.getElementById('sceneThresholdSlider');
  const sceneThresholdInput = document.getElementById('sceneThresholdInput');
  const sceneThresholdLabel = document.getElementById('sceneThresholdLabel');
  const sceneMinDurationInput = document.getElementById('sceneMinDurationInput');
  const sceneSampleRateSelect = document.getElementById('sceneSampleRateSelect');

  // Range Crop
  const enableRangeCrop = document.getElementById('enableRangeCrop');
  const rangeControlsRow = document.getElementById('rangeControlsRow');
  const startTimeInput = document.getElementById('startTimeInput');
  const endTimeInput = document.getElementById('endTimeInput');
  const setCurrentTimeAsRangeBtn = document.getElementById('setCurrentTimeAsRangeBtn');

  // Advanced Accordion & Image settings
  const accordionToggleBtn = document.getElementById('accordionToggleBtn');
  const accordionBody = document.getElementById('accordionBody');
  const imgFormatSelect = document.getElementById('imgFormatSelect');
  const imgQualityRange = document.getElementById('imgQualityRange');
  const qualityValDisplay = document.getElementById('qualityValDisplay');
  const jpegQualityGroup = document.getElementById('jpegQualityGroup');
  const resolutionScaleSelect = document.getElementById('resolutionScaleSelect');
  const filePrefixInput = document.getElementById('filePrefixInput');

  // Estimation & Actions
  const estCountBadge = document.getElementById('estCountBadge');
  const estTimeBadge = document.getElementById('estTimeBadge');
  const startExtractBtn = document.getElementById('startExtractBtn');
  const stopExtractBtn = document.getElementById('stopExtractBtn');

  // Progress
  const progressCard = document.getElementById('progressCard');
  const progressStatusLabel = document.getElementById('progressStatusLabel');
  const progressPercentLabel = document.getElementById('progressPercentLabel');
  const progressBarFill = document.getElementById('progressBarFill');
  const progressCountLabel = document.getElementById('progressCountLabel');
  const progressCurrentTimeLabel = document.getElementById('progressCurrentTimeLabel');

  // Gallery
  const galleryCountBadge = document.getElementById('galleryCountBadge');
  const galleryActions = document.getElementById('galleryActions');
  const galleryEmptyState = document.getElementById('galleryEmptyState');
  const galleryGrid = document.getElementById('galleryGrid');
  const selectAllBtn = document.getElementById('selectAllBtn');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const downloadZipBtn = document.getElementById('downloadZipBtn');

  // Modal Lightbox
  const imageModal = document.getElementById('imageModal');
  const modalImage = document.getElementById('modalImage');
  const modalFileName = document.getElementById('modalFileName');
  const modalTimeBadge = document.getElementById('modalTimeBadge');
  const modalDimBadge = document.getElementById('modalDimBadge');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalPrevBtn = document.getElementById('modalPrevBtn');
  const modalNextBtn = document.getElementById('modalNextBtn');
  const modalDownloadBtn = document.getElementById('modalDownloadBtn');

  // Offscreen Canvas & Toast
  const offscreenCanvas = document.getElementById('offscreenCanvas');
  const canvasCtx = offscreenCanvas.getContext('2d');
  const toast = document.getElementById('toast');

  // State Management
  let currentFile = null;
  let videoDuration = 0;
  let videoWidth = 0;
  let videoHeight = 0;
  let activeMode = 'interval'; // 'interval', 'totalCount', 'fps'
  let isExtracting = false;
  let abortRequested = false;
  let extractedFrames = []; // Array of { id, index, time, timestampStr, blob, dataUrl, width, height, filename }
  let activeModalIndex = -1;

  // -------------------------------------------------------------
  // 1. Video Loading & Event Handlers
  // -------------------------------------------------------------

  browseBtn.addEventListener('click', () => videoFileInput.click());
  dropzone.addEventListener('click', (e) => {
    if (e.target !== loadSampleBtn) videoFileInput.click();
  });

  // Drag & Drop
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('video/')) {
      handleVideoSelected(files[0]);
    } else {
      showToast('유효한 동영상 파일을 드롭해주세요.');
    }
  });

  videoFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleVideoSelected(e.target.files[0]);
    }
  });

  removeVideoBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    resetVideoState();
  });

  // -------------------------------------------------------------
  // Video Download Handler (동영상 파일 직접 다운로드 기능)
  // -------------------------------------------------------------
  function downloadCurrentVideo(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!previewVideo.src && !currentFile) {
      showToast('다운로드할 동영상이 준비되지 않았습니다.');
      return;
    }

    const apiBase = window.location.origin.startsWith('http')
      ? window.location.origin
      : 'http://localhost:8080';

    let titleName = (currentFile && currentFile.title) || (currentFile && currentFile.name) || (videoFileName ? videoFileName.textContent : 'video');
    let safeTitle = titleName.replace(/[\\/:*?"<>|]/g, '_').trim();
    if (!safeTitle.match(/\.(mp4|webm|mov|m4v)$/i)) {
      safeTitle += '.mp4';
    }

    // 1. 백엔드(yt-dlp)에서 다운로드한 파일인 경우
    let remoteFile = (currentFile && currentFile.remoteFilename) || '';
    if (!remoteFile && previewVideo.src && previewVideo.src.includes('/temp_downloads/')) {
      remoteFile = previewVideo.src.split('/temp_downloads/')[1].split('?')[0];
    }

    if (remoteFile) {
      const downloadUrl = `${apiBase}/api/download-video?file=${encodeURIComponent(remoteFile)}&name=${encodeURIComponent(safeTitle)}`;
      console.log('[FrameStudio] Triggering download via:', downloadUrl);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.setAttribute('download', safeTitle);
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (a.parentNode) a.parentNode.removeChild(a);
      }, 500);
      showToast(`'${safeTitle}' 동영상 파일 다운로드를 시작했습니다! 📥`);
      return;
    }

    // 2. 직접 업로드한 로컬 파일이거나 Blob URL인 경우
    if (previewVideo.src) {
      const a = document.createElement('a');
      a.href = previewVideo.src;
      a.setAttribute('download', safeTitle);
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (a.parentNode) a.parentNode.removeChild(a);
      }, 500);
      showToast(`'${safeTitle}' 동영상 파일 다운로드를 시작했습니다! 📥`);
      return;
    }

    showToast('동영상 다운로드 경로를 찾을 수 없습니다.');
  }

  if (downloadVideoBtn) {
    downloadVideoBtn.addEventListener('click', downloadCurrentVideo);
  }
  if (downloadVideoBigBtn) {
    downloadVideoBigBtn.addEventListener('click', downloadCurrentVideo);
  }

  // Source Tab Switching
  tabSourceFile.addEventListener('click', () => {
    tabSourceFile.classList.add('active');
    tabSourceUrl.classList.remove('active');
    dropzone.style.display = 'flex';
    urlInputContainer.style.display = 'none';
  });

  tabSourceUrl.addEventListener('click', () => {
    tabSourceUrl.classList.add('active');
    tabSourceFile.classList.remove('active');
    dropzone.style.display = 'none';
    urlInputContainer.style.display = 'block';
  });

  // Platform Chips & Sample Fill Events
  const platformChips = document.querySelectorAll('.platform-chip');
  const fillSampleUrlBtn = document.getElementById('fillSampleUrlBtn');

  platformChips.forEach(chip => {
    chip.addEventListener('click', () => {
      platformChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const placeholder = chip.dataset.placeholder;
      if (placeholder) {
        videoUrlInput.placeholder = placeholder;
      }
      videoUrlInput.focus();
    });
  });

  if (fillSampleUrlBtn) {
    fillSampleUrlBtn.addEventListener('click', () => {
      videoUrlInput.value = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';
      handleUrlFetch();
    });
  }

  // URL Input Load Event
  loadUrlBtn.addEventListener('click', handleUrlFetch);
  videoUrlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleUrlFetch();
    }
  });

  // 붙여넣기 및 입력 시 자동 플랫폼 감지
  videoUrlInput.addEventListener('input', () => {
    const val = videoUrlInput.value.trim();
    if (/xhslink\.|xiaohongshu\.|rednote\./i.test(val)) {
      platformChips.forEach(c => {
        if (c.dataset.platform === 'xiaohongshu') c.classList.add('active');
        else c.classList.remove('active');
      });
    } else if (/douyin\.com/i.test(val)) {
      platformChips.forEach(c => {
        if (c.dataset.platform === 'douyin') c.classList.add('active');
        else c.classList.remove('active');
      });
    } else if (/instagram\.com/i.test(val)) {
      platformChips.forEach(c => {
        if (c.dataset.platform === 'instagram') c.classList.add('active');
        else c.classList.remove('active');
      });
    } else if (/tiktok\.com/i.test(val)) {
      platformChips.forEach(c => {
        if (c.dataset.platform === 'tiktok') c.classList.add('active');
        else c.classList.remove('active');
      });
    } else if (/youtube\.com\/shorts/i.test(val)) {
      platformChips.forEach(c => {
        if (c.dataset.platform === 'shorts') c.classList.add('active');
        else c.classList.remove('active');
      });
    } else if (/youtube\.com|youtu\.be/i.test(val)) {
      platformChips.forEach(c => {
        if (c.dataset.platform === 'youtube') c.classList.add('active');
        else c.classList.remove('active');
      });
    }
  });

  async function handleUrlFetch() {

    let rawUrl = videoUrlInput.value.trim();
    if (!rawUrl) {
      showToast('동영상 링크 URL을 입력해주세요.');
      return;
    }

    // 도우인(Douyin) 및 샤오홍슈(Xiaohongshu) 등 중국어 공유 문구가 섞여있을 때 실제 https 링크만 자동 추출
    const urlMatch = rawUrl.match(/https?:\/\/[^\s"'<>，。！？]+/i);
    if (urlMatch) {
      rawUrl = urlMatch[0].replace(/[，。！？]+$/, '');
      videoUrlInput.value = rawUrl;
    }

    // 도우인 링크일 경우 도우인 칩 활성화
    if (rawUrl.includes("douyin.com")) {
      platformChips.forEach(c => {
        if (c.dataset.platform === 'douyin') c.classList.add('active');
        else c.classList.remove('active');
      });
    }

    // 샤오홍슈 링크일 경우 샤오홍슈 칩 활성화
    const isXhs = /xhslink\.|xiaohongshu\.|rednote\./i.test(rawUrl);
    if (isXhs) {
      platformChips.forEach(c => {
        if (c.dataset.platform === 'xiaohongshu') c.classList.add('active');
        else c.classList.remove('active');
      });
    }

    urlLoadingIndicator.style.display = 'flex';
    loadUrlBtn.disabled = true;
    urlLoadingStatusText.textContent = isXhs
      ? '샤오홍슈(小红书) 고화질 영상 분석 및 다운로드 중...'
      : '동영상 링크 분석 및 영상 로드 중... (잠시만 기다려주세요)';

    // Determine backend API server address (works on both http:// and file:///)
    const apiBase = window.location.origin.startsWith('http')
      ? window.location.origin
      : 'http://localhost:8080';

    try {
      // 1. Send URL to backend (yt-dlp engine)
      const res = await fetch(`${apiBase}/api/fetch-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: rawUrl })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `서버 응답 오류 (${res.status})`);
      }

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || '동영상 정보를 가져올 수 없습니다.');
      }

      // Convert relative URL to full backend URL if needed
      const fullVideoUrl = data.videoUrl.startsWith('http')
        ? data.videoUrl
        : `${apiBase}${data.videoUrl}`;

      // Successfully fetched via backend
      handleVideoFromRemoteUrl(fullVideoUrl, data.title, data.filename);
      showToast(`'${data.title}' 영상을 성공적으로 불러왔습니다! 🎬`);

    } catch (err) {
      console.warn('Backend fetch failed or error:', err);

      // If backend failed and it's a direct mp4/webm URL, try direct browser load
      if (rawUrl.match(/\.(mp4|webm|mov|m4v)(\?.*)?$/i)) {
        tryDirectVideoLoad(rawUrl);
      } else {
        urlLoadingIndicator.style.display = 'none';
        loadUrlBtn.disabled = false;
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        alert(
          `동영상 링크 로드 중 오류가 발생했습니다:\n${err.message}\n\n` +
          (isLocal ? '로컬 서버(http://localhost:8080)가 구동 중인지 확인해주세요.\n바탕화면의 [start_web.bat]을 실행하시면 바로 활성화됩니다!' : '서버 상태를 확인 중이거나 일시적인 네트워크 제한일 수 있습니다.')
        );
      }
    }
  }

  function tryDirectVideoLoad(url) {
    urlLoadingStatusText.textContent = '직접 동영상 스트림 연결 중...';
    previewVideo.crossOrigin = 'anonymous';
    previewVideo.src = url;

    previewVideo.onloadedmetadata = () => {
      urlLoadingIndicator.style.display = 'none';
      loadUrlBtn.disabled = false;

      currentFile = { name: url.split('/').pop().split('?')[0] || 'remote_video.mp4', size: 0 };
      videoFileName.textContent = currentFile.name;
      videoDuration = previewVideo.duration;
      videoWidth = previewVideo.videoWidth;
      videoHeight = previewVideo.videoHeight;

      videoResolutionBadge.textContent = `${videoWidth} × ${videoHeight}`;
      updateVideoAspectRatio(videoWidth, videoHeight);
      metaDuration.textContent = `길이: ${formatDuration(videoDuration)}`;
      metaSize.textContent = '웹 스트림';
      metaFPS.textContent = `FPS: 약 30`;

      endTimeInput.value = videoDuration.toFixed(1);
      endTimeInput.max = videoDuration.toFixed(1);
      startTimeInput.max = videoDuration.toFixed(1);

      dropzone.style.display = 'none';
      urlInputContainer.style.display = 'none';
      videoInfoBox.style.display = 'block';
      startExtractBtn.disabled = false;

      updateEstimates();
      showToast('웹 동영상이 준비되었습니다.');
    };

    previewVideo.onerror = () => {
      urlLoadingIndicator.style.display = 'none';
      loadUrlBtn.disabled = false;
      showToast('동영상 링크를 재생할 수 없습니다. CORS 정책이나 주소를 확인해주세요.');
    };
  }

  function handleVideoFromRemoteUrl(videoUrl, title, filename) {
    urlLoadingIndicator.style.display = 'none';
    loadUrlBtn.disabled = false;

    previewVideo.src = videoUrl;
    currentFile = {
      name: filename || `${title}.mp4`,
      title: title || filename,
      remoteFilename: filename,
      url: videoUrl,
      size: 0
    };
    videoFileName.textContent = title || filename;

    previewVideo.onloadedmetadata = () => {
      videoDuration = previewVideo.duration;
      videoWidth = previewVideo.videoWidth;
      videoHeight = previewVideo.videoHeight;

      videoResolutionBadge.textContent = `${videoWidth} × ${videoHeight}`;
      updateVideoAspectRatio(videoWidth, videoHeight);
      metaDuration.textContent = `길이: ${formatDuration(videoDuration)}`;
      metaSize.textContent = '웹 다운로드';
      metaFPS.textContent = `FPS: 약 30`;

      endTimeInput.value = videoDuration.toFixed(1);
      endTimeInput.max = videoDuration.toFixed(1);
      startTimeInput.max = videoDuration.toFixed(1);

      dropzone.style.display = 'none';
      urlInputContainer.style.display = 'none';
      videoInfoBox.style.display = 'block';
      startExtractBtn.disabled = false;

      updateEstimates();
    };
  }

  function handleVideoSelected(file) {
    currentFile = file;
    const url = URL.createObjectURL(file);
    previewVideo.src = url;

    videoFileName.textContent = file.name;
    metaSize.textContent = `크기: ${(file.size / (1024 * 1024)).toFixed(1)} MB`;

    previewVideo.onloadedmetadata = () => {
      videoDuration = previewVideo.duration;
      videoWidth = previewVideo.videoWidth;
      videoHeight = previewVideo.videoHeight;

      videoResolutionBadge.textContent = `${videoWidth} × ${videoHeight}`;
      updateVideoAspectRatio(videoWidth, videoHeight);
      metaDuration.textContent = `길이: ${formatDuration(videoDuration)}`;
      metaFPS.textContent = `FPS: 약 30`;

      // Set default range cut end time
      endTimeInput.value = videoDuration.toFixed(1);
      endTimeInput.max = videoDuration.toFixed(1);
      startTimeInput.max = videoDuration.toFixed(1);

      dropzone.style.display = 'none';
      urlInputContainer.style.display = 'none';
      videoInfoBox.style.display = 'block';
      startExtractBtn.disabled = false;

      updateEstimates();
      showToast(`'${file.name}' 비디오가 준비되었습니다.`);
    };
  }

  function resetVideoState() {
    if (previewVideo.src && previewVideo.src.startsWith('blob:')) {
      URL.revokeObjectURL(previewVideo.src);
    }
    previewVideo.removeAttribute('src');
    currentFile = null;
    videoDuration = 0;
    videoWidth = 0;
    videoHeight = 0;
    videoFileInput.value = '';
    videoUrlInput.value = '';

    if (tabSourceFile.classList.contains('active')) {
      dropzone.style.display = 'flex';
      urlInputContainer.style.display = 'none';
    } else {
      dropzone.style.display = 'none';
      urlInputContainer.style.display = 'block';
    }

    videoInfoBox.style.display = 'none';
    startExtractBtn.disabled = true;
    updateEstimates();
  }

  // -------------------------------------------------------------
  // 2. Demo Video Generator (Instant test without external file)
  // -------------------------------------------------------------
  loadSampleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showToast('데모 비디오를 실시간 생성하는 중...');

    // Generate a 4-second dynamic canvas animation as WebM video
    const demoCanvas = document.createElement('canvas');
    demoCanvas.width = 640;
    demoCanvas.height = 360;
    const dCtx = demoCanvas.getContext('2d');
    const stream = demoCanvas.captureStream(30);

    let mediaRecorder;
    try {
      mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    } catch (err) {
      showToast('이 브라우저에서는 데모 비디오 생성을 지원하지 않습니다.');
      return;
    }

    const chunks = [];
    mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
    mediaRecorder.onstop = () => {
      const demoBlob = new Blob(chunks, { type: 'video/webm' });
      const demoFile = new File([demoBlob], 'demo_sample_animation.webm', { type: 'video/webm' });
      handleVideoSelected(demoFile);
    };

    mediaRecorder.start();
    const startTime = performance.now();
    const durationMs = 4000;

    function renderDemo(now) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);

      // Background gradient animation
      const grad = dCtx.createLinearGradient(0, 0, 640, 360);
      const hue = (progress * 360) % 360;
      grad.addColorStop(0, `hsl(${hue}, 70%, 20%)`);
      grad.addColorStop(1, `hsl(${(hue + 60) % 360}, 80%, 10%)`);
      dCtx.fillStyle = grad;
      dCtx.fillRect(0, 0, 640, 360);

      // Moving graphic circles
      for (let i = 0; i < 5; i++) {
        const x = 320 + Math.cos(progress * Math.PI * 4 + i) * 150;
        const y = 180 + Math.sin(progress * Math.PI * 4 + i) * 80;
        dCtx.beginPath();
        dCtx.arc(x, y, 20 + i * 4, 0, Math.PI * 2);
        dCtx.fillStyle = `hsla(${(hue + i * 40) % 360}, 90%, 60%, 0.7)`;
        dCtx.fill();
      }

      // Time Text
      dCtx.fillStyle = '#ffffff';
      dCtx.font = 'bold 28px sans-serif';
      dCtx.textAlign = 'center';
      dCtx.fillText(`FrameStudio 데모 비디오`, 320, 150);
      dCtx.font = '20px monospace';
      dCtx.fillText(`타임코드: ${(elapsed / 1000).toFixed(2)}s / 4.00s`, 320, 200);

      if (progress < 1) {
        requestAnimationFrame(renderDemo);
      } else {
        mediaRecorder.stop();
      }
    }

    requestAnimationFrame(renderDemo);
  });

  // -------------------------------------------------------------
  // 3. UI Controls & Modes Synchronization
  // -------------------------------------------------------------

  // Tab switching
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeMode = btn.dataset.mode;

      Object.keys(modeContents).forEach(key => {
        modeContents[key].style.display = (key === activeMode) ? 'block' : 'none';
      });

      updateEstimates();
    });
  });

  // Interval slider <-> input sync
  intervalSlider.addEventListener('input', () => {
    intervalInput.value = intervalSlider.value;
    intervalValueLabel.textContent = `매 ${intervalSlider.value}초마다 1장`;
    syncChips('interval', intervalSlider.value);
    updateEstimates();
  });

  intervalInput.addEventListener('input', () => {
    intervalSlider.value = intervalInput.value;
    intervalValueLabel.textContent = `매 ${intervalInput.value}초마다 1장`;
    syncChips('interval', intervalInput.value);
    updateEstimates();
  });

  // Total count slider <-> input sync
  totalCountSlider.addEventListener('input', () => {
    totalCountInput.value = totalCountSlider.value;
    syncChips('totalCount', totalCountSlider.value);
    updateEstimates();
  });

  totalCountInput.addEventListener('input', () => {
    totalCountSlider.value = totalCountInput.value;
    syncChips('totalCount', totalCountInput.value);
    updateEstimates();
  });

  fpsSelect.addEventListener('change', updateEstimates);

  // Preset chips
  document.querySelectorAll('[data-set-interval]').forEach(chip => {
    chip.addEventListener('click', () => {
      const val = chip.dataset.setInterval;
      intervalSlider.value = val;
      intervalInput.value = val;
      intervalValueLabel.textContent = `매 ${val}초마다 1장`;
      syncChips('interval', val);
      updateEstimates();
    });
  });

  document.querySelectorAll('[data-set-count]').forEach(chip => {
    chip.addEventListener('click', () => {
      const val = chip.dataset.setCount;
      totalCountSlider.value = val;
      totalCountInput.value = val;
      syncChips('totalCount', val);
      updateEstimates();
    });
  });

  // Scene Detection slider <-> input sync
  sceneThresholdSlider.addEventListener('input', () => {
    sceneThresholdInput.value = sceneThresholdSlider.value;
    updateSceneThresholdLabel(sceneThresholdSlider.value);
    syncChips('scene', sceneThresholdSlider.value);
  });

  sceneThresholdInput.addEventListener('input', () => {
    sceneThresholdSlider.value = sceneThresholdInput.value;
    updateSceneThresholdLabel(sceneThresholdInput.value);
    syncChips('scene', sceneThresholdInput.value);
  });

  function updateSceneThresholdLabel(val) {
    const v = parseInt(val, 10);
    let desc = '슬라이드/강의 요약 추천';
    if (v <= 15) desc = '민감 웹서핑';
    else if (v <= 25) desc = '슬라이드/강의 요약 추천';
    else if (v <= 35) desc = '확실한 페이지 전환';
    else desc = '큰 배경 전환만';
    sceneThresholdLabel.textContent = `${v}% (${desc})`;
  }

  document.querySelectorAll('[data-set-scene]').forEach(chip => {
    chip.addEventListener('click', () => {
      const val = chip.dataset.setScene;
      sceneThresholdSlider.value = val;
      sceneThresholdInput.value = val;
      updateSceneThresholdLabel(val);
      syncChips('scene', val);
    });
  });

  function syncChips(type, value) {
    if (type === 'interval') {
      document.querySelectorAll('[data-set-interval]').forEach(c => {
        c.classList.toggle('active', parseFloat(c.dataset.setInterval) === parseFloat(value));
      });
    } else if (type === 'totalCount') {
      document.querySelectorAll('[data-set-count]').forEach(c => {
        c.classList.toggle('active', parseInt(c.dataset.setCount, 10) === parseInt(value, 10));
      });
    } else if (type === 'scene') {
      document.querySelectorAll('[data-set-scene]').forEach(c => {
        c.classList.toggle('active', parseInt(c.dataset.setScene, 10) === parseInt(value, 10));
      });
    }
  }

  // Range Crop Toggle
  enableRangeCrop.addEventListener('change', () => {
    rangeControlsRow.style.display = enableRangeCrop.checked ? 'flex' : 'none';
    updateEstimates();
  });

  startTimeInput.addEventListener('input', updateEstimates);
  endTimeInput.addEventListener('input', updateEstimates);

  setCurrentTimeAsRangeBtn.addEventListener('click', () => {
    if (previewVideo && previewVideo.duration) {
      startTimeInput.value = previewVideo.currentTime.toFixed(1);
      updateEstimates();
      showToast(`시작 시간이 현재 비디오 위치(${previewVideo.currentTime.toFixed(1)}초)로 설정되었습니다.`);
    }
  });

  // Accordion Toggle
  accordionToggleBtn.addEventListener('click', () => {
    accordionToggleBtn.classList.toggle('open');
    accordionBody.classList.toggle('open');
  });

  // Quality Slider
  imgQualityRange.addEventListener('input', () => {
    qualityValDisplay.textContent = `${Math.round(imgQualityRange.value * 100)}%`;
  });

  imgFormatSelect.addEventListener('change', () => {
    jpegQualityGroup.style.display = (imgFormatSelect.value === 'image/jpeg') ? 'block' : 'none';
  });

  // -------------------------------------------------------------
  // 4. Estimation Calculation Logic
  // -------------------------------------------------------------

  function getActiveTimeRange() {
    let start = 0;
    let end = videoDuration || 0;

    if (enableRangeCrop.checked) {
      const customStart = parseFloat(startTimeInput.value) || 0;
      const customEnd = parseFloat(endTimeInput.value) || end;
      start = Math.max(0, Math.min(customStart, end));
      end = Math.max(start, Math.min(customEnd, videoDuration));
    }
    return { start, end, span: Math.max(0.1, end - start) };
  }

  function calculateTargetTimestamps() {
    if (!videoDuration || videoDuration <= 0) return [];
    const { start, end, span } = getActiveTimeRange();
    const timestamps = [];

    if (activeMode === 'interval') {
      const step = parseFloat(intervalInput.value) || 1.0;
      for (let t = start; t <= end; t += step) {
        timestamps.push(t);
      }
    } else if (activeMode === 'totalCount') {
      const count = Math.max(1, parseInt(totalCountInput.value, 10) || 10);
      if (count === 1) {
        timestamps.push(start);
      } else {
        const step = span / (count - 1);
        for (let i = 0; i < count; i++) {
          timestamps.push(Math.min(end, start + i * step));
        }
      }
    } else if (activeMode === 'fps') {
      const fpsVal = fpsSelect.value;
      const fps = (fpsVal === 'all') ? 30 : parseFloat(fpsVal);
      const step = 1.0 / fps;
      for (let t = start; t <= end; t += step) {
        timestamps.push(t);
      }
    }

    return timestamps;
  }

  sceneSampleRateSelect.addEventListener('change', updateEstimates);
  sceneMinDurationInput.addEventListener('input', updateEstimates);

  function updateEstimates() {
    if (!currentFile || videoDuration <= 0) {
      estCountBadge.textContent = '0장';
      estTimeBadge.textContent = '비디오를 선택해주세요';
      return;
    }

    if (activeMode === 'scene') {
      const { span } = getActiveTimeRange();
      const sampleStep = parseFloat(sceneSampleRateSelect.value) || 0.5;
      const totalSamples = Math.ceil(span / sampleStep);
      estCountBadge.textContent = '장면 전환 시 자동 감지';
      const estSec = (totalSamples * 0.04).toFixed(1);
      estTimeBadge.textContent = `분석 샘플: ${totalSamples}개 (예상 약 ${estSec}초)`;
      return;
    }

    const list = calculateTargetTimestamps();
    estCountBadge.textContent = `${list.length.toLocaleString()}장`;
    const estSec = (list.length * 0.05).toFixed(1);
    estTimeBadge.textContent = `예상 소요 시간: 약 ${estSec}초`;
  }

  // 슬라이드/화면 전환 전용 고정밀 변화율 계산
  // 마우스 커서, 깜빡임, 압축 노이즈는 철저히 걸러내고, 실제 레이아웃/글자/창 변화만 계산
  function calculatePixelDifference(data1, data2) {
    if (!data1 || !data2 || data1.length !== data2.length) return 1.0;
    let diffSum = 0;
    let changedPixelCount = 0;
    const len = data1.length;
    const totalPixels = len / 4;

    for (let i = 0; i < len; i += 4) {
      // 인간 시각 인지 루미넌스(밝기) 차이 계산 (0.299R + 0.587G + 0.114B)
      const lum1 = 0.299 * data1[i] + 0.587 * data1[i + 1] + 0.114 * data1[i + 2];
      const lum2 = 0.299 * data2[i] + 0.587 * data2[i + 1] + 0.114 * data2[i + 2];
      const lumDiff = Math.abs(lum1 - lum2);

      diffSum += lumDiff / 255.0;

      // 마우스 커서 움직임이나 노이즈(밝기차 30 이하)는 철저히 무시
      // 진짜 화면 영역(글자, 창, 배경)이 바뀐 픽셀만 카운트
      if (lumDiff > 30) {
        changedPixelCount++;
      }
    }

    const avgDiff = diffSum / totalPixels;
    const changedRatio = changedPixelCount / totalPixels;

    // 변경된 면적 비율(changedRatio)을 주 지표로 사용
    return Math.max(avgDiff * 1.2, changedRatio);
  }

  // -------------------------------------------------------------
  // 5. Frame Extraction Pipeline
  // -------------------------------------------------------------

  startExtractBtn.addEventListener('click', async () => {
    if (!currentFile || isExtracting) return;

    // 현재 화면에 실제로 활성화된 탭의 data-mode를 강제 동기화 (오동작 방지)
    const activeTabBtn = document.querySelector('.tab-btn.active');
    if (activeTabBtn && activeTabBtn.dataset.mode) {
      activeMode = activeTabBtn.dataset.mode;
    }

    // 새 추출 시작 시 기존에 추출된 프레임이 있으면 자동으로 깨끗하게 비우고 새로 시작
    if (extractedFrames.length > 0) {
      extractedFrames.forEach(f => URL.revokeObjectURL(f.dataUrl));
      extractedFrames = [];
      galleryGrid.innerHTML = '';
      galleryCountBadge.textContent = '0장';
      galleryEmptyState.style.display = 'none';
      galleryGrid.style.display = 'grid';
      galleryActions.style.opacity = '1';
      galleryActions.style.pointerEvents = 'auto';
    }

    // Prepare extraction state
    isExtracting = true;
    abortRequested = false;
    startExtractBtn.style.display = 'none';
    stopExtractBtn.style.display = 'inline-flex';
    progressCard.style.display = 'block';
    progressCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    const format = imgFormatSelect.value;
    const quality = parseFloat(imgQualityRange.value) || 0.9;
    const scaleOption = resolutionScaleSelect.value;
    const prefix = (filePrefixInput.value || 'frame').trim();
    const ext = format === 'image/jpeg' ? 'jpg' : (format === 'image/webp' ? 'webp' : 'png');

    // Determine target canvas dimensions
    let targetW = videoWidth;
    let targetH = videoHeight;
    if (scaleOption === '0.75') {
      targetW = Math.round(videoWidth * 0.75);
      targetH = Math.round(videoHeight * 0.75);
    } else if (scaleOption === '0.5') {
      targetW = Math.round(videoWidth * 0.5);
      targetH = Math.round(videoHeight * 0.5);
    } else if (scaleOption === '1080p') {
      if (videoHeight > 1080) {
        targetW = Math.round((1080 / videoHeight) * videoWidth);
        targetH = 1080;
      }
    } else if (scaleOption === '720p') {
      if (videoHeight > 720) {
        targetW = Math.round((720 / videoHeight) * videoWidth);
        targetH = 720;
      }
    }

    offscreenCanvas.width = targetW;
    offscreenCanvas.height = targetH;

    // Dedicated extraction video element
    const extractVideo = document.createElement('video');
    extractVideo.muted = true;
    extractVideo.playsInline = true;
    extractVideo.preload = 'auto';
    extractVideo.crossOrigin = 'anonymous';
    extractVideo.src = previewVideo.src;

    await new Promise(resolve => {
      if (extractVideo.readyState >= 1) return resolve();
      extractVideo.onloadedmetadata = () => resolve();
      setTimeout(resolve, 800);
    });

    let completed = 0;

    // =========================================================
    // Mode A: Scene Change Detection Mode (장면 전환 감지)
    // =========================================================
    if (activeMode === 'scene') {
      const { start, end, span } = getActiveTimeRange();
      const sampleStep = parseFloat(sceneSampleRateSelect.value) || 1.0;
      const threshold = (parseFloat(sceneThresholdInput.value) || 12) / 100.0;
      const minDuration = parseFloat(sceneMinDurationInput.value) || 3.0;

      progressStatusLabel.textContent = '슬라이드/장면 전환 감지 중 (핵심 화면만 요약)...';

      // 80x45 소형 캔버스로 고속 비교 및 미세 노이즈 자연 필터링
      const diffCanvas = document.createElement('canvas');
      diffCanvas.width = 80;
      diffCanvas.height = 45;
      const diffCtx = diffCanvas.getContext('2d', { willReadFrequently: true });

      let lastCapturedTime = -999;
      let prevImageData = null;

      // Capture frame helper
      const captureCurrentFrame = async (t, changePct = null) => {
        canvasCtx.drawImage(extractVideo, 0, 0, targetW, targetH);
        const blob = await new Promise(res => offscreenCanvas.toBlob(res, format, quality));
        const dataUrl = URL.createObjectURL(blob);
        const frameTime = (typeof extractVideo.currentTime === 'number' && !isNaN(extractVideo.currentTime)) ? extractVideo.currentTime : t;
        const frameNumber = String(extractedFrames.length + 1).padStart(4, '0');
        const filename = `${prefix}_scene${frameNumber}_${formatTimeCode(frameTime)}.${ext}`;

        const frameItem = {
          id: `f_${Date.now()}_${extractedFrames.length}`,
          index: extractedFrames.length + 1,
          time: frameTime,
          timestampStr: formatTimeCode(frameTime),
          blob,
          dataUrl,
          width: targetW,
          height: targetH,
          filename,
          changePct: changePct !== null ? `${(changePct * 100).toFixed(0)}%` : '시작'
        };

        extractedFrames.push(frameItem);
        appendFrameToGallery(frameItem);
        completed++;
      };

      // 1. 영상 시작점 첫 화면 1장 캡처
      await seekVideo(extractVideo, start);
      diffCtx.drawImage(extractVideo, 0, 0, 80, 45);
      prevImageData = diffCtx.getImageData(0, 0, 80, 45).data;
      await captureCurrentFrame(start, null);
      lastCapturedTime = start;

      // 2. 검사 주기로 건너뛰며 '순간적인 슬라이드 전환(Step Jump)'만 정확히 포착
      for (let t = start + sampleStep; t <= end; t += sampleStep) {
        if (abortRequested) {
          showToast('장면 감지가 사용자에 의해 중단되었습니다.');
          break;
        }

        await seekVideo(extractVideo, t);
        diffCtx.drawImage(extractVideo, 0, 0, 80, 45);
        const currImageData = diffCtx.getImageData(0, 0, 80, 45).data;

        // 직전 탐색 스텝(1초 전) 대비 순간 화면 변화율 측정
        const diffScore = calculatePixelDifference(prevImageData, currImageData);
        const timeSinceLast = t - lastCapturedTime;

        // Progress UI
        const pct = Math.min(100, Math.round(((t - start) / span) * 100));
        progressBarFill.style.width = `${pct}%`;
        progressPercentLabel.textContent = `${pct}%`;
        progressCountLabel.textContent = `핵심 장면: ${completed}장 추출`;
        progressCurrentTimeLabel.textContent = `분석: ${formatTimeCode(t)} / ${formatTimeCode(end)} (순간 변화: ${(diffScore * 100).toFixed(0)}%)`;

        // 핵심 슬라이드 전환 조건:
        // 최소 슬라이드 유지 시간(3초)을 지났고, 직전 대비 화면이 임계값 이상 크게 바뀐 순간!
        if (timeSinceLast >= minDuration && diffScore >= threshold) {
          await captureCurrentFrame(t, diffScore);
          lastCapturedTime = t;
        }

        // 매번 직전 화면을 현재 화면으로 갱신 (마우스 움직임은 누적되지 않고 버려짐!)
        prevImageData = currImageData;

        // Brief yield
        await new Promise(r => setTimeout(r, 4));
      }
    }
    // =========================================================
    // Mode B: Standard Timestamps (Interval, TotalCount, FPS)
    // =========================================================
    else {
      const timestamps = calculateTargetTimestamps();
      if (timestamps.length === 0) {
        showToast('추출할 프레임이 없습니다. 시간 설정을 확인해주세요.');
        isExtracting = false;
        startExtractBtn.style.display = 'inline-flex';
        stopExtractBtn.style.display = 'none';
        progressCard.style.display = 'none';
        return;
      }

      if (timestamps.length > 500) {
        const confirmContinue = confirm(`추출할 프레임이 총 ${timestamps.length}장으로 많습니다. 계속 진행하시겠습니까?`);
        if (!confirmContinue) {
          isExtracting = false;
          startExtractBtn.style.display = 'inline-flex';
          stopExtractBtn.style.display = 'none';
          progressCard.style.display = 'none';
          return;
        }
      }

      progressStatusLabel.textContent = '비디오 프레임 추출 중...';
      const total = timestamps.length;

      for (let i = 0; i < total; i++) {
        if (abortRequested) {
          showToast('프레임 추출이 사용자에 의해 중단되었습니다.');
          break;
        }

        const t = timestamps[i];
        await seekVideo(extractVideo, t);

        // Draw onto canvas
        canvasCtx.drawImage(extractVideo, 0, 0, targetW, targetH);

        // Create Blob
        const blob = await new Promise(resolve => offscreenCanvas.toBlob(resolve, format, quality));
        const dataUrl = URL.createObjectURL(blob);

        const frameNumber = String(extractedFrames.length + 1).padStart(4, '0');
        const filename = `${prefix}_${frameNumber}_${formatTimeCode(t)}.${ext}`;

        const frameItem = {
          id: `f_${Date.now()}_${i}`,
          index: extractedFrames.length + 1,
          time: t,
          timestampStr: formatTimeCode(t),
          blob,
          dataUrl,
          width: targetW,
          height: targetH,
          filename
        };

        extractedFrames.push(frameItem);
        appendFrameToGallery(frameItem);

        completed++;
        const pct = Math.round((completed / total) * 100);
        progressBarFill.style.width = `${pct}%`;
        progressPercentLabel.textContent = `${pct}%`;
        progressCountLabel.textContent = `${completed} / ${total} 프레임 완료`;
        progressCurrentTimeLabel.textContent = `현재 타임: ${formatTimeCode(t)}`;

        await new Promise(r => setTimeout(r, 8));
      }
    }

    // Extraction cleanup
    extractVideo.removeAttribute('src');
    extractVideo.load();

    isExtracting = false;
    startExtractBtn.style.display = 'inline-flex';
    stopExtractBtn.style.display = 'none';

    if (!abortRequested) {
      const msg = activeMode === 'scene'
        ? `총 ${completed}개의 새로운 장면 전환 프레임이 감지되어 추출되었습니다! 🎬`
        : `총 ${completed}개의 프레임이 성공적으로 추출되었습니다! 🎉`;
      showToast(msg);
      progressStatusLabel.textContent = '추출 완료!';
      setTimeout(() => {
        progressCard.style.display = 'none';
      }, 3500);
    } else {
      progressCard.style.display = 'none';
    }
  });

  stopExtractBtn.addEventListener('click', () => {
    abortRequested = true;
    stopExtractBtn.disabled = true;
    progressStatusLabel.textContent = '추출 중단 중...';
  });

  function seekVideo(video, time) {
    return new Promise(resolve => {
      const maxTime = Math.max(0, (video.duration || time + 1) - 0.05);
      const targetTime = Math.max(0, Math.min(time, maxTime));

      // 이미 해당 시점 근처에 있으면 즉시 resolve
      if (Math.abs(video.currentTime - targetTime) < 0.03) {
        setTimeout(resolve, 15);
        return;
      }

      let resolved = false;
      let timer = null;

      const done = () => {
        if (resolved) return;
        resolved = true;
        video.removeEventListener('seeked', onSeeked);
        if (timer) clearTimeout(timer);
        // 브라우저 캔버스 디코딩 안정화를 위한 마이크로 딜레이
        setTimeout(resolve, 20);
      };

      const onSeeked = () => {
        done();
      };

      video.addEventListener('seeked', onSeeked);

      // 영상 버퍼링 지연이나 이벤트 누락으로 무한 대기하지 않도록 500ms 안전 타임아웃
      timer = setTimeout(() => {
        done();
      }, 500);

      video.currentTime = targetTime;
    });
  }

  // -------------------------------------------------------------
  // 6. Gallery Management & Rendering
  // -------------------------------------------------------------

  function appendFrameToGallery(frame) {
    galleryEmptyState.style.display = 'none';
    galleryGrid.style.display = 'grid';
    galleryActions.style.opacity = '1';
    galleryActions.style.pointerEvents = 'auto';
    galleryCountBadge.textContent = `${extractedFrames.length}장`;

    const card = document.createElement('div');
    card.className = 'frame-card';
    card.id = `card_${frame.id}`;

    card.innerHTML = `
      <div class="frame-thumbnail-wrap">
        <img src="${frame.dataUrl}" alt="${frame.filename}" loading="lazy">
        <span class="frame-badge-idx">#${frame.index}</span>
        <span class="frame-badge-time">${frame.timestampStr}</span>
        <div class="frame-overlay-hover">
          <button type="button" class="btn btn-sm btn-primary view-btn">확대</button>
        </div>
      </div>
      <div class="frame-footer">
        <span class="frame-title" title="${frame.filename}">${frame.filename}</span>
        <div class="frame-footer-actions">
          <button type="button" class="mini-btn dl-btn" title="이 이미지 다운로드">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          </button>
          <button type="button" class="mini-btn del-btn" title="삭제">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
    `;

    // Event: Click to view modal
    const thumbWrap = card.querySelector('.frame-thumbnail-wrap');
    thumbWrap.addEventListener('click', () => {
      openLightbox(frame.id);
    });

    // Event: Download single frame
    const dlBtn = card.querySelector('.dl-btn');
    dlBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      downloadSingleFrame(frame);
    });

    // Event: Delete single frame
    const delBtn = card.querySelector('.del-btn');
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteSingleFrame(frame.id);
    });

    galleryGrid.appendChild(card);
  }

  function downloadSingleFrame(frame) {
    if (window.saveAs) {
      window.saveAs(frame.blob, frame.filename);
    } else {
      const a = document.createElement('a');
      a.href = frame.dataUrl;
      a.download = frame.filename;
      a.click();
    }
    showToast(`'${frame.filename}' 다운로드 완료!`);
  }

  function deleteSingleFrame(id) {
    const idx = extractedFrames.findIndex(f => f.id === id);
    if (idx !== -1) {
      URL.revokeObjectURL(extractedFrames[idx].dataUrl);
      extractedFrames.splice(idx, 1);
      const card = document.getElementById(`card_${id}`);
      if (card) card.remove();

      galleryCountBadge.textContent = `${extractedFrames.length}장`;
      if (extractedFrames.length === 0) {
        galleryEmptyState.style.display = 'flex';
        galleryGrid.style.display = 'none';
        galleryActions.style.opacity = '0.5';
        galleryActions.style.pointerEvents = 'none';
      }
    }
  }

  clearAllBtn.addEventListener('click', () => {
    if (extractedFrames.length === 0) return;
    if (confirm('추출된 모든 이미지를 삭제하시겠습니까?')) {
      extractedFrames.forEach(f => URL.revokeObjectURL(f.dataUrl));
      extractedFrames = [];
      galleryGrid.innerHTML = '';
      galleryEmptyState.style.display = 'flex';
      galleryGrid.style.display = 'none';
      galleryActions.style.opacity = '0.5';
      galleryActions.style.pointerEvents = 'none';
      galleryCountBadge.textContent = '0장';
      showToast('모든 이미지가 삭제되었습니다.');
    }
  });

  // -------------------------------------------------------------
  // 7. Batch ZIP Download
  // -------------------------------------------------------------

  downloadZipBtn.addEventListener('click', async () => {
    if (extractedFrames.length === 0) {
      showToast('다운로드할 이미지가 없습니다.');
      return;
    }

    if (!window.JSZip) {
      showToast('ZIP 라이브러리가 로드되지 않았습니다.');
      return;
    }

    const zip = new JSZip();
    const folder = zip.folder('extracted_frames');

    showToast('전체 이미지를 ZIP 파일로 압축하는 중입니다...');
    downloadZipBtn.disabled = true;
    downloadZipBtn.innerHTML = `<span>압축 생성 중...</span>`;

    extractedFrames.forEach((frame) => {
      folder.file(frame.filename, frame.blob);
    });

    try {
      const content = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      const baseName = currentFile ? currentFile.name.replace(/\.[^/.]+$/, '') : 'frames';
      const now = new Date();
      const timeStamp = `${now.getFullYear()}${padZero(now.getMonth() + 1)}${padZero(now.getDate())}_${padZero(now.getHours())}${padZero(now.getMinutes())}`;
      const zipFileName = `${baseName}_frames_${timeStamp}.zip`;

      window.saveAs(content, zipFileName);
      showToast(`'${zipFileName}' 압축 다운로드가 시작되었습니다!`);
    } catch (err) {
      console.error(err);
      showToast('ZIP 파일 생성 중 오류가 발생했습니다.');
    } finally {
      downloadZipBtn.disabled = false;
      downloadZipBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        <span>전체 ZIP 압축 다운로드</span>
      `;
    }
  });

  // -------------------------------------------------------------
  // 8. Lightbox Modal
  // -------------------------------------------------------------

  function openLightbox(id) {
    const idx = extractedFrames.findIndex(f => f.id === id);
    if (idx === -1) return;

    activeModalIndex = idx;
    updateModalView();
    imageModal.style.display = 'flex';
  }

  function updateModalView() {
    if (activeModalIndex < 0 || activeModalIndex >= extractedFrames.length) return;
    const frame = extractedFrames[activeModalIndex];
    modalImage.src = frame.dataUrl;
    modalFileName.textContent = frame.filename;
    modalTimeBadge.textContent = frame.timestampStr;
    modalDimBadge.textContent = `${frame.width} × ${frame.height}`;

    modalPrevBtn.style.visibility = (activeModalIndex > 0) ? 'visible' : 'hidden';
    modalNextBtn.style.visibility = (activeModalIndex < extractedFrames.length - 1) ? 'visible' : 'hidden';
  }

  modalCloseBtn.addEventListener('click', () => {
    imageModal.style.display = 'none';
  });

  imageModal.addEventListener('click', (e) => {
    if (e.target === imageModal) {
      imageModal.style.display = 'none';
    }
  });

  modalPrevBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (activeModalIndex > 0) {
      activeModalIndex--;
      updateModalView();
    }
  });

  modalNextBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (activeModalIndex < extractedFrames.length - 1) {
      activeModalIndex++;
      updateModalView();
    }
  });

  modalDownloadBtn.addEventListener('click', () => {
    if (activeModalIndex >= 0 && activeModalIndex < extractedFrames.length) {
      downloadSingleFrame(extractedFrames[activeModalIndex]);
    }
  });

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (imageModal.style.display === 'flex') {
      if (e.key === 'Escape') imageModal.style.display = 'none';
      if (e.key === 'ArrowLeft' && activeModalIndex > 0) {
        activeModalIndex--;
        updateModalView();
      }
      if (e.key === 'ArrowRight' && activeModalIndex < extractedFrames.length - 1) {
        activeModalIndex++;
        updateModalView();
      }
    }
  });

  // -------------------------------------------------------------
  // 9. Helpers & Utilities
  // -------------------------------------------------------------

  function formatDuration(sec) {
    if (isNaN(sec) || sec < 0) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${padZero(m)}:${padZero(s)}`;
  }

  function formatTimeCode(sec) {
    if (isNaN(sec) || sec < 0) return '00:00.00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 100);
    return `${padZero(m)}m${padZero(s)}s${padZero(ms)}`;
  }

  function padZero(num) {
    return String(num).padStart(2, '0');
  }

  let toastTimer = null;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 3200);
  }

  // Server health check
  const serverStatusBadge = document.getElementById('serverStatusBadge');
  const serverStatusText = document.getElementById('serverStatusText');
  async function checkServerStatus() {
    try {
      const apiBase = window.location.origin.startsWith('http')
        ? window.location.origin
        : 'http://localhost:8080';
      const res = await fetch(`${apiBase}/api/ping`, { cache: 'no-store' });
      if (res.ok) {
        if (serverStatusText) serverStatusText.textContent = `서버: 온라인 (${apiBase.replace(/^https?:\/\//, '')})`;
        if (serverStatusBadge) {
          serverStatusBadge.classList.remove('offline');
          serverStatusBadge.classList.add('online');
        }
      }
    } catch (e) {
      if (serverStatusText) serverStatusText.textContent = '서버: 오프라인 (서버 실행 필요)';
      if (serverStatusBadge) {
        serverStatusBadge.classList.remove('online');
        serverStatusBadge.classList.add('offline');
      }
    }
  }
  checkServerStatus();
});
