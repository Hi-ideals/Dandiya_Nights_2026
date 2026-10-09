import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Mail, Menu, Phone, Ticket, X } from 'lucide-react';
import { useConfig } from '../hooks/useConfig';
import { useAuth } from '../hooks/useAuth';
import { DandiyaSticks } from '../components/Poster';

const NAV = [
  { href: '/#details', label: 'Event' },
  { href: '/#pricing', label: 'Tickets' },
  { href: '/#competitions', label: 'Competitions' },
  { href: '/#faq', label: 'FAQ' },
  { href: '/#contact', label: 'Contact' },
];

function UserMenu({ mobile = false }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) {
    return (
      <Link to="/login?next=/my-bookings" className={mobile ? 'block py-2.5 text-white/90' : 'ml-1 rounded-full px-3 py-2 text-sm text-white/80 hover:text-gold-200'}>
        Sign in
      </Link>
    );
  }
  const initial = (user.displayName || user.email || '?').charAt(0).toUpperCase();
  return (
    <div className={`flex items-center gap-2 ${mobile ? '' : 'ml-2'}`}>
      {user.photoURL ? (
        <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="h-8 w-8 rounded-full ring-2 ring-gold-400/60" />
      ) : (
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-400 text-sm font-bold text-maroon-950">
          {initial}
        </span>
      )}
      {mobile && <span className="min-w-0 flex-1 truncate text-sm text-white/80">{user.email}</span>}
      <button
        type="button"
        title={`Signed in as ${user.email}`}
        onClick={async () => {
          await logout();
          navigate('/');
        }}
        className="flex items-center gap-1 rounded-full px-2 py-1.5 text-sm text-white/70 hover:text-gold-200"
      >
        <LogOut className="h-4 w-4" /> <span className={mobile ? '' : 'sr-only lg:not-sr-only'}>Sign out</span>
      </button>
    </div>
  );
}

function Navbar() {
  const { event } = useConfig();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location]);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-maroon-950/90 text-white backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6" aria-label="Main">
        <Link to="/" className="flex items-center gap-2">
          <DandiyaSticks className="h-8 w-8" />
          <span className="font-display text-xl whitespace-nowrap text-gold-300">{event.name}</span>
        </Link>
        <div className="hidden items-center gap-1 whitespace-nowrap xl:flex">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} className="rounded-full px-3 py-2 text-sm text-white/80 hover:text-gold-200">
              {item.label}
            </a>
          ))}
          <NavLink to="/my-bookings" className="rounded-full px-3 py-2 text-sm text-white/80 hover:text-gold-200">
            My Tickets
          </NavLink>
          <Link to="/register" className="btn-primary ml-2">
            <Ticket className="h-4 w-4" /> Dandiya
          </Link>
          <Link to="/register/competitions" className="btn ml-1 border border-gold-400/60 px-4 text-gold-200 hover:bg-white/10">
            Rangoli / Drawing
          </Link>
          <UserMenu />
        </div>
        <button
          type="button"
          className="rounded-lg p-2 text-white xl:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>
      {open && (
        <div className="border-t border-white/10 px-4 pb-4 xl:hidden">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} onClick={() => setOpen(false)} className="block py-2.5 text-white/90">
              {item.label}
            </a>
          ))}
          <Link to="/my-bookings" className="block py-2.5 text-white/90">
            My Tickets
          </Link>
          <Link to="/register" className="btn-primary mt-2 w-full">
            <Ticket className="h-4 w-4" /> Dandiya Night Registration
          </Link>
          <Link to="/register/competitions" className="btn mt-2 w-full border border-gold-400/60 text-gold-200">
            Register for Rangoli / Drawing
          </Link>
          <div className="mt-3 border-t border-white/10 pt-3">
            <UserMenu mobile />
          </div>
        </div>
      )}
    </header>
  );
}

function Footer() {
  const { event } = useConfig();
  return (
    <footer className="festive-bg text-white/80">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
        <div>
          <p className="font-display text-2xl text-gold-300">{event.name}</p>
          <p className="mt-2 text-sm">{event.tagline}</p>
          <p className="mt-4 text-xs text-white/50">Organised by {event.organizer}</p>
        </div>
        <div className="text-sm">
          <p className="mb-2 font-semibold text-gold-200">Event</p>
          <p>{event.date}</p>
          <p>{event.time}</p>
          <p>{event.competitionTime}</p>
          <p className="mt-1">{event.venue}</p>
        </div>
        <div className="space-y-2 text-sm">
          <p className="mb-2 font-semibold text-gold-200">Contact</p>
          <a href={`tel:${event.contactPhone.replace(/\s/g, '')}`} className="flex items-center gap-2 hover:text-gold-200">
            <Phone className="h-4 w-4" /> {event.contactPhone}
          </a>
          <a href={`mailto:${event.contactEmail}`} className="flex items-center gap-2 hover:text-gold-200">
            <Mail className="h-4 w-4" /> {event.contactEmail}
          </a>
        </div>
      </div>
      <div className="space-y-1.5 border-t border-white/10 px-4 py-4 text-center text-xs text-white/40">
        <p>© {new Date().getFullYear()} {event.organizer}. Payments secured by Razorpay.</p>
        <p>
          Design &amp; Developed By :{' '}
          <a
            href="https://hiideals.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-gold-300 underline-offset-2 hover:text-gold-200 hover:underline"
          >
            Hi-Ideals Technologies Pvt. Ltd.
          </a>
        </p>
      </div>
    </footer>
  );
}

export default function PublicLayout() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname, hash]);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
