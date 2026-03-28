import { useEffect, useRef, useState, useCallback } from 'react';
import { Hands, Results } from '@mediapipe/hands';

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
const MIN_DISPLACEMENT_Y = 0.10; // for 67 (up-down)
const MIN_DISPLACEMENT_X = 0.08; // for rickroll (side-to-side)
const REQUIRED_REVERSALS = 4; // 2 full pumps/sweeps = 4 direction changes
const GESTURE_COOLDOWN_MS = 3000; // 3 seconds between same gesture events

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
  handCount: number,
): GestureType | null {
  // 67: both hands pumping up and down in OPPOSITE directions
  if (handHistories.length >= 2 && handHistories[0].length >= 3 && handHistories[1].length >= 3) {
    const yRev0 = countReversals(handHistories[0].map((p) => p.y), MIN_DISPLACEMENT_Y);
    const yRev1 = countReversals(handHistories[1].map((p) => p.y), MIN_DISPLACEMENT_Y);

    if (yRev0 >= REQUIRED_REVERSALS && yRev1 >= REQUIRED_REVERSALS) {
      // Correlate Y movement by matching timestamps between the two hand histories
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
    const yRev0 = countReversals(handHistories[0].map((p) => p.y), MIN_DISPLACEMENT_Y);
    const yRev1 = countReversals(handHistories[1].map((p) => p.y), MIN_DISPLACEMENT_Y);
    const hasSignificantY = yRev0 >= REQUIRED_REVERSALS || yRev1 >= REQUIRED_REVERSALS;

    if (!hasSignificantY) {
      const bothHaveSweeps = handHistories.slice(0, 2).every((history) => {
        if (history.length < 3) return false;
        const xValues = history.map((p) => p.x);
        return countReversals(xValues, MIN_DISPLACEMENT_X) >= REQUIRED_REVERSALS;
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
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const playerShellRef = useRef<HTMLDivElement>(null);
  const handsRef = useRef<Hands | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const frameInFlightRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const handHistoriesRef = useRef<PositionEntry[][]>([[], []]);
  const lastGestureTimeRef = useRef<Record<GestureType, number>>({ '67': 0, rickroll: 0 });
  const onGestureRef = useRef(onGesture);
  onGestureRef.current = onGesture;

  const [isAuthenticated, setIsAuthenticated] = useState(false);
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
          setStatusText('Paste a Panopto link or session ID to load the lecture.');
        }
      })
      .catch(() => setStatusText('Cannot connect to server. Is it running on port 3001?'));
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

  const drawResults = useCallback((results: Results) => {
    const canvas = overlayRef.current;
    if (!canvas) return;

    syncCanvasToPlayerSize();

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      setHandPosition(null);
      return;
    }

    const now = Date.now();
    let detectedHands = results.multiHandLandmarks;

    // Filter phantom double-detections: if two "hands" have wrists too close, treat as one
    const MIN_HAND_DISTANCE = 0.25;
    if (detectedHands.length >= 2) {
      const wrist0 = detectedHands[0][0];
      const wrist1 = detectedHands[1][0];
      const dist = Math.sqrt((wrist0.x - wrist1.x) ** 2 + (wrist0.y - wrist1.y) ** 2);
      if (dist < MIN_HAND_DISTANCE) {
        detectedHands = [detectedHands[0]];
      }
    }

    const handCount = detectedHands.length;

    detectedHands.forEach((hand, handIndex) => {
      const xs = hand.map((p) => p.x);
      const ys = hand.map((p) => p.y);

      const minX = Math.min(...xs) * canvas.width;
      const maxX = Math.max(...xs) * canvas.width;
      const minY = Math.min(...ys) * canvas.height;
      const maxY = Math.max(...ys) * canvas.height;

      const boxX = minX - 10;
      const boxY = minY - 10;
      const boxWidth = maxX - minX + 20;
      const boxHeight = maxY - minY + 20;

      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 3;
      ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

      ctx.fillStyle = '#22c55e';
      ctx.fillRect(boxX, boxY - 28, 132, 24);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('Lecturer Hand', boxX + 8, boxY - 11);

      for (const point of hand) {
        ctx.beginPath();
        ctx.arc(point.x * canvas.width, point.y * canvas.height, 2.5, 0, 2 * Math.PI);
        ctx.fillStyle = '#60a5fa';
        ctx.fill();
      }

      const wrist = hand[0];
      setHandPosition({ x: wrist.x, y: wrist.y, z: wrist.z });

      // Track wrist position history for gesture detection
      if (handIndex < 2) {
        const history = handHistoriesRef.current[handIndex];
        history.push({ x: wrist.x, y: wrist.y, time: now });
        // Trim to 5 second window
        const cutoff = now - GESTURE_WINDOW_MS;
        while (history.length > 0 && history[0].time < cutoff) {
          history.shift();
        }
      }
    });

    // Don't clear history for temporarily lost hands — let time window handle expiry

    // Run gesture detection
    const gesture = detectGesture(handHistoriesRef.current, handCount);
    if (gesture && now - lastGestureTimeRef.current[gesture] > GESTURE_COOLDOWN_MS) {
      lastGestureTimeRef.current[gesture] = now;
      setLastGesture(gesture);
      console.log(`[Gesture Detected] ${gesture}`);
      onGestureRef.current?.(gesture);
      // Clear histories after firing to avoid re-triggering
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

  // MediaPipe analysis loop — captures tab, crops to player shell, feeds to MediaPipe
  useEffect(() => {
    if (!isSharing) return;

    const video = captureVideoRef.current;
    const cropCanvas = cropCanvasRef.current;
    const overlay = overlayRef.current;
    const shell = playerShellRef.current;
    if (!video || !cropCanvas || !shell) return;

    let cancelled = false;

    const hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    hands.onResults(drawResults);
    handsRef.current = hands;

    const cropCtx = cropCanvas.getContext('2d');

    const loop = async () => {
      if (cancelled || !captureVideoRef.current || !handsRef.current || !cropCtx) return;

      const currentVideo = captureVideoRef.current;

      if (
        !currentVideo.paused &&
        !currentVideo.ended &&
        currentVideo.readyState >= 2 &&
        !frameInFlightRef.current
      ) {
        frameInFlightRef.current = true;
        try {
          // Get the player shell's position relative to the viewport
          const rect = shell.getBoundingClientRect();

          // The capture video is the full tab — calculate crop ratios
          const tabWidth = document.documentElement.clientWidth;
          const tabHeight = document.documentElement.clientHeight;
          const vidWidth = currentVideo.videoWidth;
          const vidHeight = currentVideo.videoHeight;

          // Scale factor between captured pixels and CSS pixels
          const scaleX = vidWidth / tabWidth;
          const scaleY = vidHeight / tabHeight;

          // Source crop region in captured video coordinates
          const sx = rect.left * scaleX;
          const sy = rect.top * scaleY;
          const sw = rect.width * scaleX;
          const sh = rect.height * scaleY;

          // Set crop canvas to match the player region
          cropCanvas.width = Math.floor(sw);
          cropCanvas.height = Math.floor(sh);

          // Hide overlay so it doesn't appear in the captured frame
          if (overlay) overlay.style.visibility = 'hidden';

          // Wait one frame for the overlay to actually be hidden in the capture
          await new Promise((r) => requestAnimationFrame(r));

          // Draw the cropped region
          cropCtx.drawImage(
            currentVideo,
            sx, sy, sw, sh,
            0, 0, cropCanvas.width, cropCanvas.height
          );

          // Show overlay again
          if (overlay) overlay.style.visibility = 'visible';

          // Feed cropped frame to MediaPipe
          await handsRef.current.send({ image: cropCanvas });
          setIsAnalyzing(true);
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
      hands.close();
      handsRef.current = null;
      frameInFlightRef.current = false;
      setIsAnalyzing(false);
    };
  }, [isSharing, drawResults, handleStopSharing]);

  return (
    <div className="order-2 flex w-full lg:w-4/5 flex-col gap-4 p-4 bg-white rounded-lg shadow-lg">
      <div ref={playerShellRef} className="relative w-full overflow-hidden rounded-lg bg-black" style={{ aspectRatio: '16 / 9' }}>
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
          <div className="flex h-full w-full items-center justify-center text-gray-400">
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

      {/* Debug: shows exactly what MediaPipe receives (the cropped frame) */}
      {isSharing && (
        <div className="rounded-lg border border-yellow-400 p-2">
          <p className="text-xs font-semibold text-yellow-600 mb-1">DEBUG: Cropped frame sent to MediaPipe</p>
          <canvas
            ref={cropCanvasRef}
            className="w-full rounded bg-black"
            style={{ maxHeight: '200px', objectFit: 'contain' }}
          />
        </div>
      )}
      {!isSharing && (
        <canvas
          ref={cropCanvasRef}
          className="absolute left-[-9999px] top-[-9999px] h-1 w-1 opacity-0"
        />
      )}

      <div className="rounded-lg border border-gray-200 p-3">
        {!isAuthenticated ? (
          <>
            <p className="text-sm text-gray-700">
              Log in with your University of Bath Panopto account to enable hand tracking.
            </p>
            <div className="mt-3">
              <a
                href={`${API_BASE}/auth/login`}
                className="inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Login with Panopto
              </a>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-700">
              Paste a Panopto lecture link, then click "Start Capture" to share this tab.
              MediaPipe will crop to the player area and detect hands.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={sessionInput}
                onChange={(e) => setSessionInput(e.target.value)}
                placeholder="https://uniofbath.cloud.panopto.eu/...?id=xxxx or session GUID"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700"
              />
              <button
                type="button"
                onClick={handleLoadSession}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Load
              </button>
              {!isSharing ? (
                <button
                  type="button"
                  onClick={handleStartCapture}
                  disabled={!sessionId}
                  className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  Start Capture
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStopSharing}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                >
                  Stop Capture
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <div className="rounded-lg bg-gray-100 p-3 text-sm text-gray-800">
        <p>
          <span className="font-semibold">Status:</span> {statusText}
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
