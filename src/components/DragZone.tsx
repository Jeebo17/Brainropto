import type { DragEvent } from 'react';
import Tile from './Tile';
import { TileType } from '../types/Types';
import { Plus } from 'lucide-react';

type SnapSide = 'left' | 'right';

interface DragZoneProps {
    side: SnapSide;
    tile: TileType | null;
    isActive: boolean;
    onDragOverZone: (event: DragEvent<HTMLElement>, side: SnapSide) => void;
    onDragLeaveZone: (side: SnapSide) => void;
    onDropInZone: (event: DragEvent<HTMLElement>, side: SnapSide) => void;
    onClearTile: (side: SnapSide) => void;
    showFullscreen?: boolean;
    onFullscreen?: () => void;
}

export default function DragZone({
    side,
    tile,
    isActive,
    onDragOverZone,
    onDragLeaveZone,
    onDropInZone,
    onClearTile,
    showFullscreen = false,
    onFullscreen,
}: DragZoneProps) {
    const sideLabel = side === 'left' ? 'Left' : 'Right';

    return (
        <section
            onDragOver={(event) => onDragOverZone(event, side)}
            onDragLeave={() => onDragLeaveZone(side)}
            onDrop={(event) => onDropInZone(event, side)}
            className={`h-full border-2 border-dashed rounded-xl p-1 transition-colors flex flex-col ${
                isActive ? 'border-blue-400 bg-[#0f2345]' : 'border-[#1a2d4a] bg-[#061126]'
            }`}
        >
            {tile ? (
                <div className="space-y-2 flex-1 flex flex-col min-h-0 relative">
                    {showFullscreen && onFullscreen && (
                        <button
                            onClick={onFullscreen}
                            className="absolute top-2 left-2 px-2 py-1 text-xs bg-blue-600 text-white rounded shadow hover:bg-blue-700 z-10"
                        >
                            Fullscreen
                        </button>
                    )}
                    <Tile data={tile} />
                    <button
                        onClick={() => onClearTile(side)}
                        className="w-full px-3 py-2 text-sm bg-[#0f2345] border border-[#1a2d4a] text-slate-100 rounded-md hover:bg-[#16325f]"
                    >
                        Remove {sideLabel} Tile
                    </button>
                </div>
            ) : (
                <div className="flex-1 flex items-center justify-center">
                    <Plus className="w-24 h-24 text-slate-400" />
                </div>
            )}
        </section>
    );
}