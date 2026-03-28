import Tile from "./Tile";
import tileData from '../data/tileData.json';
import { TileType } from '../types/Types';

export default function Menu() {
    return (
        <div className="w-64 bg-white shadow-md rounded-lg p-4 absolute bottom-10 flex flex-row">
            {tileData.engagementVideos.map((tile: typeof tileData.engagementVideos[0], index) => (
                <div className="border rounded-lg shadow-sm hover:shadow-md transition-shadow p-2 flex-1" key={index}>
                    {tile.title}
                </div>
            ))}
        </div>
    );
}
