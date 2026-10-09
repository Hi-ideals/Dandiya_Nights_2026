import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, LogOut, Menu, QrCode, Users, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { DandiyaSticks } from '../components/Poster';

const LINKS = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin'], end: true },
  { to: '/admin/registrations', label: 'Registrations', icon: Users, roles: ['admin'] },
  { to: '/staff/check-in', label: 'Ticket Check-in', icon: QrCode, roles: ['admin', 'staff'] },
];

export default function AdminLayout() {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const links = LINKS.filter((l) => l.roles.includes(role));

  async function handleLogout() {
    await logout();
    navigate('/admin/login', { replace: true });
  }

  const nav = (
    <nav className="flex flex-col gap-1" aria-label="Admin">
      {links.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              isActive ? 'bg-gold-400 text-maroon-950' : 'text-white/80 hover:bg-white/10 hover:text-white'
            }`
          }
        >
          <Icon className="h-4 w-4" /> {label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-stone-50 lg:flex">
      <aside className="festive-bg hidden w-64 shrink-0 flex-col p-4 text-white lg:flex">
        <Link to="/" className="mb-8 flex items-center gap-2 px-2">
          <DandiyaSticks className="h-8 w-8" />
          <span className="font-display text-lg text-gold-300">Admin Panel</span>
        </Link>
        {nav}
        <div className="mt-auto border-t border-white/10 pt-4 text-xs">
          <p className="truncate text-white/70">{user?.email}</p>
          <p className="mb-3 capitalize text-gold-200">{role}</p>
          <button type="button" onClick={handleLogout} className="flex items-center gap-2 text-white/80 hover:text-white">
            <LogOut className="h-4 w-4" /> Log out
          </button>
        </div>
      </aside>

      <header className="festive-bg sticky top-0 z-30 flex h-14 items-center justify-between px-4 text-white lg:hidden">
        <span className="font-display text-lg text-gold-300">Admin Panel</span>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-label="Toggle menu" aria-expanded={open}>
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </header>
      {open && (
        <div className="festive-bg sticky top-14 z-30 space-y-4 p-4 text-white lg:hidden">
          {nav}
          <button type="button" onClick={handleLogout} className="flex items-center gap-2 px-3 text-sm text-white/80">
            <LogOut className="h-4 w-4" /> Log out ({user?.email})
          </button>
        </div>
      )}

      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
}
