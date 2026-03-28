import { Routes, Route } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Home } from './pages/Home';
import { Settings } from './pages/Settings';
import { NotFound } from './pages/NotFound';
<<<<<<< HEAD
import WebCamMotionTrackerPage from './pages/WebCamMotionTracker';
=======
import Help from './pages/Help';
>>>>>>> a9061d4 (help page)
import BrainrotAttack from './components/BrainrotAttack';


function App() {
  return (
    <div className="min-h-screen bg-[#061126] text-slate-100">
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
              to="/settings"
              className="text-slate-200 hover:text-blue-300 font-medium transition-colors"
            >
              Settings
            </Link>
            <Link
<<<<<<< HEAD
              to="/webcam-motion-tracker"
              className="text-slate-200 hover:text-blue-300 font-medium transition-colors"
            >
              Webcam Motion Tracker
=======
              to="/help"
              className="text-slate-200 hover:text-blue-300 font-medium transition-colors"
            >
              Help
>>>>>>> a9061d4 (help page)
            </Link>
          </nav>
        </div>
      </header>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/home" element={<Home />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/webcam-motion-tracker" element={<WebCamMotionTrackerPage />} />
        <Route path="*" element={<NotFound />} />
        <Route path="/help" element={<Help />} />
      </Routes>
    </div>
  );
}

export default App;
