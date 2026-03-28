import { useEffect, useRef, useState } from 'react';
import { TileType } from '../types/Types';

const LOCKED_YOUTUBE_PARAMS =
    'autoplay=1&mute=1&playsinline=1&controls=0&disablekb=1&fs=0&modestbranding=1&iv_load_policy=3&rel=0';

function buildLockedVideoUrl(videoLink: string): string {
    try {
        const parsed = new URL(videoLink);
        const host = parsed.hostname.toLowerCase();

        const isYouTubeHost =
            host === 'youtube.com' ||
            host === 'www.youtube.com' ||
            host === 'm.youtube.com' ||
            host === 'youtu.be' ||
            host === 'www.youtu.be' ||
            host === 'youtube-nocookie.com' ||
            host === 'www.youtube-nocookie.com';

        if (!isYouTubeHost) {
            return videoLink;
        }

        let videoId = '';

        if (host.includes('youtu.be')) {
            videoId = parsed.pathname.split('/').filter(Boolean)[0] ?? '';
        } else if (parsed.pathname.startsWith('/watch')) {
            videoId = parsed.searchParams.get('v') ?? '';
        } else if (parsed.pathname.startsWith('/embed/')) {
            videoId = parsed.pathname.split('/embed/')[1]?.split('/')[0] ?? '';
        } else if (parsed.pathname.startsWith('/shorts/')) {
            videoId = parsed.pathname.split('/shorts/')[1]?.split('/')[0] ?? '';
        }

        if (!videoId) {
            return videoLink;
        }

        return `https://www.youtube-nocookie.com/embed/${videoId}?${LOCKED_YOUTUBE_PARAMS}`;
    } catch {
        return videoLink;
    }
}

interface TileProps {
    data: TileType;
}

export default function Tile({ data }: TileProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const src = buildLockedVideoUrl(data.url);

    return (
        <div ref={containerRef} className="relative overflow-hidden border border-[#1a2d4a] rounded-lg shadow-sm hover:shadow-md transition-shadow h-full bg-[#061126]">
            <iframe
                src={src}
                title="Video player"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
                tabIndex={-1}
                className="absolute inset-y-0 left-1/2 h-full -translate-x-1/2 pointer-events-none select-none" 
                width={data.width}
                height={data.height}
            ></iframe>
        </div>
    );
}