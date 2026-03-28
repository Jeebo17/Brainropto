import { useEffect, useRef, useState } from 'react';
import { FaceLandmarker, PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { useSettings } from '../context/SettingsContext';

export function WebCamMotionTracker() {
  const { wakeUpDelay } = useSettings();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [status, setStatus] = useState('Loading models...');
  const [isRunning, setIsRunning] = useState(false);

  // Track eyes closed state and timer
  const eyesClosedRef = useRef(false);
  const eyesClosedStartRef = useRef<number | null>(null);
  const [wakeUpActive, setWakeUpActive] = useState(false);
  const pipePlayedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function loadModels() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
        );
        if (cancelled) return;
        const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numFaces: 1,
        });
        const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
        });
        if (cancelled) {
          faceLandmarker.close();
          poseLandmarker.close();
          return;
        }
        faceLandmarkerRef.current = faceLandmarker;
        poseLandmarkerRef.current = poseLandmarker;
        setModelReady(true);
        setStatus('Models loaded. Click Start to begin.');
      } catch (err) {
        setStatus('Failed to load models.');
      }
    }
    loadModels();
    return () => {
      cancelled = true;
      if (faceLandmarkerRef.current) {
        faceLandmarkerRef.current.close();
        faceLandmarkerRef.current = null;
      }
      if (poseLandmarkerRef.current) {
        poseLandmarkerRef.current.close();
        poseLandmarkerRef.current = null;
      }
    };
  }, []);

  const startCamera = async () => {
    if (!videoRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setIsRunning(true);
      setStatus('Camera started.');
    } catch (err) {
      setStatus('Failed to access webcam.');
    }
  };

  useEffect(() => {
    if (!isRunning || !modelReady) return;
    let animationId: number;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const faceLandmarker = faceLandmarkerRef.current;
    const poseLandmarker = poseLandmarkerRef.current;
    if (!video || !canvas || !faceLandmarker || !poseLandmarker) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      // Face mesh
      let eyesClosed = false;
      const faceResult = faceLandmarker.detectForVideo(video, performance.now());
      if (faceResult.faceLandmarks && faceResult.faceLandmarks.length > 0) {
        for (const face of faceResult.faceLandmarks) {
          ctx.strokeStyle = '#60a5fa';
          ctx.lineWidth = 2;
          // Draw points
          for (const pt of face) {
            ctx.beginPath();
            ctx.arc(pt.x * canvas.width, pt.y * canvas.height, 2, 0, 2 * Math.PI);
            ctx.fillStyle = '#60a5fa';
            ctx.fill();
          }
          // Draw mesh lines (simple connections for visibility)
          const connections = [
            [10, 338], [338, 297], [297, 332], [332, 284], [284, 251], [251, 389], [389, 356], [356, 454], [454, 323], [323, 361], [361, 288], [288, 397], [397, 365], [365, 379], [379, 378], [378, 400], [400, 377], [377, 152], [152, 148], [148, 176], [176, 149], [149, 150], [150, 136], [136, 172], [172, 58], [58, 132], [132, 93], [93, 234], [234, 127], [127, 162], [162, 21], [21, 54], [54, 103], [103, 67], [67, 109], [109, 10]
          ];
          ctx.strokeStyle = '#60a5fa';
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = 0.7;
          for (const [a, b] of connections) {
            if (face[a] && face[b]) {
              ctx.beginPath();
              ctx.moveTo(face[a].x * canvas.width, face[a].y * canvas.height);
              ctx.lineTo(face[b].x * canvas.width, face[b].y * canvas.height);
              ctx.stroke();
            }
          }
          ctx.globalAlpha = 1.0;

          // Eye closed detection (using eye aspect ratio)
          // Left eye: [33, 160, 158, 133, 153, 144], Right eye: [362, 385, 387, 263, 373, 380]
          function eyeAspectRatio(eyeIdx: number[]) {
            // vertical: mean of (1-5, 2-4), horizontal: 0-3
            const v1 = Math.hypot(face[eyeIdx[1]].x - face[eyeIdx[5]].x, face[eyeIdx[1]].y - face[eyeIdx[5]].y);
            const v2 = Math.hypot(face[eyeIdx[2]].x - face[eyeIdx[4]].x, face[eyeIdx[2]].y - face[eyeIdx[4]].y);
            const vertical = (v1 + v2) / 2;
            const horizontal = Math.hypot(face[eyeIdx[0]].x - face[eyeIdx[3]].x, face[eyeIdx[0]].y - face[eyeIdx[3]].y);
            return vertical / horizontal;
          }
          const leftEyeIdx = [33, 160, 158, 133, 153, 144];
          const rightEyeIdx = [362, 385, 387, 263, 373, 380];
          const leftEAR = eyeAspectRatio(leftEyeIdx);
          const rightEAR = eyeAspectRatio(rightEyeIdx);
          // Threshold: typical open >0.2, closed <0.18 (tune as needed)
          if (leftEAR < 0.18 && rightEAR < 0.18) {
            eyesClosed = true;
          }
        }
      }
      // Eyes closed delay logic
      const now = Date.now();
      if (eyesClosed) {
        if (!eyesClosedRef.current) {
          eyesClosedStartRef.current = now;
          pipePlayedRef.current = false;
        }
        eyesClosedRef.current = true;
        if (
          eyesClosedStartRef.current &&
          now - eyesClosedStartRef.current > wakeUpDelay * 1000
        ) {
          setWakeUpActive(true);
          if (!pipePlayedRef.current) {
            new Audio('/WAKE_UP.mp3').play().catch(() => {});
            pipePlayedRef.current = true;
          }
        } else {
          setWakeUpActive(false);
        }
      } else {
        eyesClosedRef.current = false;
        eyesClosedStartRef.current = null;
        setWakeUpActive(false);
        pipePlayedRef.current = false;
      }

      // Pose skeleton
      const poseResult = poseLandmarker.detectForVideo(video, performance.now());
      if (poseResult.landmarks && poseResult.landmarks.length > 0) {
        for (const pose of poseResult.landmarks) {
          // Draw all 33 pose landmarks
          for (const point of pose) {
            ctx.beginPath();
            ctx.arc(point.x * canvas.width, point.y * canvas.height, 3, 0, 2 * Math.PI);
            ctx.fillStyle = '#f59e0b';
            ctx.fill();
          }
          // Draw skeleton connections
          const connections = [
            [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], // arms
            [11, 23], [12, 24], [23, 24], // torso
            [23, 25], [25, 27], [24, 26], [26, 28], // legs
          ];
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.7;
          for (const [a, b] of connections) {
            if (pose[a] && pose[b]) {
              ctx.beginPath();
              ctx.moveTo(pose[a].x * canvas.width, pose[a].y * canvas.height);
              ctx.lineTo(pose[b].x * canvas.width, pose[b].y * canvas.height);
              ctx.stroke();
            }
          }
          ctx.globalAlpha = 1.0;
        }
      }

      // Overlay WAKE UP if eyes have been closed for 5s+
      if (wakeUpActive) {
        ctx.save();
        ctx.font = 'bold 64px sans-serif';
        ctx.fillStyle = 'rgba(255,0,0,0.85)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('WAKE UP', canvas.width / 2, canvas.height / 2);
        ctx.restore();
      }
      animationId = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(animationId);
  }, [isRunning, modelReady]);

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setIsRunning(false);
    setStatus('Camera stopped.');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-4">
      <h1 className="text-2xl font-bold mb-4">Webcam Motion Tracker</h1>
      <div className="mb-4 flex flex-col items-center gap-2">
        <label className="text-slate-200 font-medium">Wake up delay: {wakeUpDelay} seconds</label>
      </div>
      <div className="relative">
        <video ref={videoRef} className="rounded-lg shadow-lg" style={{ display: 'none' }} />
        <canvas ref={canvasRef} className="rounded-lg shadow-lg border border-blue-400" />
      </div>
      <div className="mt-4 flex gap-2">
        {!isRunning ? (
          <button
            onClick={startCamera}
            disabled={!modelReady}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Start
          </button>
        ) : (
          <button
            onClick={stopCamera}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Stop
          </button>
        )}
      </div>
      <p className="mt-2 text-slate-300">{status}</p>
    </div>
  );
}
