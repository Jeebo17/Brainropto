const TILE_VIDEO_LINK = 'https://www.youtube.com/watch?v=eRXE8Aebp7s';
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

export default function Tile({ data }: { data: TileType }) {
    const src = buildLockedVideoUrl(data.url);

    return (
        <div className="border rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <iframe
                src={src}
                width={data.width}
                height={data.height}
                title="Video player"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
                tabIndex={-1}
                className="rounded-lg pointer-events-none select-none"
            ></iframe>
            
        </div>
    );
}