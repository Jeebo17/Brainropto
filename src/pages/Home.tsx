import { useState, useCallback } from 'react';
import { VideoPlayer } from '../components/VideoPlayer';
import { WebcamDetector } from '../components/WebcamDetector';

export function Home() {
    const [leftVideo, setLeftVideo] = useState<string | null>(null);
    const [rightVideo, setRightVideo] = useState<string | null>(null);

    const handleGesture = useCallback((gesture: '67' | 'rickroll') => {
        console.log(`[Home] Gesture event received: ${gesture}`);
        // TODO: Wire up UI responses here
        // gesture === '67' → trigger 67 effect
        // gesture === 'rickroll' → trigger rickroll effect
    }, []);

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

    return (
        <main className="container mx-auto p-8">
            <div className="flex gap-6 items-start justify-center flex-wrap lg:flex-nowrap">
                <VideoPlayer
                    position="left"
                    onVideoUpload={handleLeftVideoUpload}
                    videoUrl={leftVideo}
                />

                <WebcamDetector onGesture={handleGesture} />

                <VideoPlayer
                    position="right"
                    onVideoUpload={handleRightVideoUpload}
                    videoUrl={rightVideo}
                />
            </div>
        </main>
    );
}
