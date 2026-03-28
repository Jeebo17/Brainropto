import { useState } from 'react';
import { VideoPlayer } from './components/VideoPlayer';
import { WebcamDetector } from './components/WebcamDetector';
import { Brain } from 'lucide-react';

function App() {
  const [leftVideo, setLeftVideo] = useState<string | null>(null);
  const [rightVideo, setRightVideo] = useState<string | null>(null);

  const handleLeftVideoUpload = (file: File | null) => {
    if (!file) {
      if (leftVideo) URL.revokeObjectURL(leftVideo);
      setLeftVideo(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setLeftVideo(url);
  };

  const handleRightVideoUpload = (file: File | null) => {
    if (!file) {
      if (rightVideo) URL.revokeObjectURL(rightVideo);
      setRightVideo(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setRightVideo(url);
  };

  const handleGestureDetected = () => {
    console.log('67 gesture detected!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-blue-100">
      <header className="bg-white shadow-md p-4">
        <div className="container mx-auto flex items-center gap-3">
          <Brain className="w-8 h-8 text-purple-600" />
          <h1 className="text-2xl font-bold text-gray-800">Brainrot Central</h1>
          <span className="text-sm text-gray-500 ml-auto">
            Upload videos & show the 67 gesture
          </span>
        </div>
      </header>

      <main className="container mx-auto p-8">
        <div className="flex gap-6 items-start justify-center flex-wrap lg:flex-nowrap">
          <VideoPlayer
            position="left"
            onVideoUpload={handleLeftVideoUpload}
            videoUrl={leftVideo}
          />

          <WebcamDetector onGestureDetected={handleGestureDetected} />

          <VideoPlayer
            position="right"
            onVideoUpload={handleRightVideoUpload}
            videoUrl={rightVideo}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
