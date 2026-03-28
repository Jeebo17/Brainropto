import type { DragEvent } from 'react';
import { TileType } from '../types/Types';

const TILE_DRAG_MIME = 'application/x-bathhack-tile';

interface MenuProps {
    tiles: TileType[];
}

export default function Menu({ tiles }: MenuProps) {
    const handleDragStart = (event: DragEvent<HTMLDivElement>, tile: TileType) => {
        event.dataTransfer.effectAllowed = 'copy';
        event.dataTransfer.setData(TILE_DRAG_MIME, JSON.stringify(tile));
        event.dataTransfer.setData('text/plain', tile.url);
    };

    return (
        <div className="w-full max-w-md bg-[#061126] border border-[#1a2d4a] shadow-md rounded-lg p-4">
            <p className="text-sm font-semibold text-slate-200 mb-3">Video Menu</p>
            <div className="flex flex-col gap-2">
                {tiles.map((tile) => (
                    <div
                        key={tile.url}
                        draggable
                        onDragStart={(event) => handleDragStart(event, tile)}
                        className="border border-[#1a2d4a] rounded-lg shadow-sm hover:shadow-md transition-shadow p-3 bg-[#0a1933] hover:bg-[#0f2345] cursor-grab active:cursor-grabbing"
                    >
                        <p className="text-sm font-medium text-slate-100">{tile.title}</p>
                        <p className="text-xs text-slate-300 mt-1">Drag to left or right snap zone</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
