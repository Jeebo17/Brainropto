import { useState } from 'react';
import { VideoPlayer } from '../components/VideoPlayer';
import { WebcamDetector } from '../components/WebcamDetector';
import { Brain } from 'lucide-react';

export function Home() {
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
    );
}
