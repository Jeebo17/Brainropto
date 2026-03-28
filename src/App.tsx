import { Routes, Route } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Home } from './pages/Home';
import { Settings } from './pages/Settings';
import { NotFound } from './pages/NotFound';

function App() {
  return (
    <div className="min-h-screen bg-[#061126] text-slate-100">
      <header className="bg-[#061126] border-b border-[#1a2d4a] p-4">
        <div className="container mx-auto flex items-center gap-3">
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <img src="/brainropto_logo.png" alt="Logo" className="w-8 h-8" />
            <h1 className="text-2xl font-bold text-slate-100">Brainropto</h1>
          </Link>
          <span className="text-sm text-slate-400 ml-auto">
            Upload videos & show the 67 gesture
          </span>
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
          </nav>
        </div>
      </header>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/home" element={<Home />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}

export default App;
