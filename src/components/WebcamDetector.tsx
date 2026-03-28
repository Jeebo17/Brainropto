import { useEffect, useRef, useState } from 'react';
import { Hands, Results } from '@mediapipe/hands';

interface WebcamDetectorProps {
  videoUrl?: string;
}

type HandPoint = {
  x: number;
  y: number;
  z: number;
};

export function WebcamDetector({ videoUrl }: WebcamDetectorProps) {
  const analysisVideoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const playerShellRef = useRef<HTMLDivElement>(null);
  const handsRef = useRef<Hands | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const frameInFlightRef = useRef(false);
  const panoptoTimeRef = useRef<number | null>(null);
  const panoptoPlayingRef = useRef(false);

  const [analysisVideoInput, setAnalysisVideoInput] = useState(videoUrl ?? '');
  const [analysisVideoUrl, setAnalysisVideoUrl] = useState<string | null>(videoUrl ?? null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [handPosition, setHandPosition] = useState<HandPoint | null>(null);
  const [statusText, setStatusText] = useState(
    'Paste a direct video URL, then use Sync to overlay hand boxes onto Panopto playback.'
  );
  const [panoptoTime, setPanoptoTime] = useState<number | null>(null);
  const [panoptoPlaying, setPanoptoPlaying] = useState(false);
  const [syncEnabled, setSyncEnabled] = useState(true);

  const panoptoEmbedUrl =
    'https://uniofbath.cloud.panopto.eu/Panopto/Pages/Embed.aspx?id=c9334aea-2bc3-4f20-abf6-b40900ec1c02&autoplay=false&offerviewer=true&showtitle=false&showbrand=false&captions=false&interactivity=all';

  useEffect(() => {
    if (videoUrl) {
      setAnalysisVideoInput(videoUrl);
      setAnalysisVideoUrl(videoUrl);
    }
  }, [videoUrl]);

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

  const drawResults = (results: Results) => {
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

    results.multiHandLandmarks.forEach((hand) => {
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
    });
  };

  useEffect(() => {
    const onResize = () => syncCanvasToPlayerSize();
    onResize();
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, []);

  useEffect(() => {
    const handlePanoptoMessage = (event: MessageEvent) => {
      if (!event.origin.includes('panopto.eu')) return;
      if (iframeRef.current && event.source !== iframeRef.current.contentWindow) return;

      let payload: unknown = event.data;
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload);
        } catch {
          return;
        }
      }

      if (!payload || typeof payload !== 'object') return;
      const data = payload as Record<string, unknown>;
      const nested =
        data.data && typeof data.data === 'object' ? (data.data as Record<string, unknown>) : null;

      const currentTimeCandidate =
        typeof data.currentTime === 'number'
          ? data.currentTime
          : typeof nested?.currentTime === 'number'
            ? nested.currentTime
            : null;

      if (currentTimeCandidate !== null) {
        panoptoTimeRef.current = currentTimeCandidate;
        setPanoptoTime(currentTimeCandidate);
      }

      const pausedCandidate =
        typeof data.paused === 'boolean'
          ? data.paused
          : typeof nested?.paused === 'boolean'
            ? nested.paused
            : null;

      if (pausedCandidate !== null) {
        panoptoPlayingRef.current = !pausedCandidate;
        setPanoptoPlaying(!pausedCandidate);
      }
    };

    window.addEventListener('message', handlePanoptoMessage);
    return () => {
      window.removeEventListener('message', handlePanoptoMessage);
    };
  }, []);

  const requestPanoptoSyncEvents = () => {
    const frame = iframeRef.current?.contentWindow;
    if (!frame) return;

    frame.postMessage({ type: 'register', event: 'timeupdate' }, '*');
    frame.postMessage({ type: 'register', event: 'play' }, '*');
    frame.postMessage({ type: 'register', event: 'pause' }, '*');
    frame.postMessage({ method: 'addEventListener', event: 'timeupdate' }, '*');
    frame.postMessage({ method: 'addEventListener', event: 'play' }, '*');
    frame.postMessage({ method: 'addEventListener', event: 'pause' }, '*');
  };

  useEffect(() => {
    const video = analysisVideoRef.current;
    if (!video || !analysisVideoUrl) {
      setIsAnalyzing(false);
      return;
    }

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
    setStatusText('Hidden tracker loaded. Start Panopto playback to sync overlay.');

    const loop = async () => {
      if (cancelled || !analysisVideoRef.current || !handsRef.current) return;

      const currentVideo = analysisVideoRef.current;

      if (syncEnabled && panoptoTimeRef.current !== null) {
        const drift = panoptoTimeRef.current - currentVideo.currentTime;
        if (Math.abs(drift) > 0.35) {
          currentVideo.currentTime = panoptoTimeRef.current;
        }

        if (panoptoPlayingRef.current && currentVideo.paused) {
          void currentVideo.play().catch(() => {
            setStatusText('Tracker video is blocked from autoplay. Click Start Tracker once.');
          });
        }

        if (!panoptoPlayingRef.current && !currentVideo.paused) {
          currentVideo.pause();
        }
      }

      if (
        !currentVideo.paused &&
        !currentVideo.ended &&
        currentVideo.readyState >= 2 &&
        !frameInFlightRef.current
      ) {
        frameInFlightRef.current = true;
        try {
          await handsRef.current.send({ image: currentVideo });
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
  }, [analysisVideoUrl, syncEnabled]);

  const handleLoadUrl = () => {
    const nextUrl = analysisVideoInput.trim();
    if (!nextUrl) {
      setAnalysisVideoUrl(null);
      setHandPosition(null);
      setStatusText('Paste a direct video URL, then load it for hidden tracking.');
      return;
    }

    setAnalysisVideoUrl(nextUrl);
    setHandPosition(null);
    setStatusText('Tracker URL loaded. Use Start Tracker and play Panopto.');
  };

  const handleStartTracker = async () => {
    if (!analysisVideoRef.current) return;
    try {
      await analysisVideoRef.current.play();
      setStatusText('Tracker started. Overlay is synced to Panopto time when available.');
    } catch {
      setStatusText('Browser blocked autoplay. Click Start Tracker again after interacting with the page.');
    }
  };

  return (
    <div className="order-2 flex w-full lg:w-4/5 flex-col gap-4 p-4 bg-white rounded-lg shadow-lg">
      <div ref={playerShellRef} className="relative w-full overflow-hidden rounded-lg" style={{ aspectRatio: '16 / 9' }}>
        <iframe
          ref={iframeRef}
          src={panoptoEmbedUrl}
          title="Panopto Lecture Recording"
          className="h-full w-full"
          allowFullScreen
          allow="autoplay"
          onLoad={requestPanoptoSyncEvents}
        />
        <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      </div>

      <div className="rounded-lg border border-gray-200 p-3">
        <p className="text-sm text-gray-700">
          Sync mode: Panopto stays visible while MediaPipe runs on a hidden mirror stream and draws
          boxes directly over the official player.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="url"
            value={analysisVideoInput}
            onChange={(event) => setAnalysisVideoInput(event.target.value)}
            placeholder="https://example.com/lecture.mp4"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700"
          />
          <button
            type="button"
            onClick={handleLoadUrl}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Load Mirror URL
          </button>
          <button
            type="button"
            onClick={handleStartTracker}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Start Tracker
          </button>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={syncEnabled}
            onChange={(event) => setSyncEnabled(event.target.checked)}
          />
          Keep hidden tracker synced to Panopto timeline
        </label>
      </div>

      {/* Hidden mirror video used for MediaPipe analysis only */}
      <video
        ref={analysisVideoRef}
        src={analysisVideoUrl ?? undefined}
        crossOrigin="anonymous"
        muted
        playsInline
        preload="auto"
        className="absolute left-[-9999px] top-[-9999px] h-1 w-1 opacity-0"
      />

      <div className="rounded-lg bg-gray-100 p-3 text-sm text-gray-800">
        <p>
          <span className="font-semibold">Status:</span> {statusText}
        </p>
        <p>
          <span className="font-semibold">Analyzing:</span> {isAnalyzing ? 'Yes' : 'No'}
        </p>
        <p>
          <span className="font-semibold">Panopto time:</span>{' '}
          {panoptoTime !== null ? `${panoptoTime.toFixed(2)}s` : 'Waiting for player events'}
        </p>
        <p>
          <span className="font-semibold">Panopto playing:</span> {panoptoPlaying ? 'Yes' : 'No'}
        </p>
        <p>
          <span className="font-semibold">Hand position:</span>{' '}
          {handPosition
            ? `x ${(handPosition.x * 100).toFixed(1)}%, y ${(handPosition.y * 100).toFixed(1)}%, z ${handPosition.z.toFixed(3)}`
            : 'Not detected'}
        </p>
      </div>
    </div>
  );
}
