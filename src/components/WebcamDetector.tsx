import { useEffect, useRef, useState } from 'react';
import { Hands, Results } from '@mediapipe/hands';
import { Camera as CameraUtils } from '@mediapipe/camera_utils';
import { Video, VideoOff } from 'lucide-react';

interface WebcamDetectorProps {
  onGestureDetected: () => void;
}

export function WebcamDetector({ onGestureDetected }: WebcamDetectorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [gestureCount, setGestureCount] = useState(0);
  const handsRef = useRef<Hands | null>(null);
  const cameraRef = useRef<CameraUtils | null>(null);

  const checkForSixSevenGesture = (results: Results) => {
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      return false;
    }

    const landmarks = results.multiHandLandmarks[0];

    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];
    const wrist = landmarks[0];

    const indexExtended = indexTip.y < landmarks[6].y;
    const middleExtended = middleTip.y < landmarks[10].y;
    const ringFolded = ringTip.y > landmarks[14].y;
    const pinkyFolded = pinkyTip.y > landmarks[18].y;
    const thumbOut = Math.abs(thumbTip.x - wrist.x) > 0.1;

    if (indexExtended && middleExtended && ringFolded && pinkyFolded && thumbOut) {
      return true;
    }

    return false;
  };

  const onResults = (results: Results) => {
    if (!canvasRef.current || !videoRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

    if (results.multiHandLandmarks) {
      for (const landmarks of results.multiHandLandmarks) {
        for (let i = 0; i < landmarks.length; i++) {
          const x = landmarks[i].x * canvas.width;
          const y = landmarks[i].y * canvas.height;

          ctx.beginPath();
          ctx.arc(x, y, 5, 0, 2 * Math.PI);
          ctx.fillStyle = '#00ff00';
          ctx.fill();
        }
      }

      if (checkForSixSevenGesture(results)) {
        ctx.fillStyle = '#ff0000';
        ctx.font = '48px Arial';
        ctx.fillText('67 DETECTED!', 20, 60);
        setGestureCount(prev => prev + 1);
        onGestureDetected();
      }
    }
  };

  const startCamera = async () => {
    if (!videoRef.current) return;

    const hands = new Hands({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      },
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    hands.onResults(onResults);
    handsRef.current = hands;

    const camera = new CameraUtils(videoRef.current, {
      onFrame: async () => {
        if (videoRef.current && handsRef.current) {
          await handsRef.current.send({ image: videoRef.current });
        }
      },
      width: 640,
      height: 480,
    });

    await camera.start();
    cameraRef.current = camera;
    setIsActive(true);
  };

  const stopCamera = () => {
    if (cameraRef.current) {
      cameraRef.current.stop();
      cameraRef.current = null;
    }
    setIsActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="order-2 flex flex-col items-center justify-center p-4 bg-white rounded-lg shadow-lg">
      <div className="relative">
        <video
          ref={videoRef}
          className={`rounded-lg ${isActive ? 'block' : 'hidden'}`}
          style={{ transform: 'scaleX(-1)' }}
        />
        <canvas
          ref={canvasRef}
          className={`absolute top-0 left-0 rounded-lg ${isActive ? 'block' : 'hidden'}`}
          style={{ transform: 'scaleX(-1)' }}
        />

        {!isActive && (
          <div className="w-[640px] h-[480px] bg-gray-100 rounded-lg flex items-center justify-center">
            <VideoOff className="w-24 h-24 text-gray-400" />
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-4 items-center">
        {!isActive ? (
          <button
            onClick={startCamera}
            className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2"
          >
            <Video className="w-5 h-5" />
            Start Camera
          </button>
        ) : (
          <button
            onClick={stopCamera}
            className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2"
          >
            <VideoOff className="w-5 h-5" />
            Stop Camera
          </button>
        )}

        <div className="px-4 py-2 bg-gray-100 rounded-lg">
          <span className="text-sm text-gray-600">67 Gestures:</span>
          <span className="ml-2 text-xl font-bold text-blue-600">{gestureCount}</span>
        </div>
      </div>

      <p className="mt-2 text-sm text-gray-500 text-center max-w-md">
        Show a "67" gesture: Index & middle fingers extended, ring & pinky folded, thumb out
      </p>
    </div>
  );
}
