import { Link } from 'react-router-dom';
import { DandiyaSticks } from '../components/Poster';

export default function NotFoundPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <DandiyaSticks className="h-16 w-16 animate-float" />
      <h1 className="mt-4 font-display text-4xl text-maroon-800">Page not found</h1>
      <p className="mt-2 text-stone-600">This page danced away. Let's get you back to the celebration.</p>
      <Link to="/" className="btn-maroon mt-6">
        Back to home
      </Link>
    </div>
  );
}
