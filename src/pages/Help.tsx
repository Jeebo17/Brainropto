export function Help() {
  return (
    <div className="w-full max-w-6xl mx-auto p-6">
      <div className="w-full bg-slate-800 rounded-md p-6 text-slate-200">
        <h1 className="text-2xl font-semibold mb-4">Help & How to Use Brainropto</h1>

        <section className="mb-6">
          <h2 className="text-lg font-medium mb-2">Before You Start</h2>
          <ul className="list-disc pl-5 text-sm text-slate-300 space-y-2">
            <li>
              <span className="font-medium text-slate-100">Allow webcam access</span> — The webcam tracking features
              require camera permission. Your browser will prompt you when you first open the website, reload the website to allow access if you haven't already.
            </li>
            <li>
              <span className="font-medium text-slate-100">YouTube / Panopto videos</span> — For 67 and rickroll
              detection to work on embedded YouTube or Panopto links, you need to allow screen recording permission.
            </li>
            <li>
              <span className="font-medium text-slate-100">.mp4 files work best</span> — For the most reliable 67 and
              rickroll detection, use .mp4 files directly rather than streaming links. Other video formats may work but haven't been tested.
            </li>
          </ul>
        </section>

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
          <h2 className="text-lg font-medium mb-2">Webcam Tracking</h2>
          <p className="mb-2">
            The webcam tracker watches you through your camera and reacts to different gestures. Hold each gesture
            for about 1 second for it to be recognised.
          </p>
          <ul className="list-disc pl-5 text-sm text-slate-300 space-y-2">
            <li>
              <span className="font-medium text-slate-100">Close your eyes</span> — Keep them closed for 5 seconds
              (changeable in settings) and see what happens.
            </li>
            <li>
              <span className="font-medium text-slate-100">Open your mouth wide</span> — Hold it open for a second.
            </li>
            <li>
              <span className="font-medium text-slate-100">Put your hands on your head</span> — Rest both hands on top of your head.
            </li>
            <li>
              <span className="font-medium text-slate-100">Shush gesture</span> — Hold your index finger to your lips.
            </li>
            <li>
              <span className="font-medium text-slate-100">Point up</span> — Point your index finger straight up, away from your face.
            </li>
          </ul>
          <p className="mt-3 text-sm text-slate-300">
            You can toggle image popups, mute alert sounds, and show/hide the skeleton overlay in the Settings page.
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
          <p className="mb-2 text-slate-300">Email thornroutila@gmail.com with a description and a screenshot.</p>
        </section>
      </div>
    </div>
  );
}