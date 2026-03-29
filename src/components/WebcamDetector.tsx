import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

type HandPoint = {
  x: number;
  y: number;
  z: number;
};

type VideoType = 'panopto' | 'youtube' | 'other';

// Extract session ID from a Panopto URL or bare GUID
function extractSessionId(input: string): string | null {
  const guidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const match = input.match(guidPattern);
  return match ? match[0] : null;
}

// Build an embed URL from a Panopto, YouTube, or direct URL
function buildEmbedUrl(input: string): { url: string; type: VideoType } | null {
  const trimmed = input.trim();

  // Panopto
  if (trimmed.toLowerCase().includes('panopto')) {
    const id = extractSessionId(trimmed);
    if (id) return {
      url: `https://uniofbath.cloud.panopto.eu/Panopto/Pages/Embed.aspx?id=${id}&autoplay=false&offerviewer=true&showtitle=false&showbrand=false&captions=false&interactivity=all`,
      type: 'panopto',
    };
  }

  // YouTube
  const ytMatch = trimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]+)/);
  if (ytMatch) return {
    url: `https://www.youtube.com/embed/${ytMatch[1]}`,
    type: 'youtube',
  };

  // Already an embed URL or direct URL
  if (trimmed.startsWith('http')) return { url: trimmed, type: 'other' };

  return null;
}

type GestureType = '67' | 'rickroll';

type PositionEntry = { x: number; y: number; time: number; shoulderMidY?: number; hipMidY?: number; bodyCenterX?: number };

const GESTURE_WINDOW_MS = 3000; // 3 second window
// Displacement thresholds as a proportion of torso height
const MIN_DISPLACEMENT_Y_RATIO = 0.15; // 15% of torso height for 67 (up-down)
const MIN_DISPLACEMENT_X_RATIO = 0.20; // 20% of torso height for rickroll (side-to-side)
// Fallbacks if torso can't be measured
const MIN_DISPLACEMENT_Y_FALLBACK = 0.10;
const MIN_DISPLACEMENT_X_FALLBACK = 0.08;
const REQUIRED_REVERSALS = 4; // 2 full pumps/sweeps = 4 direction changes
const GESTURE_COOLDOWN_MS = 3000; // 3 seconds between same gesture events
const MIN_BELOW_SHOULDER_RATIO = 0.6; // 60% of frames must have wrist below shoulder level
const HIP_MARGIN_RATIO = 0.1; // 10% torso-height tolerance below hip line

// Pose landmark indices
const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;
const LEFT_HIP = 23;
const RIGHT_HIP = 24;

function computeTorsoHeight(pose: { x: number; y: number; z: number }[]): number | null {
  if (pose.length < 25) return null;
  const shoulderMidY = (pose[LEFT_SHOULDER].y + pose[RIGHT_SHOULDER].y) / 2;
  const hipMidY = (pose[LEFT_HIP].y + pose[RIGHT_HIP].y) / 2;
  const height = Math.abs(hipMidY - shoulderMidY);
  return height > 0.01 ? height : null; // ignore if too small (bad detection)
}

// Check that a wrist was below shoulder level for enough of the gesture window
function checkBelowShoulderRatio(history: PositionEntry[], torsoHeight: number | null): boolean {
  const entries = history.filter(p => p.shoulderMidY !== undefined);
  if (entries.length < 3) return false;
  const margin = torsoHeight ? torsoHeight * HIP_MARGIN_RATIO : 0.02;
  // Y=0 is top, Y=1 is bottom: wrist must be below shoulders
  const belowCount = entries.filter(p => p.y >= p.shoulderMidY! - margin).length;
  return belowCount / entries.length >= MIN_BELOW_SHOULDER_RATIO;
}

// Check that a wrist was between shoulder and hip level for enough of the gesture window
function checkInTorsoZone(history: PositionEntry[], torsoHeight: number | null): boolean {
  const entries = history.filter(p => p.shoulderMidY !== undefined && p.hipMidY !== undefined);
  if (entries.length < 3) return false;
  const margin = torsoHeight ? torsoHeight * HIP_MARGIN_RATIO : 0.02;
  const inZoneCount = entries.filter(p =>
    p.y >= p.shoulderMidY! - margin && p.y <= p.hipMidY! - margin
  ).length;
  return inZoneCount / entries.length >= MIN_BELOW_SHOULDER_RATIO;
}

