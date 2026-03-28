import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';

export function NotFound() {
  return (
    <main className="container mx-auto p-8 flex flex-col items-center justify-center min-h-[60vh] bg-[#061126] text-slate-100">
      <div className="text-center">
        <AlertCircle className="w-16 h-16 text-blue-300 mx-auto mb-4" />
        <h1 className="text-4xl font-bold text-slate-100 mb-2">404</h1>
        <p className="text-xl text-slate-300 mb-6">Page not found</p>
        <Link
          to="/"
          className="inline-block bg-[#16325f] text-slate-100 font-semibold py-2 px-6 rounded-lg hover:bg-[#1d3c71] transition-colors"
        >
          Go back to Home
        </Link>
      </div>
    </main>
  );
}
