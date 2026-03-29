import { Routes, Route } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Home } from './pages/Home';
import { Settings } from './pages/Settings';
import { NotFound } from './pages/NotFound';
import { Help } from './pages/Help';
import WebCamMotionTrackerPage from './pages/WebCamMotionTrackerPage';
import { WebCamMotionTracker } from './components/WebCamMotionTracker';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';


function App() {
  // Draggable webcam tracker state
  const [webcamPos, setWebcamPos] = useState<{ x: number; y: number } | null>(null);
  const webcamDragRef = useRef<{ offsetX: number; offsetY: number; width: number; height: number } | null>(null);

  const clampWebcamPos = (x: number, y: number, width: number, height: number) => ({
    x: Math.max(0, Math.min(window.innerWidth - width, x)),
    y: Math.max(0, Math.min(window.innerHeight - height, y)),
  });

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
              right: 16,
              bottom: 16,
              zIndex: 9999,
              margin: 0,
              padding: 0,
              cursor: 'move',
              pointerEvents: 'all',
          };
      }
  };

  // Mouse event handlers for dragging
  const startWebcamDrag = (clientX: number, clientY: number, element: HTMLDivElement) => {
    const rect = element.getBoundingClientRect();
    webcamDragRef.current = {
      offsetX: clientX - rect.left,
      offsetY: clientY - rect.top,
      width: rect.width,
      height: rect.height,
    };
    // Convert from right/bottom anchored default style to absolute left/top once dragging starts.
    setWebcamPos({ x: rect.left, y: rect.top });
  };

  const handleWebcamMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    startWebcamDrag(e.clientX, e.clientY, e.currentTarget);
    window.addEventListener('mousemove', handleWebcamMouseMove as any);
    window.addEventListener('mouseup', handleWebcamMouseUp as any);
  };

  const handleWebcamTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    if (!touch) return;
    startWebcamDrag(touch.clientX, touch.clientY, e.currentTarget);
    window.addEventListener('touchmove', handleWebcamTouchMove as any, { passive: false });
    window.addEventListener('touchend', handleWebcamMouseUp as any);
  };

  const handleWebcamMouseMove = (e: MouseEvent) => {
    if (!webcamDragRef.current) return;
    const { offsetX, offsetY, width, height } = webcamDragRef.current;
    const clamped = clampWebcamPos(e.clientX - offsetX, e.clientY - offsetY, width, height);
    setWebcamPos(clamped);
  };

  const handleWebcamTouchMove = (e: TouchEvent) => {
    if (!webcamDragRef.current) return;
    const touch = e.touches[0];
    if (!touch) return;
    e.preventDefault();
    const { offsetX, offsetY, width, height } = webcamDragRef.current;
    const clamped = clampWebcamPos(touch.clientX - offsetX, touch.clientY - offsetY, width, height);
    setWebcamPos(clamped);
  };

  const handleWebcamMouseUp = () => {
    webcamDragRef.current = null;
    window.removeEventListener('mousemove', handleWebcamMouseMove as any);
    window.removeEventListener('mouseup', handleWebcamMouseUp as any);
    window.removeEventListener('touchmove', handleWebcamTouchMove as any);
    window.removeEventListener('touchend', handleWebcamMouseUp as any);
  };

  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', handleWebcamMouseMove as any);
      window.removeEventListener('mouseup', handleWebcamMouseUp as any);
      window.removeEventListener('touchmove', handleWebcamTouchMove as any);
      window.removeEventListener('touchend', handleWebcamMouseUp as any);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#061126] text-slate-100">
      {/* Draggable WebCamMotionTracker */}
      {window.location.pathname !== '/webcam-motion-tracker' && (
        <div
        style={getWebcamStyle()}
        onMouseDown={handleWebcamMouseDown}
        onTouchStart={handleWebcamTouchStart}
        className="touch-none"
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
              Webcam
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
        <Route path="/webcam" element={<WebCamMotionTrackerPage />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
        <Route path="/help" element={<Help />} />
      </Routes>
    </div>
  );
}

export default App;
