import { useEffect, useRef, useState, useCallback } from 'react';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

type HandPoint = {
  x: number;
  y: number;
  z: number;
};

// Extract session ID from a Panopto URL or bare GUID
function extractSessionId(input: string): string | null {
  const guidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const match = input.match(guidPattern);
  return match ? match[0] : null;
}

type GestureType = '67' | 'rickroll';

type PositionEntry = { x: number; y: number; time: number };

const GESTURE_WINDOW_MS = 5000; // 5 second window
// Displacement thresholds as a proportion of torso height
const MIN_DISPLACEMENT_Y_RATIO = 0.15; // 15% of torso height for 67 (up-down)
const MIN_DISPLACEMENT_X_RATIO = 0.10; // 10% of torso height for rickroll (side-to-side)
// Fallbacks if torso can't be measured
const MIN_DISPLACEMENT_Y_FALLBACK = 0.10;
const MIN_DISPLACEMENT_X_FALLBACK = 0.08;
const REQUIRED_REVERSALS = 4; // 2 full pumps/sweeps = 4 direction changes
const GESTURE_COOLDOWN_MS = 3000; // 3 seconds between same gesture events

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

    if (yRev0 >= REQUIRED_REVERSALS && yRev1 >= REQUIRED_REVERSALS) {
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

    if (!hasSignificantY) {
      const bothHaveSweeps = handHistories.slice(0, 2).every((history) => {
        if (history.length < 3) return false;
        const xValues = history.map((p) => p.x);
        return countReversals(xValues, minDispX) >= REQUIRED_REVERSALS;
      });
      if (bothHaveSweeps) return 'rickroll';
    }
  }

  return null;
}

interface WebcamDetectorProps {
  onGesture?: (gesture: GestureType) => void;
}

