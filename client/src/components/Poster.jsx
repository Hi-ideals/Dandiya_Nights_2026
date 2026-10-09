import { useState } from 'react';
import { CalendarDays, MapPin, Sparkles } from 'lucide-react';
import { useConfig } from '../hooks/useConfig';

const POSTER_SRC = '/poster.jpg';

/** Placeholder shown until client/public/poster.jpg is added. */
function PosterFallback() {
  const { event } = useConfig();
  return (
    <div className="festive-bg relative flex aspect-[2/3] w-full flex-col items-center justify-center overflow-hidden rounded-2xl p-8 text-center">
      <div className="pointer-events-none absolute inset-4 rounded-xl border-2 border-dashed border-gold-400/30" />
      <DandiyaSticks className="mb-6 h-24 w-24 animate-float" />
      <p className="text-xs font-semibold tracking-[0.3em] text-gold-200 uppercase">{event.organizer}</p>
      <h2 className="mt-3 font-display text-5xl leading-none text-gold-300 drop-shadow">{event.name}</h2>
      <p className="mt-3 text-sm text-maroon-100">{event.subtitle}</p>
      <div className="mt-6 space-y-2 text-sm text-white/90">
        <p className="flex items-center justify-center gap-2">
          <CalendarDays className="h-4 w-4 text-gold-300" /> {event.date}
        </p>
        <p className="flex items-center justify-center gap-2">
          <MapPin className="h-4 w-4 text-gold-300" /> {event.venue}
        </p>
      </div>
      <p className="mt-8 flex items-center gap-1 text-xs text-gold-200/70">
        <Sparkles className="h-3.5 w-3.5" /> Event poster coming soon
      </p>
    </div>
  );
}

export function DandiyaSticks({ className = '' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <g strokeLinecap="round" strokeWidth="5">
        <line x1="14" y1="54" x2="42" y2="8" stroke="#fbbf24" />
        <line x1="50" y1="54" x2="22" y2="8" stroke="#db2777" />
      </g>
      <g fill="#fde68a">
        <circle cx="18" cy="47" r="2.5" />
        <circle cx="46" cy="47" r="2.5" />
        <circle cx="32" cy="31" r="3.5" />
      </g>
    </svg>
  );
}

/** Shows the organiser's poster unaltered (object-contain) so its text stays readable. */
export default function Poster({ className = '' }) {
  const [failed, setFailed] = useState(false);
  const { event } = useConfig();

  if (failed) return <PosterFallback />;
  return (
    <img
      src={POSTER_SRC}
      alt={`${event.name} poster - ${event.date} at ${event.venue}`}
      width={1055}
      height={1491}
      className={`h-auto w-full rounded-2xl object-contain ${className}`}
      onError={() => setFailed(true)}
      fetchPriority="high"
      decoding="async"
    />
  );
}
