import { useEffect, useRef, useState } from 'react';
import { FaceLandmarker, PoseLandmarker, HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { useSettings } from '../context/SettingsContext';
import dogImage from '../assets/dog.png';
import catImage from '../assets/cat.jpg';
import shushImage from '../assets/shush.png';

interface WebCamMotionTrackerProps {
  small?: boolean;
}

export function WebCamMotionTracker({ small }: WebCamMotionTrackerProps) {
  // Track hands-on-head state and timer
  const handsOnHeadRef = useRef(false);
  const handsOnHeadStartRef = useRef<number | null>(null);
  const handsOnHeadPlayedRef = useRef(false);
  const cookedDogAudioRef = useRef<HTMLAudioElement | null>(null);
  const wakeUpAudioRef = useRef<HTMLAudioElement | null>(null);
  const { wakeUpDelay, showImagePopups, muteAlertSounds, showSkeletonOverlay } = useSettings();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [status, setStatus] = useState('Loading models...');
  const [isRunning, setIsRunning] = useState(false);
  const [showCookedDog, setShowCookedDog] = useState(false);
  const [showCatOverlay, setShowCatOverlay] = useState(false);
  const [showShushOverlay, setShowShushOverlay] = useState(false);
  const mouthWideOpenRef = useRef(false);
  const shushDetectedRef = useRef(false);

  // Track eyes closed state and timer
  const eyesClosedRef = useRef(false);
  const eyesClosedStartRef = useRef<number | null>(null);
  const [wakeUpActive, setWakeUpActive] = useState(false);
  const pipePlayedRef = useRef(false);

  useEffect(() => {
    if (showImagePopups) return;
    setShowCookedDog(false);
    setShowCatOverlay(false);
    setShowShushOverlay(false);
    mouthWideOpenRef.current = false;
    shushDetectedRef.current = false;
  }, [showImagePopups]);

  useEffect(() => {
    if (!muteAlertSounds) return;
    if (cookedDogAudioRef.current) {
      cookedDogAudioRef.current.onended = null;
      cookedDogAudioRef.current.pause();
      cookedDogAudioRef.current.currentTime = 0;
      cookedDogAudioRef.current = null;
    }
    if (wakeUpAudioRef.current) {
      wakeUpAudioRef.current.onended = null;
      wakeUpAudioRef.current.pause();
      wakeUpAudioRef.current.currentTime = 0;
      wakeUpAudioRef.current = null;
    }
  }, [muteAlertSounds]);

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
        const handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
        });
        if (cancelled) {
          faceLandmarker.close();
          poseLandmarker.close();
          handLandmarker.close();
          return;
        }
        faceLandmarkerRef.current = faceLandmarker;
        poseLandmarkerRef.current = poseLandmarker;
        handLandmarkerRef.current = handLandmarker;
        setModelReady(true);
        setStatus('Models loaded. Starting camera...');
      } catch (err) {
        setStatus('Failed to load models.');
      }
    }
    loadModels();
    return () => {
      cancelled = true;
      if (cookedDogAudioRef.current) {
        cookedDogAudioRef.current.pause();
        cookedDogAudioRef.current.currentTime = 0;
        cookedDogAudioRef.current = null;
      }
      if (wakeUpAudioRef.current) {
        wakeUpAudioRef.current.pause();
        wakeUpAudioRef.current.currentTime = 0;
        wakeUpAudioRef.current = null;
      }
      if (faceLandmarkerRef.current) {
        faceLandmarkerRef.current.close();
        faceLandmarkerRef.current = null;
      }
      if (poseLandmarkerRef.current) {
        poseLandmarkerRef.current.close();
        poseLandmarkerRef.current = null;
      }
      if (handLandmarkerRef.current) {
        handLandmarkerRef.current.close();
        handLandmarkerRef.current = null;
      }
    };
  }, []);

  // Auto-start camera when models are loaded
  useEffect(() => {
    if (modelReady && !isRunning) {
      startCamera();
    }
    // Only run when modelReady or isRunning changes
  }, [modelReady, isRunning]);

  const startCamera = async () => {
    if (!videoRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setIsRunning(true);
      setStatus('');
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
    const handLandmarker = handLandmarkerRef.current;
    if (!video || !canvas || !faceLandmarker || !poseLandmarker || !handLandmarker) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Mirror the video horizontally for a natural selfie view
      ctx.save();
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.restore();
      // Face mesh
      let eyesClosed = false;
      let mouthWideOpen = false;
      const faceResult = faceLandmarker.detectForVideo(video, performance.now());
      if (faceResult.faceLandmarks && faceResult.faceLandmarks.length > 0) {
        for (const face of faceResult.faceLandmarks) {
          if (showSkeletonOverlay) {
            ctx.strokeStyle = '#60a5fa';
            ctx.lineWidth = 2;
            // Draw points (mirrored)
            for (const pt of face) {
              ctx.beginPath();
              ctx.arc((canvas.width - pt.x * canvas.width), pt.y * canvas.height, 2, 0, 2 * Math.PI);
              ctx.fillStyle = '#60a5fa';
              ctx.fill();
            }
            // Draw mesh lines (mirrored)
            const connections = [
              [10, 338], [338, 297], [297, 332], [332, 284], [284, 251], [251, 389], [389, 356], [356, 454], [454, 323], [323, 361], [361, 288], [288, 397], [397, 365], [365, 379], [379, 378], [378, 400], [400, 377], [377, 152], [152, 148], [148, 176], [176, 149], [149, 150], [150, 136], [136, 172], [172, 58], [58, 132], [132, 93], [93, 234], [234, 127], [127, 162], [162, 21], [21, 54], [54, 103], [103, 67], [67, 109], [109, 10]
            ];
            ctx.strokeStyle = '#60a5fa';
            ctx.lineWidth = 1.5;
            ctx.globalAlpha = 0.7;
            for (const [a, b] of connections) {
              if (face[a] && face[b]) {
                ctx.beginPath();
                ctx.moveTo((canvas.width - face[a].x * canvas.width), face[a].y * canvas.height);
                ctx.lineTo((canvas.width - face[b].x * canvas.width), face[b].y * canvas.height);
                ctx.stroke();
              }
            }
            ctx.globalAlpha = 1.0;
          }
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

          // Mouth open detection (upper lip 13, lower lip 14 vs corners 78 and 308).
          const mouthOpenDistance = Math.hypot(face[13].x - face[14].x, face[13].y - face[14].y);
          const mouthWidth = Math.hypot(face[78].x - face[308].x, face[78].y - face[308].y);
          const mouthOpenRatio = mouthWidth > 0 ? mouthOpenDistance / mouthWidth : 0;
          if (mouthOpenRatio > 0.33) {
            mouthWideOpen = true;
          }
        }
      }

      if (mouthWideOpen !== mouthWideOpenRef.current) {
        mouthWideOpenRef.current = mouthWideOpen;
        setShowCatOverlay(showImagePopups && mouthWideOpen);
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
            if (!muteAlertSounds) {
              const wakeAudio = new Audio('/WAKE_UP.mp3');
              wakeUpAudioRef.current = wakeAudio;
              wakeAudio.onended = () => {
                if (wakeUpAudioRef.current === wakeAudio) {
                  wakeUpAudioRef.current = null;
                }
              };
              wakeAudio.play().catch(() => {
                if (wakeUpAudioRef.current === wakeAudio) {
                  wakeUpAudioRef.current = null;
                }
              });
            }
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

      // --- Hands on head detection ---
      const handResult = handLandmarker.detectForVideo(video, performance.now());
      let handsOnHead = false;
      let shushDetected = false;

      // Shush detection: index fingertip close to mouth center.
      if (faceResult.faceLandmarks && faceResult.faceLandmarks.length > 0 && handResult.landmarks && handResult.landmarks.length > 0) {
        const face = faceResult.faceLandmarks[0];
        const mouthCenter = {
          x: (face[13].x + face[14].x) / 2,
          y: (face[13].y + face[14].y) / 2,
        };
        const mouthWidth = Math.hypot(face[78].x - face[308].x, face[78].y - face[308].y);
        const shushThreshold = mouthWidth * 0.55;

        for (const hand of handResult.landmarks) {
          const indexTip = hand[8];
          const distToMouth = Math.hypot(indexTip.x - mouthCenter.x, indexTip.y - mouthCenter.y);
          if (distToMouth < shushThreshold) {
            shushDetected = true;
            break;
          }
        }
      }

      if (shushDetected !== shushDetectedRef.current) {
        shushDetectedRef.current = shushDetected;
        setShowShushOverlay(showImagePopups && shushDetected);
      }

      // Use face landmarks for head, hand landmarks for hands
      if (faceResult.faceLandmarks && faceResult.faceLandmarks.length > 0 && handResult.landmarks && handResult.landmarks.length > 0) {
        const face = faceResult.faceLandmarks[0];
        // Use forehead (landmark 10), left temple (338), right temple (297)
        const headPoints = [face[10], face[338], face[297]];
        for (const hand of handResult.landmarks) {
          // Use wrist (0), palm center (9), and fingertips (4, 8, 12, 16, 20)
          const handPoints = [hand[0], hand[9], hand[4], hand[8], hand[12], hand[16], hand[20]];
          for (const hp of handPoints) {
            for (const hd of headPoints) {
              const dx = (hp.x - hd.x) * canvas.width;
              const dy = (hp.y - hd.y) * canvas.height;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < 60) { // 60px threshold for "touching"
                handsOnHead = true;
                break;
              }
            }
            if (handsOnHead) break;
          }
          if (handsOnHead) break;
        }
      }
      if (handsOnHead) {
        if (!handsOnHeadRef.current) {
          handsOnHeadStartRef.current = now;
          handsOnHeadPlayedRef.current = false;
        }
        handsOnHeadRef.current = true;
        if (
          handsOnHeadStartRef.current &&
          now - handsOnHeadStartRef.current > 1000 // 1 second
        ) {
          if (!handsOnHeadPlayedRef.current) {
            if (cookedDogAudioRef.current) {
              cookedDogAudioRef.current.pause();
              cookedDogAudioRef.current.currentTime = 0;
              cookedDogAudioRef.current = null;
            }
            setShowCookedDog(showImagePopups);
            if (!muteAlertSounds) {
              const dogAudio = new Audio('/cooked-dog-meme.mp3');
              cookedDogAudioRef.current = dogAudio;
              dogAudio.onended = () => {
                setShowCookedDog(false);
                if (cookedDogAudioRef.current === dogAudio) {
                  cookedDogAudioRef.current = null;
                }
              };
              dogAudio.play().catch(() => {
                setShowCookedDog(false);
                if (cookedDogAudioRef.current === dogAudio) {
                  cookedDogAudioRef.current = null;
                }
              });
            }
            handsOnHeadPlayedRef.current = true;
          }
        }
      } else {
        handsOnHeadRef.current = false;
        handsOnHeadStartRef.current = null;
        handsOnHeadPlayedRef.current = false;
        if (cookedDogAudioRef.current) {
          cookedDogAudioRef.current.onended = null;
          cookedDogAudioRef.current.pause();
          cookedDogAudioRef.current.currentTime = 0;
          cookedDogAudioRef.current = null;
        }
        setShowCookedDog(false);
      }

      // Pose skeleton
      const poseResult = poseLandmarker.detectForVideo(video, performance.now());
      if (poseResult.landmarks && poseResult.landmarks.length > 0 && showSkeletonOverlay) {
        for (const pose of poseResult.landmarks) {
          // Draw all 33 pose landmarks (mirrored)
          for (const point of pose) {
            ctx.beginPath();
            ctx.arc((canvas.width - point.x * canvas.width), point.y * canvas.height, 3, 0, 2 * Math.PI);
            ctx.fillStyle = '#f59e0b';
            ctx.fill();
          }
          // Draw skeleton connections (mirrored)
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
              ctx.moveTo((canvas.width - pose[a].x * canvas.width), pose[a].y * canvas.height);
              ctx.lineTo((canvas.width - pose[b].x * canvas.width), pose[b].y * canvas.height);
              ctx.stroke();
            }
          }
          ctx.globalAlpha = 1.0;
        }
      }

      // Hand landmarks
      if (handResult.landmarks && handResult.landmarks.length > 0) {
        for (const hand of handResult.landmarks) {
          // Draw 21 hand landmarks (mirrored)
          for (const pt of hand) {
            ctx.beginPath();
            ctx.arc((canvas.width - pt.x * canvas.width), pt.y * canvas.height, 3, 0, 2 * Math.PI);
            ctx.fillStyle = '#22c55e';
            ctx.fill();
          }
          // Draw hand skeleton connections (mirrored)
          const handConnections = [
            [0,1],[1,2],[2,3],[3,4], // Thumb
            [0,5],[5,6],[6,7],[7,8], // Index
            [5,9],[9,10],[10,11],[11,12], // Middle
            [9,13],[13,14],[14,15],[15,16], // Ring
            [13,17],[17,18],[18,19],[19,20], // Pinky
            [0,17] // Palm base to pinky base
          ];
          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.8;
          for (const [a, b] of handConnections) {
            if (hand[a] && hand[b]) {
              ctx.beginPath();
              ctx.moveTo((canvas.width - hand[a].x * canvas.width), hand[a].y * canvas.height);
              ctx.lineTo((canvas.width - hand[b].x * canvas.width), hand[b].y * canvas.height);
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
  }, [isRunning, modelReady, wakeUpDelay, showImagePopups, muteAlertSounds, showSkeletonOverlay]);



  return (
    <div className={small ? 'inline-flex items-center justify-center p-0 m-0' : 'flex flex-col items-center justify-center min-h-[80vh] p-4'}>
      <div className="relative flex justify-center items-center m-0 p-0">
        <video ref={videoRef} className="rounded-lg shadow-lg" style={{ display: 'none' }} />
        <canvas
          ref={canvasRef}
          className="rounded-lg shadow-lg border border-blue-400"
          style={{
            ...(small
              ? { width: '300px', height: '225px', maxWidth: '90vw', maxHeight: '80vh' }
              : { width: '800px', height: '600px', maxWidth: '90vw', maxHeight: '80vh' }
            ),
            background: !isRunning ? '#181e2a' : 'transparent',
            transition: 'background 0.2s',
          }}
        />
        {showImagePopups && (
          <>
            <img
              src={dogImage}
              alt="Cooked dog"
              className="fixed inset-0 w-screen h-screen object-contain pointer-events-none transition-opacity z-50"
              style={{ opacity: showCookedDog ? 1 : 0, transition: 'opacity 2s' }}
            />
            <img
              src={catImage}
              alt="Mouth open cat"
              className="fixed inset-0 w-screen h-screen object-contain pointer-events-none transition-opacity z-40"
              style={{ opacity: showCatOverlay ? 1 : 0, transition: 'opacity 2s' }}
            />
            <img
              src={shushImage}
              alt="Shush"
              className="fixed inset-0 w-screen h-screen object-contain pointer-events-none transition-opacity z-[45]"
              style={{ opacity: showShushOverlay ? 1 : 0, transition: 'opacity 2s' }}
            />
          </>
        )}
        {/* Status overlay inside preview, only show when not running */}
        {!isRunning && status && (
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-2  text-white rounded text-center pointer-events-none"
            style={{ zIndex: 10, fontSize: small ? 18 : 24, minWidth: 120 }}
          >
            {status}
          </div>
        )}
      </div>
    </div>
  );
}
