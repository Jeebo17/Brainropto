import { Routes, Route } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Brain } from 'lucide-react';
import { Home } from './pages/Home';
import { Settings } from './pages/Settings';
import { NotFound } from './pages/NotFound';

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-white to-blue-100">
      <header className="bg-white shadow-md p-4">
        <div className="container mx-auto flex items-center gap-3">
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <Brain className="w-8 h-8 text-purple-600" />
            <h1 className="text-2xl font-bold text-gray-800">Brainrot Central</h1>
          </Link>
          <span className="text-sm text-gray-500 ml-auto">
            Upload videos & show the 67 gesture
          </span>
          <nav className="flex gap-4 ml-auto">
            <Link
              to="/"
              className="text-gray-700 hover:text-purple-600 font-medium transition-colors"
            >
              Home
            </Link>
            <Link
              to="/settings"
              className="text-gray-700 hover:text-purple-600 font-medium transition-colors"
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