// Count direction reversals along one axis within a position history
function countReversals(values: number[], minDisplacement: number): number {
  if (values.length < 3) return 0;

  let reversals = 0;
  let lastDir: 'up' | 'down' | null = null;
  let lastAnchor = values[0];

  for (let i = 1; i < values.length; i++) {
    const delta = values[i] - lastAnchor;
    if (Math.abs(delta) < minDisplacement) continue;

    const dir = delta > 0 ? 'up' : 'down';
    if (lastDir !== null && dir !== lastDir) {
      reversals++;
    }
    lastDir = dir;
    lastAnchor = values[i];
  }

  return reversals;
}

function detectGesture(
  handHistories: PositionEntry[][],
  torsoHeight: number | null,
): GestureType | null {
  const minDispY = torsoHeight ? torsoHeight * MIN_DISPLACEMENT_Y_RATIO : MIN_DISPLACEMENT_Y_FALLBACK;
  const minDispX = torsoHeight ? torsoHeight * MIN_DISPLACEMENT_X_RATIO : MIN_DISPLACEMENT_X_FALLBACK;

  // 67: both hands pumping up and down in OPPOSITE directions
  if (handHistories.length >= 2 && handHistories[0].length >= 3 && handHistories[1].length >= 3) {
    const yRev0 = countReversals(handHistories[0].map((p) => p.y), minDispY);
    const yRev1 = countReversals(handHistories[1].map((p) => p.y), minDispY);

    if (yRev0 >= REQUIRED_REVERSALS && yRev1 >= REQUIRED_REVERSALS
      && checkBelowShoulderRatio(handHistories[0], torsoHeight)
      && checkBelowShoulderRatio(handHistories[1], torsoHeight)) {
      const h0 = handHistories[0];
      const h1 = handHistories[1];

      let oppositeCount = 0;
      let totalCount = 0;
      let j = 0;
      for (let i = 1; i < h0.length; i++) {
        while (j < h1.length - 1 && Math.abs(h1[j + 1].time - h0[i].time) < Math.abs(h1[j].time - h0[i].time)) {
          j++;
        }
        if (j === 0) continue;

        let prevJ = 0;
        for (let k = 0; k < h1.length - 1; k++) {
          if (Math.abs(h1[k].time - h0[i - 1].time) < Math.abs(h1[prevJ].time - h0[i - 1].time)) {
            prevJ = k;
          }
        }

        const dy0 = h0[i].y - h0[i - 1].y;
        const dy1 = h1[j].y - h1[prevJ].y;

        if (Math.abs(dy0) > 0.01 && Math.abs(dy1) > 0.01) {
          totalCount++;
          if ((dy0 > 0 && dy1 < 0) || (dy0 < 0 && dy1 > 0)) {
            oppositeCount++;
          }
        }
      }

      if (totalCount > 0 && oppositeCount / totalCount >= 0.4) {
        return '67';
      }
    }
  }

  // Rickroll: both hands moving side to side (X-axis reversals on both)
  // But NOT if there's significant Y movement (that's a 67, not a rickroll)
  if (handHistories.length >= 2) {
    const yRev0r = countReversals(handHistories[0].map((p) => p.y), minDispY);
    const yRev1r = countReversals(handHistories[1].map((p) => p.y), minDispY);
    const hasSignificantY = yRev0r >= REQUIRED_REVERSALS || yRev1r >= REQUIRED_REVERSALS;

    if (!hasSignificantY
      && checkInTorsoZone(handHistories[0], torsoHeight)
      && checkInTorsoZone(handHistories[1], torsoHeight)) {
      const bothHaveSweeps = handHistories.slice(0, 2).every((history) => {
        if (history.length < 3) return false;
        const xValues = history.map((p) => p.bodyCenterX !== undefined ? p.x - p.bodyCenterX : p.x);
        return countReversals(xValues, minDispX) >= REQUIRED_REVERSALS;
      });
      if (bothHaveSweeps) return 'rickroll';
    }
  }

  return null;
}

