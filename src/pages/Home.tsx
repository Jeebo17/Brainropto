import { useState } from 'react';
import { WebcamDetector } from '../components/WebcamDetector';
import Menu from '../components/Menu';
import Tile from '../components/Tile';
import tileData from '../data/tileData.json';

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

    return (
        <main className="container mx-auto p-8">
            <div className="flex gap-6 items-start justify-center flex-wrap lg:flex-nowrap">
                {/* <VideoPlayer
                    position="left"
                    onVideoUpload={handleLeftVideoUpload}
                    videoUrl={leftVideo}
                /> */}

                <WebcamDetector />

                <Menu />
                <Tile data={tileData.engagementVideos[1]} />

                {/* <VideoPlayer
                    position="right"
                    onVideoUpload={handleRightVideoUpload}
                    videoUrl={rightVideo}
                /> */}
            </div>
        </main>
    );
}
