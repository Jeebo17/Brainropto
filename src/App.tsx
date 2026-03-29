import { Routes, Route } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Home } from './pages/Home';
import { Settings } from './pages/Settings';
import { NotFound } from './pages/NotFound';
import { Help } from './pages/Help';
import WebCamMotionTrackerPage from './pages/WebCamMotionTrackerPage';
import BrainrotAttack from './components/BrainrotAttack';
import { WebCamMotionTracker } from './components/WebCamMotionTracker';
import { useRef, useState } from 'react';
import type { CSSProperties } from 'react';


function App() {
  // Draggable webcam tracker state
  const [webcamPos, setWebcamPos] = useState<{ x: number; y: number } | null>(null);
  // const webcamDragRef = useRef<{ offsetX: number; offsetY: number } | null>(null);

  // Default position: bottom left, 16px from edge
  const getWebcamStyle = (): CSSProperties => {
      if (webcamPos) {
          return {
              position: 'fixed',
              left: webcamPos.x,
              top: webcamPos.y,
              zIndex: 9999,
              margin: 0,
              padding: 0,
              cursor: 'move',
              pointerEvents: 'all',
          };
      } else {
          return {
              position: 'fixed',
              left: 16,
              bottom: 16,
              zIndex: 9999,
              margin: 0,
              padding: 0,
              // cursor: 'move',
              pointerEvents: 'all',
          };
      }
  };

  // Mouse event handlers for dragging
  // const handleWebcamMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
  //     e.preventDefault();
  //     const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
  //     const offsetX = e.clientX - rect.left;
  //     const offsetY = e.clientY - rect.top;
  //     webcamDragRef.current = { offsetX, offsetY };
  //     window.addEventListener('mousemove', handleWebcamMouseMove as any);
  //     window.addEventListener('mouseup', handleWebcamMouseUp as any);
  // };
  // const handleWebcamMouseMove = (e: MouseEvent) => {
  //     if (!webcamDragRef.current) return;
  //     setWebcamPos(prev => {
  //         const width = 220; // adjust if needed
  //         const height = 170; // adjust if needed
  //         return {
  //             x: Math.max(0, Math.min(window.innerWidth - width, e.clientX - webcamDragRef.current!.offsetX)),
  //             y: Math.max(0, Math.min(window.innerHeight - height, e.clientY - webcamDragRef.current!.offsetY)),
  //         };
  //     });
  // };
  // const handleWebcamMouseUp = () => {
  //     webcamDragRef.current = null;
  //     window.removeEventListener('mousemove', handleWebcamMouseMove as any);
  //     window.removeEventListener('mouseup', handleWebcamMouseUp as any);
  // };

  return (
    <div className="min-h-screen bg-[#061126] text-slate-100">
      {/* Draggable WebCamMotionTracker */}
      {window.location.pathname !== '/webcam-motion-tracker' && (
        <div
        style={getWebcamStyle()}
        // onMouseDown={handleWebcamMouseDown}
        key={window.location.pathname}
        >
        <WebCamMotionTracker small={true} />
        </div>
      )}

      {/* <BrainrotAttack /> */}
      <header className="bg-[#061126] border-b border-[#1a2d4a] p-4">
        <div className="container mx-auto flex items-center gap-3">
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <img src="/brainropto_logo.png" alt="Logo" className="w-8 h-8" />
            <h1 className="text-2xl font-bold text-slate-100">Brainropto</h1>
          </Link>

          <nav className="flex gap-4 ml-auto">
            <Link
              to="/"
              className="text-slate-200 hover:text-blue-300 font-medium transition-colors"
            >
              Home
            </Link>
            <Link
              to="/webcam-motion-tracker"
              className="text-slate-200 hover:text-blue-300 font-medium transition-colors"
            >
              Webcam Motion Tracker
            </Link>
            <Link
              to="/settings"
              className="text-slate-200 hover:text-blue-300 font-medium transition-colors"
            >
              Settings
            </Link>
            <Link
              to="/help"
              className="text-slate-200 hover:text-blue-300 font-medium transition-colors"
            >
              Help

            </Link>
          </nav>
        </div>
      </header>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/home" element={<Home />} />
        <Route path="/webcam-motion-tracker" element={<WebCamMotionTrackerPage />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
        <Route path="/help" element={<Help />} />
      </Routes>
    </div>
  );
}

export default App;
