import type { DragEvent } from 'react';
import { useState, useRef, useCallback, useEffect } from 'react';
import { WebcamDetector } from '../components/WebcamDetector';
import DragZone from '../components/DragZone';
import DrapAndDropMenu from '../components/DrapAndDropMenu';
import tileData from '../data/tileData.json';
import { TileType } from '../types/Types';

const TILE_DRAG_MIME = 'application/x-bathhack-tile';
type SnapSide = 'left' | 'right';

export function Home() {
    const [leftTile, setLeftTile] = useState<TileType | null>(null);
    const [rightTile, setRightTile] = useState<TileType | null>(null);
    const [activeDropZone, setActiveDropZone] = useState<SnapSide | null>(null);
    const [leftWidth, setLeftWidth] = useState(25); // in vw
    const [rightWidth, setRightWidth] = useState(25); // in vw
    const [fullscreenSide, setFullscreenSide] = useState<null | 'left' | 'right'>(null);
    const [floatingPos, setFloatingPos] = useState<{x: number, y: number}>({ x: 40, y: 40 });
    const [show67Indicator, setShow67Indicator] = useState(false);
    const gesture67TimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const draggingRef = useRef<{side: 'left'|'right'|null, startX: number, startLeft: number, startRight: number}|null>(null);

    const floatingDragRef = useRef<{offsetX: number, offsetY: number} | null>(null);
        // Floating modal drag logic
        const handleFloatingMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
            floatingDragRef.current = {
                offsetX: e.clientX - floatingPos.x,
                offsetY: e.clientY - floatingPos.y,
            };
            window.addEventListener('mousemove', handleFloatingMouseMove as any);
            window.addEventListener('mouseup', handleFloatingMouseUp as any);
        };
        const handleFloatingMouseMove = (e: MouseEvent) => {
            if (!floatingDragRef.current) return;
            setFloatingPos({
                x: e.clientX - floatingDragRef.current.offsetX,
                y: e.clientY - floatingDragRef.current.offsetY,
            });
        };
        const handleFloatingMouseUp = () => {
            floatingDragRef.current = null;
            window.removeEventListener('mousemove', handleFloatingMouseMove as any);
            window.removeEventListener('mouseup', handleFloatingMouseUp as any);
        };
    // --- Drag handle logic ---
    const handleDragStart = (side: 'left'|'right', e: React.MouseEvent | React.TouchEvent) => {
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        draggingRef.current = {
            side,
            startX: clientX,
            startLeft: leftWidth,
            startRight: rightWidth,
        };
        window.addEventListener('mousemove', handleDragMove as any);
        window.addEventListener('touchmove', handleDragMove as any, { passive: false });
        window.addEventListener('mouseup', handleDragEnd as any);
        window.addEventListener('touchend', handleDragEnd as any);
    };

    const handleDragMove = (e: MouseEvent | TouchEvent) => {
        if (!draggingRef.current) return;
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
        const vw = window.innerWidth / 100;
        const deltaVw = (clientX - draggingRef.current.startX) / vw;
        if (draggingRef.current.side === 'left') {
            let newLeft = Math.max(12, Math.min(45, draggingRef.current.startLeft + deltaVw));
            setLeftWidth(newLeft);
        } else if (draggingRef.current.side === 'right') {
            let newRight = Math.max(12, Math.min(45, draggingRef.current.startRight - deltaVw));
            setRightWidth(newRight);
        }
        e.preventDefault?.();
    };

    const handleDragEnd = () => {
        draggingRef.current = null;
        window.removeEventListener('mousemove', handleDragMove as any);
        window.removeEventListener('touchmove', handleDragMove as any);
        window.removeEventListener('mouseup', handleDragEnd as any);
        window.removeEventListener('touchend', handleDragEnd as any);
    };

    const showLeftZone = Boolean(leftTile) || activeDropZone === 'left';
    const showRightZone = Boolean(rightTile) || activeDropZone === 'right';

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

        // comment
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

    useEffect(() => {
        return () => {
            if (gesture67TimeoutRef.current) {
                clearTimeout(gesture67TimeoutRef.current);
            }
        };
    }, []);

    const handleGesture = useCallback((gesture: '67' | 'rickroll') => {
        if (gesture === '67') {
            setShow67Indicator(true);

            if (gesture67TimeoutRef.current) {
                clearTimeout(gesture67TimeoutRef.current);
            }

            gesture67TimeoutRef.current = setTimeout(() => {
                setShow67Indicator(false);
            }, 1000);
        }
    }, []);

    return (
        <main className="w-full max-w-none h-[calc(100vh-88px)] bg-[#061126] text-slate-100">
            <div className="relative w-full h-full overflow-hidden">
                {show67Indicator && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none">
                        <div className="text-[38vw] leading-none font-black uppercase tracking-[-0.08em] text-red-500 drop-shadow-[0_0_30px_rgba(255,0,0,0.95)] animate-pulse select-none">
                            67
                        </div>
                    </div>
                )}

                {/* Fullscreen overlay */}
                {fullscreenSide && (
                    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
                        <div className="absolute top-4 right-4 z-60">
                            <button
                                className="px-4 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700"
                                onClick={() => setFullscreenSide(null)}
                            >
                                Exit Fullscreen
                            </button>
                        </div>
                        {/* Main fullscreen video */}
                        <div className="w-[min(90vw,600px)] h-[min(90vh,96vw)] flex items-center justify-center">
                            <DragZone
                                side={fullscreenSide}
                                tile={fullscreenSide === 'left' ? leftTile : rightTile}
                                isActive={false}
                                onDragOverZone={() => {}}
                                onDragLeaveZone={() => {}}
                                onDropInZone={() => {}}
                                onClearTile={() => setFullscreenSide(null)}
                                showFullscreen={false}
                            />
                        </div>
                        {/* Floating modal for the other video */}
                        {(fullscreenSide === 'left' && rightTile) || (fullscreenSide === 'right' && leftTile) ? (
                            <div
                                className="fixed z-60 bg-[#061126] border border-blue-400 rounded-lg shadow-lg cursor-move"
                                style={{
                                    left: floatingPos.x,
                                    top: floatingPos.y,
                                    width: 220,
                                    height: 390,
                                }}
                                onMouseDown={handleFloatingMouseDown}
                            >
                                <DragZone
                                    side={fullscreenSide === 'left' ? 'right' : 'left'}
                                    tile={fullscreenSide === 'left' ? rightTile : leftTile}
                                    isActive={false}
                                    onDragOverZone={() => {}}
                                    onDragLeaveZone={() => {}}
                                    onDropInZone={() => {}}
                                    onClearTile={() => {
                                        if (fullscreenSide === 'left') setRightTile(null);
                                        else setLeftTile(null);
                                    }}
                                    showFullscreen={false}
                                />
                            </div>
                        ) : null}
                    </div>
                )}
                {/* Normal layout */}
                {!fullscreenSide && (
                    <div className="w-full h-full flex items-stretch gap-0">
                        {showLeftZone && (
                            <div className="min-w-0 overflow-hidden relative group" style={{ width: `${leftWidth}vw` }}>
                                <DragZone
                                    side="left"
                                    tile={leftTile}
                                    isActive={activeDropZone === 'left'}
                                    onDragOverZone={handleDragOverZone}
                                    onDragLeaveZone={handleDragLeaveZone}
                                    onDropInZone={handleDropInZone}
                                    onClearTile={clearTile}
                                    showFullscreen={true}
                                    onFullscreen={() => setFullscreenSide('left')}
                                />
                                {/* Drag handle for resizing left */}
                                <div
                                    className="absolute top-0 right-0 h-full w-2 cursor-ew-resize z-30 bg-blue-300/10 group-hover:bg-blue-400/30 transition-colors"
                                    onMouseDown={(e) => handleDragStart('left', e)}
                                    onTouchStart={(e) => handleDragStart('left', e)}
                                    style={{ userSelect: 'none', touchAction: 'none' }}
                                />
                            </div>
                        )}

                        <section className="h-full min-w-0 flex-1 relative">
                            {/* Drag handle for resizing right */}
                            {showRightZone && (
                                <div
                                    className="absolute top-0 right-0 h-full w-2 cursor-ew-resize z-30 bg-blue-300/10 hover:bg-blue-400/30 transition-colors"
                                    onMouseDown={(e) => handleDragStart('right', e)}
                                    onTouchStart={(e) => handleDragStart('right', e)}
                                    style={{ userSelect: 'none', touchAction: 'none' }}
                                />
                            )}
                            <WebcamDetector onGesture={handleGesture} />
                        </section>

                        {showRightZone && (
                            <div className="min-w-0 overflow-hidden relative" style={{ width: `${rightWidth}vw` }}>
                                <DragZone
                                    side="right"
                                    tile={rightTile}
                                    isActive={activeDropZone === 'right'}
                                    onDragOverZone={handleDragOverZone}
                                    onDragLeaveZone={handleDragLeaveZone}
                                    onDropInZone={handleDropInZone}
                                    onClearTile={clearTile}
                                    showFullscreen={true}
                                    onFullscreen={() => setFullscreenSide('right')}
                                />
                            </div>
                        )}
                    </div>
                )}

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
                    <DrapAndDropMenu tiles={tileData.engagementVideos} />
                </div>
            </div>
        </main>
    );
}
