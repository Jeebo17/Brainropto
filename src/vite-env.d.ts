/// <reference types="vite/client" />

interface YTPlayer {
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  destroy(): void;
}

interface Window {
  YT?: { Player: new (element: HTMLElement, options: Record<string, unknown>) => YTPlayer };
  onYouTubeIframeAPIReady?: () => void;
}
