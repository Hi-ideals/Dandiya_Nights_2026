import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const DEFAULT_SPONSORS = [
  'Gudage Hospital',
  'Hi-Fi Family Restaurant',
  'Physics Wallah Bidar',
  'Gurupadappa Nagampalli Speciality Co-operative Hospital',
  'Beldale Foundation',
  'Trishul Brand',
  'Sudama Pohe',
  'Vintage Retreat Resort',
].join(',');

// All event details are configurable through environment variables.
// Defaults follow the official "Team Agni - Bidar Vibes KA38" poster.
export function getEventConfig() {
  const posterPath = path.resolve(serverRoot, process.env.EVENT_POSTER_PATH || 'assets/poster.jpg');

  return {
    name: process.env.EVENT_NAME || 'Dandiya Nights',
    subtitle: process.env.EVENT_SUBTITLE || '& Drawing & Rangoli Competition - on the same day',
    tagline: process.env.EVENT_TAGLINE || 'Come for the culture, stay for the vibes!',
    date: process.env.EVENT_DATE || 'Sunday, 18 October 2026',
    time: process.env.EVENT_TIME || 'Dandiya 5:00 PM - 10:00 PM',
    competitionTime: process.env.EVENT_COMPETITION_TIME || 'Competitions 10:00 AM - 12:00 PM (morning)',
    venue: process.env.EVENT_VENUE || 'Jhira Function Hall, Bidar',
    venueMapUrl: process.env.EVENT_VENUE_MAP_URL || '',
    organizer: process.env.EVENT_ORGANIZER || 'Team Agni - Bidar Vibes KA38',
    contactPhone: process.env.EVENT_CONTACT_PHONE || '+91 90000 00000',
    contactEmail: process.env.EVENT_CONTACT_EMAIL || 'info@example.com',
    competitionTheme: process.env.EVENT_COMPETITION_THEME || 'Devi Mata',
    // Per competition (Drawing and Rangoli each).
    prizes: {
      first: process.env.EVENT_PRIZE_FIRST || '₹3,100',
      second: process.env.EVENT_PRIZE_SECOND || '₹2,100',
    },
    sponsors: (process.env.EVENT_SPONSORS ?? DEFAULT_SPONSORS)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    registrationOpen: (process.env.REGISTRATION_OPEN ?? 'true') !== 'false',
    // PDFKit supports JPEG and PNG posters only.
    posterPath: fs.existsSync(posterPath) ? posterPath : null,
  };
}

export function getPublicEventConfig() {
  const { posterPath, ...publicConfig } = getEventConfig();
  return publicConfig;
}
