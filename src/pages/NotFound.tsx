import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';

export function NotFound() {
  return (
    <main className="container mx-auto p-8 flex flex-col items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h1 className="text-4xl font-bold text-gray-800 mb-2">404</h1>
        <p className="text-xl text-gray-600 mb-6">Page not found</p>
        <Link
          to="/"
          className="inline-block bg-purple-600 text-white font-semibold py-2 px-6 rounded-lg hover:bg-purple-700 transition-colors"
        >
          Go back to Home
        </Link>
      </div>
    </main>
  );
}
