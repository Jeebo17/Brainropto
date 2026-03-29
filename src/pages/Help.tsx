import React from 'react';
import { Link } from 'react-router-dom';

export default function Help() {
  return (
    <div className="w-full max-w-6xl mx-auto p-6">
      <div className="w-full bg-slate-800 rounded-md p-6 text-slate-200">
        <h1 className="text-2xl font-semibold mb-4">Help & How to Use Brainropto</h1>

        <section className="mb-6">
          <h2 className="text-lg font-medium mb-2">Load a video (Paste a link)</h2>
          <p className="mb-2">
            Paste a Panopto or YouTube link into the input directly below the large player on the main page (the input labeled
            "Panopto or YouTube URL"). After pasting, click "Load" to fetch the video into the player.
          </p>
          <p className="mb-2 text-sm text-slate-300">
            Tip: include the full URL (starting with https://). If the video doesn't load, try a different browser.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-medium mb-2">Using the Drag and Drop Menu</h2>
          <p className="mb-2 text-slate-300">
            The "Drag and Drop Menu" at the bottom contains quick items (e.g. Subway Surfers, GTA Parkour). Drag one of those items
            from the menu toward a side tile to populate the right or left side panel with that demo/video.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-medium mb-2">Remove / Replace videos</h2>
          <p className="mb-2 text-slate-300">
            Each loaded tile has a "Remove" button. Click it to clear that slot and add a different video or drag another demo over it.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-medium mb-2">Troubleshooting</h2>
          <ul className="list-disc pl-5 text-sm text-slate-300">
            <li>If a link fails, try loading the same link in a new tab to confirm it is reachable.</li>
            <li>Large local files may be slow — try a smaller test clip first.</li>
            <li>Use a modern browser (Chrome, Edge, Firefox, Safari).</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-medium mb-2">Still stuck?</h2>
          <p className="mb-2 text-slate-300">Email Oliver with a description and a screenshot.</p>
        </section>
      </div>
    </div>
  );
}