type GestureLogEntry = { gesture: GestureType; timestamp: number };

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

let ytApiReady: Promise<void> | null = null;
function loadYouTubeApi(): Promise<void> {
  if (ytApiReady) return ytApiReady;
  ytApiReady = new Promise<void>((resolve) => {
    if (window.YT?.Player) { resolve(); return; }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(); };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  });
  return ytApiReady;
}

export type { GestureLogEntry };

export interface WebcamDetectorHandle {
  seekTo: (seconds: number) => void;
}

interface WebcamDetectorProps {
  onGesture?: (gesture: GestureType) => void;
  onGestureLog?: (entry: GestureLogEntry) => void;
}

export const WebcamDetector = forwardRef<WebcamDetectorHandle, WebcamDetectorProps>(function WebcamDetector({ onGesture, onGestureLog }, ref) {
  const captureVideoRef = useRef<HTMLVideoElement>(null);
  const directVideoRef = useRef<HTMLVideoElement>(null);
  const cropCanvasRef = useRef<HTMLCanvasElement>(null);
  const debugOverlayRef = useRef<HTMLCanvasElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const playerShellRef = useRef<HTMLDivElement>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const directAnimFrameRef = useRef<number | null>(null);
  const frameInFlightRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const handHistoriesRef = useRef<PositionEntry[][]>([[], []]);
  const lastGestureTimeRef = useRef<Record<GestureType, number>>({ '67': 0, rickroll: 0 });
  const onGestureRef = useRef(onGesture);
  onGestureRef.current = onGesture;
  const onGestureLogRef = useRef(onGestureLog);
  onGestureLogRef.current = onGestureLog;
  const ytPlayerRef = useRef<YTPlayer | null>(null);
  const ytContainerRef = useRef<HTMLDivElement>(null);
  const [modelReady, setModelReady] = useState(false);
  const [lastGesture, setLastGesture] = useState<string | null>(null);
  const [videoInput, setVideoInput] = useState('');
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);
  const [videoType, setVideoType] = useState<VideoType>('other');
  const videoTypeRef = useRef<VideoType>('other');
  const [isSharing, setIsSharing] = useState(false);
  const [isDirectAnalyzing, setIsDirectAnalyzing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [handPosition, setHandPosition] = useState<HandPoint | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [statusText, setStatusText] = useState(
    'Loading pose detection model...'
  );

  const seekToTimestamp = useCallback((seconds: number) => {
    if (videoType === 'other' && directVideoRef.current) {
      directVideoRef.current.currentTime = seconds;
    } else if (videoType === 'youtube' && ytPlayerRef.current?.seekTo) {
      ytPlayerRef.current.seekTo(seconds, true);
    }
  }, [videoType]);

  useImperativeHandle(ref, () => ({ seekTo: seekToTimestamp }), [seekToTimestamp]);

  // Initialize HandLandmarker model on mount
  useEffect(() => {
    let cancelled = false;

    async function initModel() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
        );
        if (cancelled) return;

        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.3,
          minPosePresenceConfidence: 0.3,
          minTrackingConfidence: 0.3,
        });
        if (cancelled) {
          landmarker.close();
          return;
        }

        poseLandmarkerRef.current = landmarker;
        setModelReady(true);
        setStatusText('Model loaded. Paste a Panopto or YouTube link.');
      } catch (err) {
        console.error('Failed to load PoseLandmarker:', err);
        setStatusText(`Model load failed: ${(err as Error).message}`);
      }
    }

    initModel();
    return () => {
      cancelled = true;
      if (poseLandmarkerRef.current) {
        poseLandmarkerRef.current.close();
        poseLandmarkerRef.current = null;
      }
    };
  }, []);

  // Overlay scaleX: Panopto uses left half (0.5), YouTube/other uses full frame (1.0)
  const overlayScaleXRef = useRef(1.0);
  overlayScaleXRef.current = videoType === 'panopto' ? 0.5 : 1.0;

  const syncCanvasToPlayerSize = () => {
    const shell = playerShellRef.current;
    const canvas = overlayRef.current;
    if (!shell || !canvas) return;

    const width = Math.floor(shell.clientWidth);
    const height = Math.floor(shell.clientHeight);
    if (width > 0 && height > 0 && (canvas.width !== width || canvas.height !== height)) {
      canvas.width = width;
      canvas.height = height;
    }
  };

  // Pose landmark indices
  // 15 = left wrist, 16 = right wrist
  // 11 = left shoulder, 12 = right shoulder, 13 = left elbow, 14 = right elbow
  const LEFT_WRIST = 15;
  const RIGHT_WRIST = 16;

  // Process pose detection results — draw overlays, track wrist history, detect gestures
  const processResults = useCallback((poseLandmarks: { x: number; y: number; z: number }[][]) => {
    const canvas = overlayRef.current;
    if (!canvas) return;

    syncCanvasToPlayerSize();

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!poseLandmarks || poseLandmarks.length === 0) {
      setHandPosition(null);
      // Clear history when pose is lost (scene cut, model lost tracking)
      handHistoriesRef.current = [[], []];
      return;
    }

    const now = Date.now();
    const rawPose = poseLandmarks[0]; // first (only) detected pose

    const pose = rawPose;

    const torsoHeight = computeTorsoHeight(pose);

    // Extract wrist positions
    const leftWrist = pose[LEFT_WRIST];
    const rightWrist = pose[RIGHT_WRIST];
    const wrists = [leftWrist, rightWrist];

    // Draw full pose skeleton on the main overlay
    // Landmarks are normalized to the cropped input region,
    // so scale x to map onto the full-width overlay
    const scaleX = overlayScaleXRef.current;

    // Draw all 33 pose landmarks
    for (const point of pose) {
      ctx.beginPath();
      ctx.arc(point.x * scaleX * canvas.width, point.y * canvas.height, 2, 0, 2 * Math.PI);
      ctx.fillStyle = '#60a5fa';
      ctx.fill();
    }

    // Draw skeleton connections
    const connections = [
      [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], // arms
      [11, 23], [12, 24], [23, 24], // torso
      [23, 25], [25, 27], [24, 26], [26, 28], // legs
    ];
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.4;
    for (const [a, b] of connections) {
      ctx.beginPath();
      ctx.moveTo(pose[a].x * scaleX * canvas.width, pose[a].y * canvas.height);
      ctx.lineTo(pose[b].x * scaleX * canvas.width, pose[b].y * canvas.height);
      ctx.stroke();
    }
    ctx.globalAlpha = 1.0;

    // Highlight wrists with larger circles
    wrists.forEach((wrist, i) => {
      const color = i === 0 ? '#22c55e' : '#f59e0b';
      ctx.beginPath();
      ctx.arc(wrist.x * scaleX * canvas.width, wrist.y * canvas.height, 8, 0, 2 * Math.PI);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(i === 0 ? 'L' : 'R', wrist.x * scaleX * canvas.width - 4, wrist.y * canvas.height - 12);
    });

    setHandPosition({ x: leftWrist.x, y: leftWrist.y, z: leftWrist.z });

    // Track wrist position history for gesture detection
    // Sort wrists by X position so the same physical hand always maps to the same slot
    const sortedWrists = [...wrists].sort((a, b) => a.x - b.x);
    sortedWrists.forEach((wrist, slotIndex) => {
      const history = handHistoriesRef.current[slotIndex];
      const shoulderMidY = (pose[LEFT_SHOULDER].y + pose[RIGHT_SHOULDER].y) / 2;
      const hipMidY = (pose[LEFT_HIP].y + pose[RIGHT_HIP].y) / 2;
      const bodyCenterX = (pose[LEFT_SHOULDER].x + pose[RIGHT_SHOULDER].x) / 2;
      history.push({ x: wrist.x, y: wrist.y, time: now, shoulderMidY, hipMidY, bodyCenterX });
      const cutoff = now - GESTURE_WINDOW_MS;
      while (history.length > 0 && history[0].time < cutoff) {
        history.shift();
      }
    });

    // Draw pose detection overlay on the debug crop canvas
    const debugCanvas = debugOverlayRef.current;
    if (debugCanvas) {
      const cropCanvas = cropCanvasRef.current;
      if (cropCanvas && cropCanvas.width > 0) {
        debugCanvas.width = cropCanvas.width;
        debugCanvas.height = cropCanvas.height;
      }
      const dCtx = debugCanvas.getContext('2d');
      if (dCtx) {
        dCtx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);

        // Draw all pose landmarks
        for (const point of pose) {
          dCtx.beginPath();
          dCtx.arc(point.x * debugCanvas.width, point.y * debugCanvas.height, 2, 0, 2 * Math.PI);
          dCtx.fillStyle = '#60a5fa';
          dCtx.fill();
        }

        // Highlight wrists
        wrists.forEach((wrist, i) => {
          const color = i === 0 ? '#22c55e' : '#f59e0b';
          dCtx.beginPath();
          dCtx.arc(wrist.x * debugCanvas.width, wrist.y * debugCanvas.height, 6, 0, 2 * Math.PI);
          dCtx.strokeStyle = color;
          dCtx.lineWidth = 2;
          dCtx.stroke();

          dCtx.fillStyle = color;
          dCtx.font = 'bold 10px sans-serif';
          dCtx.fillText(i === 0 ? 'L' : 'R', wrist.x * debugCanvas.width - 3, wrist.y * debugCanvas.height - 9);
        });

        // Draw wrist trails from history
        for (let h = 0; h < 2; h++) {
          const trail = handHistoriesRef.current[h];
          if (trail.length < 2) continue;
          const color = h === 0 ? '#22c55e' : '#f59e0b';
          dCtx.beginPath();
          dCtx.moveTo(trail[0].x * debugCanvas.width, trail[0].y * debugCanvas.height);
          for (let t = 1; t < trail.length; t++) {
            dCtx.lineTo(trail[t].x * debugCanvas.width, trail[t].y * debugCanvas.height);
          }
          dCtx.strokeStyle = color;
          dCtx.lineWidth = 2;
          dCtx.globalAlpha = 0.5;
          dCtx.stroke();
          dCtx.globalAlpha = 1.0;
        }
      }
    }

    // Run gesture detection
    const gesture = detectGesture(handHistoriesRef.current, torsoHeight);
    if (gesture && now - lastGestureTimeRef.current[gesture] > GESTURE_COOLDOWN_MS) {
      lastGestureTimeRef.current[gesture] = now;
      setLastGesture(gesture);
      console.log(`[${new Date().toLocaleTimeString()}] Gesture Detected: ${gesture}`);
      let videoTimestamp = 0;
      if (videoTypeRef.current === 'other' && directVideoRef.current) {
        videoTimestamp = directVideoRef.current.currentTime;
      } else if (videoTypeRef.current === 'youtube' && ytPlayerRef.current?.getCurrentTime) {
        videoTimestamp = ytPlayerRef.current.getCurrentTime();
      }
      const entry: GestureLogEntry = { gesture, timestamp: videoTimestamp };
      onGestureLogRef.current?.(entry);
      onGestureRef.current?.(gesture);
      handHistoriesRef.current = [[], []];
    }
  }, []);

  useEffect(() => {
    const onResize = () => syncCanvasToPlayerSize();
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Clean up stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // --- File upload handlers ---
  const handleFileUpload = (file: File) => {
    if (uploadedVideoUrl) URL.revokeObjectURL(uploadedVideoUrl);
    // Clear embed URL so the iframe hides
    setEmbedUrl(null);
    setIsSharing(false);
    const url = URL.createObjectURL(file);
    setUploadedVideoUrl(url);
    setVideoType('other');
    videoTypeRef.current = 'other';
    overlayScaleXRef.current = 1.0;
    setStatusText('Video file loaded. Playing and analyzing...');
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
      handleFileUpload(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  // --- Direct video analysis loop (for uploaded files) ---
  useEffect(() => {
    if (!uploadedVideoUrl || !modelReady) return;

    const video = directVideoRef.current;
    const landmarker = poseLandmarkerRef.current;
    if (!video || !landmarker) return;

    let cancelled = false;

    const loop = () => {
      if (cancelled || !directVideoRef.current || !poseLandmarkerRef.current) return;

      const v = directVideoRef.current;
      if (!v.paused && !v.ended && v.readyState >= 2) {
        try {
          const result = poseLandmarkerRef.current.detectForVideo(v, performance.now());
          processResults(result.landmarks);
          setIsDirectAnalyzing(true);
        } catch (err) {
          console.error('Direct video detection error:', err);
        }
      }

      directAnimFrameRef.current = requestAnimationFrame(loop);
    };

    directAnimFrameRef.current = requestAnimationFrame(loop);

    return () => {
      cancelled = true;
      if (directAnimFrameRef.current) {
        cancelAnimationFrame(directAnimFrameRef.current);
        directAnimFrameRef.current = null;
      }
      setIsDirectAnalyzing(false);
    };
  }, [uploadedVideoUrl, modelReady, processResults]);

  // Clean up uploaded video URL on unmount
  useEffect(() => {
    return () => {
      if (uploadedVideoUrl) URL.revokeObjectURL(uploadedVideoUrl);
    };
  }, [uploadedVideoUrl]);

  // Initialize YouTube IFrame API player when a YouTube URL is loaded
  useEffect(() => {
    if (videoType !== 'youtube' || !embedUrl) return;
    let destroyed = false;

    const match = embedUrl.match(/embed\/([\w-]+)/);
    if (!match) return;
    const videoId = match[1];

    loadYouTubeApi().then(() => {
      if (destroyed || !ytContainerRef.current) return;
      ytPlayerRef.current = new window.YT!.Player(ytContainerRef.current, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: { autoplay: 0, modestbranding: 1 },
      });
    });

    return () => {
      destroyed = true;
      ytPlayerRef.current?.destroy();
      ytPlayerRef.current = null;
    };
  }, [embedUrl, videoType]);

  const handleLoadVideo = () => {
    const result = buildEmbedUrl(videoInput);
    if (!result) {
      setStatusText('Could not parse URL. Paste a Panopto, YouTube, or embed link.');
      return;
    }

    // Clear uploaded file if switching to URL mode
    if (uploadedVideoUrl) {
      URL.revokeObjectURL(uploadedVideoUrl);
      setUploadedVideoUrl(null);
    }

    setEmbedUrl(result.url);
    setVideoType(result.type);
    videoTypeRef.current = result.type;
    setStatusText(`${result.type === 'panopto' ? 'Panopto' : result.type === 'youtube' ? 'YouTube' : 'Video'} loaded. Click "Start Capture" to begin.`);
  };

  const handleStopSharing = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    const video = captureVideoRef.current;
    if (video) {
      video.srcObject = null;
    }

    setIsSharing(false);
    setIsAnalyzing(false);
    setHandPosition(null);
    setStatusText('Capture stopped. Click "Start Capture" to resume.');

    const canvas = overlayRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  const handleStartCapture = async () => {
    if (!embedUrl) {
      setStatusText('Load a video first.');
      return;
    }
    // new Audio('/pipe.mp3').play().then(audio => audio).catch(() => {});
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'browser' } as MediaTrackConstraints,
        audio: false,
        preferCurrentTab: true,
      } as DisplayMediaStreamOptions);

      streamRef.current = stream;
      const video = captureVideoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }

      setIsSharing(true);
      setStatusText('Capturing tab. Hand tracking is active.');

      stream.getVideoTracks()[0].addEventListener('ended', () => {
        handleStopSharing();
      });
    } catch (err) {
      if ((err as DOMException).name === 'NotAllowedError') {
        setStatusText('Tab capture was cancelled.');
      } else {
        setStatusText(`Capture failed: ${(err as Error).message}`);
      }
    }
  };

  // MediaPipe analysis loop — captures tab, crops to player shell, feeds to HandLandmarker
  useEffect(() => {
    if (!isSharing || !modelReady) return;

    const video = captureVideoRef.current;
    const cropCanvas = cropCanvasRef.current;
    const shell = playerShellRef.current;
    const landmarker = poseLandmarkerRef.current;
    if (!video || !cropCanvas || !shell || !landmarker) return;

    let cancelled = false;

    // Offscreen canvas for flicker-free cropping
    const offscreen = document.createElement('canvas');
    const offCtx = offscreen.getContext('2d');
    // Upscaled canvas — HandLandmarker works better with larger images
    const upscaled = document.createElement('canvas');
    const upCtx = upscaled.getContext('2d');
    const MIN_MEDIAPIPE_WIDTH = 640;
    const cropCtx = cropCanvas.getContext('2d');
    let lastCropW = 0;
    let lastCropH = 0;

    const loop = () => {
      if (cancelled || !captureVideoRef.current || !poseLandmarkerRef.current || !cropCtx || !offCtx) return;

      const currentVideo = captureVideoRef.current;

      if (
        !currentVideo.paused &&
        !currentVideo.ended &&
        currentVideo.readyState >= 2 &&
        !frameInFlightRef.current
      ) {
        frameInFlightRef.current = true;
        try {
          const rect = shell.getBoundingClientRect();
          const tabWidth = document.documentElement.clientWidth;
          const tabHeight = document.documentElement.clientHeight;
          const vidWidth = currentVideo.videoWidth;
          const vidHeight = currentVideo.videoHeight;

          const scaleX = vidWidth / tabWidth;
          const scaleY = vidHeight / tabHeight;

          const sx = rect.left * scaleX;
          const sy = rect.top * scaleY;
          const fullW = Math.floor(rect.width * scaleX);
          const sh = Math.floor(rect.height * scaleY);

          // Panopto: crop to left half (lecturer side), YouTube/other: use full frame
          const sw = videoTypeRef.current === 'panopto' ? Math.floor(fullW / 2) : fullW;

          if (sw !== lastCropW || sh !== lastCropH) {
            offscreen.width = sw;
            offscreen.height = sh;
            cropCanvas.width = sw;
            cropCanvas.height = sh;
            lastCropW = sw;
            lastCropH = sh;
          }

          offCtx.drawImage(currentVideo, sx, sy, sw, sh, 0, 0, sw, sh);

          cropCtx.clearRect(0, 0, sw, sh);
          cropCtx.drawImage(offscreen, 0, 0);

          // Upscale for HandLandmarker if the crop is too small
          let mediapipeInput: HTMLCanvasElement = offscreen;
          if (sw < MIN_MEDIAPIPE_WIDTH && upCtx) {
            const scale = MIN_MEDIAPIPE_WIDTH / sw;
            const upW = Math.floor(sw * scale);
            const upH = Math.floor(sh * scale);
            if (upscaled.width !== upW || upscaled.height !== upH) {
              upscaled.width = upW;
              upscaled.height = upH;
            }
            upCtx.drawImage(offscreen, 0, 0, sw, sh, 0, 0, upW, upH);
            mediapipeInput = upscaled;
          }

          // Synchronous detection with tasks-vision API
          const result = poseLandmarkerRef.current.detectForVideo(mediapipeInput, performance.now());
          console.log('Pose results:', result.landmarks.length, 'poses detected');
          if (result.landmarks.length > 0) {
            console.log('First pose landmarks count:', result.landmarks[0].length);
          }
          processResults(result.landmarks);
          setIsAnalyzing(true);
        } catch (err) {
          console.error('Detection error:', err);
        } finally {
          frameInFlightRef.current = false;
        }
      }

      animationFrameRef.current = window.requestAnimationFrame(loop);
    };

    animationFrameRef.current = window.requestAnimationFrame(loop);

    return () => {
      cancelled = true;
      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      frameInFlightRef.current = false;
      setIsAnalyzing(false);
    };
  }, [isSharing, modelReady, processResults, handleStopSharing]);

  return (
    <div className="order-2 flex h-full w-full flex-col gap-4 p-4 bg-[#061126] border border-[#1a2d4a] rounded-lg shadow-lg overflow-auto text-slate-100">
      <div
        ref={playerShellRef}
        className={`relative w-full overflow-hidden rounded-lg bg-[#050b1a] border ${isDraggingFile ? 'border-blue-400 border-dashed' : 'border-[#1a2d4a]'}`}
        style={{ aspectRatio: '16 / 9' }}
        onDragOver={(e) => { e.preventDefault(); setIsDraggingFile(true); }}
        onDragLeave={() => setIsDraggingFile(false)}
        onDrop={handleFileDrop}
      >
        {uploadedVideoUrl ? (
          <video
            ref={directVideoRef}
            src={uploadedVideoUrl}
            className="h-full w-full object-contain"
            controls
            autoPlay
            muted
            loop
          />
        ) : embedUrl && videoType === 'youtube' ? (
          <div ref={ytContainerRef} className="h-full w-full" />
        ) : embedUrl ? (
          <iframe
            ref={iframeRef}
            src={embedUrl}
            title="Lecture Recording"
            className="h-full w-full"
            allowFullScreen
            allow="autoplay; encrypted-media"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center text-slate-400 gap-3">
            <p className="text-lg">Drag & drop a video file here</p>
            <p className="text-sm text-slate-500">or paste a Panopto / YouTube link below</p>
          </div>
        )}
        <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      </div>

      {/* Hidden video for tab capture */}
      <video
        ref={captureVideoRef}
        muted
        playsInline
        className="absolute left-[-9999px] top-[-9999px] h-1 w-1 opacity-0"
      />

      {/* Debug panel - uncomment to show cropped frame with pose overlay
      {isSharing && (
        <div className="rounded-lg border border-yellow-400 p-2">
          <p className="text-xs font-semibold text-yellow-600 mb-1">DEBUG: MediaPipe input + pose detection</p>
          <div className="relative" style={{ maxHeight: '200px' }}>
            <canvas
              ref={cropCanvasRef}
              className="w-full rounded bg-black"
              style={{ maxHeight: '200px', objectFit: 'contain' }}
            />
            <canvas
              ref={debugOverlayRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ maxHeight: '200px', objectFit: 'contain' }}
            />
          </div>
        </div>
      )}
      */}
      <canvas
        ref={cropCanvasRef}
        className="absolute left-[-9999px] top-[-9999px] h-1 w-1 opacity-0"
      />

      <div className="rounded-lg border border-[#1a2d4a] bg-[#0a1933] p-3">
        <p className="text-sm text-slate-200">
          {!modelReady
            ? 'Loading pose detection model...'
            : 'Upload a video file, or paste a Panopto/YouTube link.'}
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!modelReady}
            className="rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
          >
            Upload Video
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileInputChange}
            className="hidden"
          />
          <input
            type="text"
            value={videoInput}
            onChange={(e) => setVideoInput(e.target.value)}
            placeholder="Or paste Panopto / YouTube URL"
            className="w-full rounded-md border border-[#1a2d4a] bg-[#061126] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400"
          />
          <button
            type="button"
            onClick={handleLoadVideo}
            disabled={!modelReady}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Load URL
          </button>
          {!uploadedVideoUrl && (
            !isSharing ? (
              <button
                type="button"
                onClick={handleStartCapture}
                disabled={!embedUrl || !modelReady}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Start Capture
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStopSharing}
                className="rounded-md bg-[#16325f] px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-[#1d3c71]"
              >
                Stop Capture
              </button>
            )
          )}
        </div>
      </div>

      <div className="rounded-lg border border-[#1a2d4a] bg-[#0a1933] p-3 text-sm text-slate-100">
        <p>
          <span className="font-semibold">Status:</span> {statusText}
        </p>
        <p>
          <span className="font-semibold">Model:</span> {modelReady ? 'Ready (PoseLandmarker Lite)' : 'Loading...'}
        </p>
        <p>
          <span className="font-semibold">Analyzing:</span> {isAnalyzing || isDirectAnalyzing ? 'Yes' : 'No'}
        </p>
        <p>
          <span className="font-semibold">Capturing:</span> {isSharing ? 'Yes' : 'No'}
        </p>
        <p>
          <span className="font-semibold">Hand position:</span>{' '}
          {handPosition
            ? `x ${(handPosition.x * 100).toFixed(1)}%, y ${(handPosition.y * 100).toFixed(1)}%, z ${handPosition.z.toFixed(3)}`
            : 'Not detected'}
        </p>
        <p>
          <span className="font-semibold">Last gesture:</span>{' '}
          {lastGesture ?? 'None'}
        </p>
      </div>

    </div>
  );
});
