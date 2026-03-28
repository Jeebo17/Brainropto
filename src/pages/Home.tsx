import { useState, useCallback } from 'react';
import { VideoPlayer } from '../components/VideoPlayer';
import type { DragEvent } from 'react';
import { WebcamDetector } from '../components/WebcamDetector';
import DragZone from '../components/DragZone';
import Menu from '../components/Menu';
import tileData from '../data/tileData.json';
import { TileType } from '../types/Types';

const TILE_DRAG_MIME = 'application/x-bathhack-tile';
type SnapSide = 'left' | 'right';

export function Home() {
    const [leftTile, setLeftTile] = useState<TileType | null>(null);
    const [rightTile, setRightTile] = useState<TileType | null>(null);
    const [activeDropZone, setActiveDropZone] = useState<SnapSide | null>(null);
    const [leftWidth, setLeftWidth] = useState(32);
    const [rightWidth, setRightWidth] = useState(32);

    const showLeftZone = Boolean(leftTile) || activeDropZone === 'left';
    const showRightZone = Boolean(rightTile) || activeDropZone === 'right';
 
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
          
    const findTileByUrl = (url: string): TileType | null => {
        const match = tileData.engagementVideos.find((tile) => tile.url === url);
        return match ? { ...match } : null;
    };

    const getDraggedTile = (event: DragEvent<HTMLElement>): TileType | null => {
        const rawTileData = event.dataTransfer.getData(TILE_DRAG_MIME);
        if (rawTileData) {
            try {
                return JSON.parse(rawTileData) as TileType;
            } catch {
                return null;
            }
        }

        const fallbackUrl = event.dataTransfer.getData('text/plain');
        if (!fallbackUrl) {
            return null;
        }

        return findTileByUrl(fallbackUrl);
    };

    const handleDragOverZone = (event: DragEvent<HTMLElement>, side: SnapSide) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        setActiveDropZone(side);
    };

    const handleDropInZone = (event: DragEvent<HTMLElement>, side: SnapSide) => {
        event.preventDefault();
        const droppedTile = getDraggedTile(event);
        setActiveDropZone(null);

        if (!droppedTile) {
            return;
        }

        if (side === 'left') {
            setLeftTile(droppedTile);
            return;
        }

        setRightTile(droppedTile);
    };

    const handleDragLeaveZone = (side: SnapSide) => {
        setActiveDropZone((current) => (current === side ? null : current));
    };

    const clearTile = (side: SnapSide) => {
        if (side === 'left') {
            setLeftTile(null);
            return;
        }

        setRightTile(null);
    };

    return (
        <main className="w-full max-w-none h-[calc(100vh-88px)] bg-[#061126] text-slate-100">
            <div className="relative w-full h-full overflow-hidden">
                <div className="w-full h-full flex items-stretch gap-3">
                    {showLeftZone && (
                    <div className="min-w-0 overflow-hidden" style={{ width: `${leftWidth}vw` }}>
                        <DragZone
                            side="left"
                            tile={leftTile}
                            isActive={activeDropZone === 'left'}
                            onDragOverZone={handleDragOverZone}
                            onDragLeaveZone={handleDragLeaveZone}
                            onDropInZone={handleDropInZone}
                            onClearTile={clearTile}
                        />
                        {leftTile && (
                            <div className="px-3 pb-2">
                                <label className="text-xs text-slate-300">Left Width</label>
                                <input
                                    type="range"
                                    min={18}
                                    max={45}
                                    value={leftWidth}
                                    onChange={(event) => setLeftWidth(Number(event.target.value))}
                                    className="w-full accent-blue-400"
                                />
                            </div>
                        )}
                    </div>
                    )}

                    <section className="h-full min-w-0 flex-1">
                        <WebcamDetector />
                    </section>

                    {showRightZone && (
                    <div className="min-w-0 overflow-hidden" style={{ width: `${rightWidth}vw` }}>
                        <DragZone
                            side="right"
                            tile={rightTile}
                            isActive={activeDropZone === 'right'}
                            onDragOverZone={handleDragOverZone}
                            onDragLeaveZone={handleDragLeaveZone}
                            onDropInZone={handleDropInZone}
                            onClearTile={clearTile}
                        />
                        {rightTile && (
                            <div className="px-3 pb-2">
                                <label className="text-xs text-slate-300">Right Width</label>
                                <input
                                    type="range"
                                    min={18}
                                    max={45}
                                    value={rightWidth}
                                    onChange={(event) => setRightWidth(Number(event.target.value))}
                                    className="w-full accent-blue-400"
                                />
                            </div>
                        )}
                    </div>
                    )}
                </div>

                {!showLeftZone && (
                    <div
                        onDragOver={(event) => handleDragOverZone(event, 'left')}
                        onDrop={(event) => handleDropInZone(event, 'left')}
                        className="absolute left-0 top-0 h-full w-10 bg-transparent"
                    />
                )}

                {!showRightZone && (
                    <div
                        onDragOver={(event) => handleDragOverZone(event, 'right')}
                        onDrop={(event) => handleDropInZone(event, 'right')}
                        className="absolute right-0 top-0 h-full w-10 bg-transparent"
                    />
                )}

                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-[min(520px,92vw)]">
                    <Menu tiles={tileData.engagementVideos} />
                </div>
            </div>
        </main>
    );
}
