import { Link } from 'react-router-dom';
import {
  Brush,
  CalendarDays,
  Camera,
  ChevronDown,
  Clock,
  Flower2,
  Gamepad2,
  Gift,
  Heart,
  Mail,
  MapPin,
  Music,
  Phone,
  Sparkles,
  Ticket,
  Trophy,
  User,
  UtensilsCrossed,
  Users,
  Handshake,
} from 'lucide-react';
import { useConfig } from '../hooks/useConfig';
import Poster from '../components/Poster';
import { formatINR } from '../utils/format';

const HIGHLIGHTS = [
  { icon: UtensilsCrossed, label: 'Food Stalls' },
  { icon: Camera, label: 'Photo Booth' },
  { icon: Music, label: 'DJ & Music' },
  { icon: Gamepad2, label: 'Fun Games' },
  { icon: Users, label: 'Cultural Performances' },
  { icon: Gift, label: 'Gifts & More Surprises' },
];

function RegisterButton({ className = '' }) {
  return (
    <Link to="/register" className={`btn-primary px-7 py-3.5 text-base ${className}`}>
      <Ticket className="h-5 w-5" /> Click Here for Registration
    </Link>
  );
}

function Hero() {
  const { event } = useConfig();
  return (
    <section className="festive-bg relative overflow-hidden text-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-around" aria-hidden="true">
        {Array.from({ length: 14 }).map((_, i) => (
          <span
            key={i}
            className="mt-3 h-1.5 w-1.5 animate-twinkle rounded-full bg-gold-300 shadow-[0_0_12px_4px_rgba(252,211,77,0.6)]"
            style={{ animationDelay: `${(i % 5) * 0.4}s` }}
          />
        ))}
      </div>

      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:py-20">
        <div className="order-2 animate-fade-up text-center lg:order-1 lg:text-left">
          <p className="inline-flex items-center gap-2 rounded-full border border-gold-400/30 bg-white/5 px-4 py-1.5 text-xs font-semibold tracking-widest text-gold-200 uppercase">
            <Sparkles className="h-3.5 w-3.5" /> {event.organizer} presents
          </p>
          <h1 className="mt-5 font-display text-5xl leading-[1.05] text-gold-300 drop-shadow-[0_4px_20px_rgba(245,158,11,0.35)] sm:text-6xl lg:text-7xl">
            {event.name}
          </h1>
          <p className="mt-3 text-lg font-medium text-maroon-100 sm:text-xl">{event.subtitle}</p>
          <p className="mt-2 text-white/70">{event.tagline}</p>

          <ul className="mt-7 flex flex-wrap justify-center gap-2.5 text-sm lg:justify-start">
            <li className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2">
              <CalendarDays className="h-4 w-4 text-gold-300" /> {event.date}
            </li>
            <li className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2">
              <Clock className="h-4 w-4 text-gold-300" /> {event.time}
            </li>
            <li className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2">
              <MapPin className="h-4 w-4 text-gold-300" /> {event.venue}
            </li>
          </ul>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
            {event.registrationOpen ? (
              <RegisterButton />
            ) : (
              <span className="btn bg-white/10 text-white">Registrations are closed</span>
            )}
            <a href="#pricing" className="btn text-gold-200 hover:text-gold-100">
              View ticket prices <ChevronDown className="h-4 w-4" />
            </a>
          </div>
        </div>

        <div className="order-1 mx-auto w-full max-w-md lg:order-2">
          <div className="relative">
            <div className="absolute -inset-4 rounded-[2rem] bg-linear-to-br from-gold-400/40 via-pink-500/30 to-maroon-500/40 blur-2xl" aria-hidden="true" />
            <a
              href="/poster.jpg"
              target="_blank"
              rel="noreferrer"
              className="group relative block rounded-3xl bg-linear-to-br from-gold-300 to-gold-600 p-1.5 shadow-2xl transition hover:scale-[1.01]"
              aria-label="Open the full-size event poster"
            >
              <Poster />
              <span className="absolute right-4 bottom-4 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white opacity-90 backdrop-blur group-hover:opacity-100">
                Tap to view full poster
              </span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function EventDetails() {
  const { event } = useConfig();
  const cards = [
    { icon: Brush, title: 'Drawing & Rangoli Competitions', lines: [event.date, event.competitionTime] },
    { icon: Music, title: 'Dandiya Night', lines: [event.date, event.time, 'Dance · Dandiya · Dhamal'] },
    {
      icon: MapPin,
      title: 'Venue',
      lines: [event.venue],
      link: event.venueMapUrl ? { href: event.venueMapUrl, label: 'Open in Maps' } : null,
    },
  ];

  return (
    <section id="details" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6">
      <div className="text-center">
        <h2 className="section-title">Event Details</h2>
        <p className="mt-2 text-stone-600">Two celebrations, one festive day.</p>
      </div>
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {cards.map(({ icon: Icon, title, lines, link }) => (
          <div key={title} className="card p-6 transition hover:-translate-y-1 hover:shadow-lg">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-maroon-50 text-maroon-700">
              <Icon className="h-6 w-6" />
            </div>
            <h3 className="mt-4 font-semibold text-stone-900">{title}</h3>
            {lines.map((line) => (
              <p key={line} className="mt-1 text-sm text-stone-600">
                {line}
              </p>
            ))}
            {link && (
              <a href={link.href} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-semibold text-maroon-700">
                {link.label} →
              </a>
            )}
          </div>
        ))}
      </div>
      <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {HIGHLIGHTS.map(({ icon: Icon, label }) => (
          <li key={label} className="flex items-center gap-3 rounded-xl bg-maroon-900 px-4 py-3 text-sm font-medium text-gold-100">
            <Icon className="h-5 w-5 shrink-0 text-gold-300" /> {label}
          </li>
        ))}
      </ul>
    </section>
  );
}

function PriceCard({ icon: Icon, title, item, unit, highlight }) {
  return (
    <div
      className={`relative flex flex-col rounded-2xl p-6 ${
        highlight ? 'bg-maroon-900 text-white shadow-xl ring-2 ring-gold-400' : 'card'
      }`}
    >
      {highlight && (
        <span className="absolute -top-3 left-6 rounded-full bg-gold-400 px-3 py-0.5 text-xs font-bold text-maroon-950">
          Most popular
        </span>
      )}
      <Icon className={`h-8 w-8 ${highlight ? 'text-gold-300' : 'text-maroon-600'}`} />
      <h3 className={`mt-3 text-lg font-semibold ${highlight ? 'text-gold-100' : 'text-stone-900'}`}>{title}</h3>
      <p className={`mt-3 font-display text-4xl ${highlight ? 'text-gold-300' : 'text-maroon-800'}`}>
        {formatINR(item.basePaise + item.platformFeePaise)}
      </p>
      <p className={`mt-1 text-xs ${highlight ? 'text-white/60' : 'text-stone-500'}`}>
        {formatINR(item.basePaise)} + {formatINR(item.platformFeePaise)} platform fee · {unit}
      </p>
    </div>
  );
}

function Pricing() {
  const { pricing } = useConfig();
  const perRegistration = pricing.competitionChargeMode === 'per_registration';
  return (
    <section id="pricing" className="scroll-mt-20 bg-white py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="text-center">
          <h2 className="section-title">Ticket Prices</h2>
          <p className="mt-2 text-stone-600">
            Book up to {pricing.maxTicketsPerBooking} tickets per booking. Pay securely online.
          </p>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <PriceCard icon={Heart} title="Couple Entry" item={pricing.categories.couple} unit="per couple ticket" highlight />
          <PriceCard icon={User} title="Single Entry" item={pricing.categories.single} unit="per ticket" />
          <PriceCard
            icon={Trophy}
            title="Drawing / Rangoli"
            item={pricing.competitions.rangoli}
            unit={perRegistration ? 'per competition, per booking' : 'per competition, per ticket'}
          />
        </div>
        <div className="mt-10 text-center">
          <RegisterButton />
        </div>
      </div>
    </section>
  );
}

function Competitions() {
  const { event, pricing } = useConfig();
  const comps = [
    {
      icon: Brush,
      title: 'Drawing Competition',
      rules: [`Theme: ${event.competitionTheme}`, 'Any medium (pencil, colour, crayons, etc.)', 'Use the given template (same for all participants)'],
    },
    {
      icon: Flower2,
      title: 'Rangoli Competition',
      rules: [`Theme: ${event.competitionTheme}`, 'Use colours / rangoli materials of your choice', 'Use the given template (same for all participants)'],
    },
  ];
  return (
    <section id="competitions" className="festive-bg scroll-mt-20 py-16 text-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="text-center">
          <h2 className="font-display text-3xl text-gold-300 sm:text-4xl">Drawing & Rangoli Competitions</h2>
          <p className="mt-2 text-white/70">{event.competitionTime} · on the same day</p>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {comps.map(({ icon: Icon, title, rules }) => (
            <div key={title} className="rounded-2xl border border-gold-400/20 bg-white/5 p-6 backdrop-blur">
              <div className="flex items-center gap-3">
                <Icon className="h-7 w-7 text-gold-300" />
                <h3 className="text-xl font-semibold text-gold-100">{title}</h3>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-white/80">
                {rules.map((rule) => (
                  <li key={rule} className="flex gap-2">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" /> {rule}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-linear-to-br from-gold-300 to-gold-500 p-5 text-center text-maroon-950">
            <Trophy className="mx-auto h-7 w-7" />
            <p className="mt-1 text-sm font-semibold">1st Prize</p>
            <p className="font-display text-3xl">{event.prizes.first}</p>
            <p className="text-xs">Drawing & Rangoli, each</p>
          </div>
          <div className="rounded-2xl bg-linear-to-br from-stone-200 to-stone-400 p-5 text-center text-stone-900">
            <Trophy className="mx-auto h-7 w-7" />
            <p className="mt-1 text-sm font-semibold">2nd Prize</p>
            <p className="font-display text-3xl">{event.prizes.second}</p>
            <p className="text-xs">Drawing & Rangoli, each</p>
          </div>
          <div className="rounded-2xl border border-gold-400/30 p-5 text-center">
            <Ticket className="mx-auto h-7 w-7 text-gold-300" />
            <p className="mt-1 text-sm font-semibold text-gold-100">Registration amount</p>
            <p className="font-display text-3xl text-gold-300">{formatINR(pricing.competitions.rangoli.basePaise)}</p>
            <p className="text-xs text-white/60">+ {formatINR(pricing.competitions.rangoli.platformFeePaise)} platform fee each</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Sponsors() {
  const { event } = useConfig();
  if (!event.sponsors?.length) return null;
  return (
    <section id="sponsors" className="scroll-mt-20 bg-white py-14">
      <div className="mx-auto max-w-5xl px-4 text-center sm:px-6">
        <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.25em] text-gold-600 uppercase">
          <Handshake className="h-4 w-4" /> With gratitude
        </p>
        <h2 className="section-title mt-2">Our Proud Sponsors</h2>
        <ul className="mt-8 flex flex-wrap justify-center gap-3">
          {event.sponsors.map((name) => (
            <li
              key={name}
              className="rounded-full border border-maroon-100 bg-cream px-5 py-2.5 text-sm font-semibold text-maroon-800 shadow-sm"
            >
              {name}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Faq() {
  const { event, pricing } = useConfig();
  const items = [
    [
      'What is the difference between Couple and Single tickets?',
      `A Couple ticket admits two people (${formatINR(pricing.categories.couple.basePaise + pricing.categories.couple.platformFeePaise)} incl. platform fee). A Single ticket admits one person (${formatINR(pricing.categories.single.basePaise + pricing.categories.single.platformFeePaise)} incl. platform fee).`,
    ],
    [
      'How many tickets can I book at once?',
      `Up to ${pricing.maxTicketsPerBooking} tickets per booking. Each ticket gets its own number and QR code, so your group can enter separately.`,
    ],
    [
      'Do I need a Dandiya ticket to join the competitions?',
      'Competitions are added to a booking during registration. You can choose Rangoli, Drawing, both, or neither. The competition fee is charged once per booking.',
    ],
    [
      'When are the competitions and the Dandiya night?',
      `${event.competitionTime}. ${event.time}. Both on ${event.date} at ${event.venue}.`,
    ],
    [
      'How do I get my ticket?',
      'Sign in with Google, register and pay. Right after your payment is confirmed you will see your tickets with QR codes and can download them as a PDF. They stay in "My Tickets" - sign in with the same Google account on any phone to download them again.',
    ],
    [
      'My money was deducted but I did not get a ticket. What now?',
      'Sign in, open "My Tickets", open the booking and tap "I’ve already paid - check status". Payments are confirmed automatically with Razorpay. If it still shows pending after a few minutes, contact us with your registration number.',
    ],
    ['Is my payment secure?', 'Yes. Payments are processed by Razorpay. We never see or store your card or UPI details.'],
  ];

  return (
    <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-16 sm:px-6">
      <h2 className="section-title text-center">Frequently Asked Questions</h2>
      <div className="mt-8 space-y-3">
        {items.map(([q, a]) => (
          <details key={q} className="card group p-0 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 font-medium text-stone-900">
              {q}
              <ChevronDown className="h-5 w-5 shrink-0 text-maroon-600 transition group-open:rotate-180" />
            </summary>
            <p className="px-5 pb-5 text-sm leading-relaxed text-stone-600">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function Contact() {
  const { event } = useConfig();
  return (
    <section id="contact" className="scroll-mt-20 bg-white py-16">
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
        <h2 className="section-title">Contact Us</h2>
        <p className="mt-2 text-stone-600">Questions about tickets or competitions? We're happy to help.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <a href={`tel:${event.contactPhone.replace(/\s/g, '')}`} className="card flex flex-col items-center gap-2 p-5 hover:shadow-md">
            <Phone className="h-6 w-6 text-maroon-600" />
            <span className="text-sm font-semibold">{event.contactPhone}</span>
          </a>
          <a href={`mailto:${event.contactEmail}`} className="card flex flex-col items-center gap-2 p-5 hover:shadow-md">
            <Mail className="h-6 w-6 text-maroon-600" />
            <span className="break-all text-sm font-semibold">{event.contactEmail}</span>
          </a>
          <div className="card flex flex-col items-center gap-2 p-5">
            <User className="h-6 w-6 text-maroon-600" />
            <span className="text-sm font-semibold">{event.organizer}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  const { event } = useConfig();
  return (
    <>
      <Hero />
      <EventDetails />
      <Pricing />
      <Competitions />
      <Sponsors />
      <Faq />
      <Contact />
      {event.registrationOpen && (
        <div className="sticky bottom-0 z-30 border-t border-maroon-100 bg-white/95 p-3 backdrop-blur md:hidden">
          <Link to="/register" className="btn-primary w-full py-3">
            <Ticket className="h-5 w-5" /> Click Here for Registration
          </Link>
        </div>
      )}
    </>
  );
}