export function WebcamDetector({ onGesture }: WebcamDetectorProps) {
  const captureVideoRef = useRef<HTMLVideoElement>(null);
  const cropCanvasRef = useRef<HTMLCanvasElement>(null);
  const debugOverlayRef = useRef<HTMLCanvasElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const playerShellRef = useRef<HTMLDivElement>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const frameInFlightRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const handHistoriesRef = useRef<PositionEntry[][]>([[], []]);
  const lastGestureTimeRef = useRef<Record<GestureType, number>>({ '67': 0, rickroll: 0 });
  const onGestureRef = useRef(onGesture);
  onGestureRef.current = onGesture;

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [lastGesture, setLastGesture] = useState<string | null>(null);
  const [sessionInput, setSessionInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [handPosition, setHandPosition] = useState<HandPoint | null>(null);
  const [statusText, setStatusText] = useState(
    'Log in with Panopto to get started.'
  );

  // Check auth status on mount
  useEffect(() => {
    fetch(`${API_BASE}/auth/status`)
      .then((res) => res.json())
      .then((data) => {
        setIsAuthenticated(data.authenticated);
        if (data.authenticated) {
          setStatusText('Loading hand detection model...');
        }
      })
      .catch(() => setStatusText('Cannot connect to server. Is it running on port 3001?'));
  }, []);

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
              'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task',
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
        setStatusText('Model loaded. Paste a Panopto link or session ID.');
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

  const panoptoEmbedUrl = sessionId
    ? `https://uniofbath.cloud.panopto.eu/Panopto/Pages/Embed.aspx?id=${sessionId}&autoplay=false&offerviewer=true&showtitle=false&showbrand=false&captions=false&interactivity=all`
    : null;

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
      return;
    }

    const now = Date.now();
    const pose = poseLandmarks[0]; // first (only) detected pose
    const torsoHeight = computeTorsoHeight(pose);

    // Extract wrist positions
    const leftWrist = pose[LEFT_WRIST];
    const rightWrist = pose[RIGHT_WRIST];
    const wrists = [leftWrist, rightWrist];

    // Draw full pose skeleton on the main overlay
    // Draw all 33 pose landmarks
    for (const point of pose) {
      ctx.beginPath();
      ctx.arc(point.x * canvas.width, point.y * canvas.height, 2, 0, 2 * Math.PI);
      ctx.fillStyle = '#60a5fa';
      ctx.fill();
    }

    // Highlight wrists with larger circles
    wrists.forEach((wrist, i) => {
      const color = i === 0 ? '#22c55e' : '#f59e0b';
      ctx.beginPath();
      ctx.arc(wrist.x * canvas.width, wrist.y * canvas.height, 8, 0, 2 * Math.PI);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(i === 0 ? 'L' : 'R', wrist.x * canvas.width - 4, wrist.y * canvas.height - 12);
    });

    setHandPosition({ x: leftWrist.x, y: leftWrist.y, z: leftWrist.z });

    // Track wrist position history for gesture detection (same as before)
    wrists.forEach((wrist, handIndex) => {
      const history = handHistoriesRef.current[handIndex];
      history.push({ x: wrist.x, y: wrist.y, time: now });
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
      console.log(`[Gesture Detected] ${gesture}`);
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

  const handleLoadSession = async () => {
    const id = extractSessionId(sessionInput.trim());
    if (!id) {
      setStatusText('Could not find a valid session ID. Paste a Panopto link or GUID.');
      return;
    }

    setSessionId(id);
    setStatusText('Session loaded. Click "Start Capture" to begin hand tracking.');
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
    if (!sessionId) {
      setStatusText('Load a Panopto session first.');
      return;
    }
    new Audio('/pipe.mp3').play().then(audio => audio).catch(() => {});
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

          // Crop to left half only (lecturer side of Panopto split-screen)
          const sw = Math.floor(fullW / 2);

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
      <div ref={playerShellRef} className="relative w-full overflow-hidden rounded-lg bg-[#050b1a] border border-[#1a2d4a]" style={{ aspectRatio: '16 / 9' }}>
        {panoptoEmbedUrl ? (
          <iframe
            ref={iframeRef}
            src={panoptoEmbedUrl}
            title="Panopto Lecture Recording"
            className="h-full w-full"
            allowFullScreen
            allow="autoplay"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-400">
            <p className="text-lg">Paste a Panopto link above to load a lecture</p>
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

      {/* Debug: shows cropped frame with hand detection overlay */}
      {isSharing && (
        <div className="rounded-lg border border-yellow-400 p-2">
          <p className="text-xs font-semibold text-yellow-600 mb-1">DEBUG: MediaPipe input + hand detection</p>
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
      {!isSharing && (
        <canvas
          ref={cropCanvasRef}
          className="absolute left-[-9999px] top-[-9999px] h-1 w-1 opacity-0"
        />
      )}

      <div className="rounded-lg border border-[#1a2d4a] bg-[#0a1933] p-3">
        {!isAuthenticated ? (
          <>
            <p className="text-sm text-slate-200">
              Log in with your University of Bath Panopto account to enable hand tracking.
            </p>
            <div className="mt-3">
              <a
                href={`${API_BASE}/auth/login`}
                className="inline-block rounded-md bg-[#16325f] px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-[#1d3c71]"
              >
                Login with Panopto
              </a>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-700">
              {!modelReady
                ? 'Loading hand detection model...'
                : 'Paste a Panopto lecture link, then click "Start Capture" to share this tab.'}
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={sessionInput}
                onChange={(e) => setSessionInput(e.target.value)}
                placeholder="https://uniofbath.cloud.panopto.eu/...?id=xxxx or session GUID"
                className="w-full rounded-md border border-[#1a2d4a] bg-[#061126] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={handleLoadSession}
                disabled={!modelReady}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Load
              </button>
              {!isSharing ? (
                <button
                  type="button"
                  onClick={handleStartCapture}
                  disabled={!sessionId || !modelReady}
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
              )}
            </div>
          </>
        )}
      </div>

      <div className="rounded-lg border border-[#1a2d4a] bg-[#0a1933] p-3 text-sm text-slate-100">
        <p>
          <span className="font-semibold">Status:</span> {statusText}
        </p>
        <p>
          <span className="font-semibold">Model:</span> {modelReady ? 'Ready (PoseLandmarker Heavy)' : 'Loading...'}
        </p>
        <p>
          <span className="font-semibold">Analyzing:</span> {isAnalyzing ? 'Yes' : 'No'}
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
}
