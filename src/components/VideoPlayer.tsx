import { useRef, useEffect, useState } from 'react';
import { Camera } from 'lucide-react';

interface VideoPlayerProps {
  position: 'left' | 'right';
  onVideoUpload: (file: File) => void;
  videoUrl: string | null;
}

export function VideoPlayer({ position, onVideoUpload, videoUrl }: VideoPlayerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
      onVideoUpload(file);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onVideoUpload(file);
    }
  };

  useEffect(() => {
    if (videoRef.current && videoUrl) {
      videoRef.current.load();
    }
  }, [videoUrl]);

  return (
    <div
      className={`flex-1 flex flex-col items-center justify-center p-4 ${
        position === 'left' ? 'order-1' : 'order-3'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {!videoUrl ? (
        <div
          className={`w-full max-w-sm aspect-[9/16] border-4 border-dashed rounded-lg flex flex-col items-center justify-center transition-colors ${
            isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 bg-gray-50'
          }`}
        >
          <Camera className="w-16 h-16 text-gray-400 mb-4" />
          <p className="text-gray-600 font-medium mb-2">
            {position === 'left' ? 'Left Video' : 'Right Video'}
          </p>
          <p className="text-gray-500 text-sm mb-4">
            Drag & drop or click to upload
          </p>
          <label className="px-4 py-2 bg-blue-500 text-white rounded cursor-pointer hover:bg-blue-600 transition-colors">
            Choose File
            <input
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleFileInput}
            />
          </label>
        </div>
      ) : (
        <div className="relative w-full max-w-sm">
          <video
            ref={videoRef}
            className="w-full aspect-[9/16] rounded-lg bg-black"
            controls
            loop
            autoPlay
            muted
          >
            <source src={videoUrl} />
          </video>
          <button
            onClick={() => onVideoUpload(null as any)}
            className="absolute top-2 right-2 px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
