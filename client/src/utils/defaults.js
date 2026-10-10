/**
 * Shown only until /api/config loads (or if the API is unreachable) so the landing
 * page always renders. The server's values are authoritative.
 */
export const DEFAULT_CONFIG = {
  event: {
    name: 'Dandiya Nights',
    subtitle: '& Drawing & Rangoli Competition - on the same day',
    tagline: 'Come for the culture, stay for the vibes!',
    date: 'Sunday, 18 October 2026',
    time: 'Dandiya 5:00 PM - 10:00 PM',
    competitionTime: 'Competitions 10:00 AM - 12:00 PM (morning)',
    venue: 'Jhira Function Hall, Bidar',
    venueMapUrl: '',
    organizer: 'Team Agni - Bidar Vibes KA38',
    contactPhone: '+91 63625 82268',
    contactEmail: 'arthotthana@gmail.com',
    competitionTheme: 'Devi Mata',
    prizes: { first: '₹3,100', second: '₹2,100' },
    sponsors: [
      'Gudage Hospital',
      'Hi-Fi Family Restaurant',
      'Physics Wallah Bidar',
      'Gurupadappa Nagampalli Speciality Co-operative Hospital',
      'Beldale Foundation',
      'Trishul Brand',
      'Sudama Pohe',
      'Vintage Retreat Resort',
      'Hi-Ideals Technologies Pvt. Ltd.',
    ],
    registrationOpen: true,
  },
  pricing: {
    version: '2026-v2',
    currency: 'INR',
    maxTicketsPerBooking: 7,
    competitionChargeMode: 'per_registration',
    categories: {
      couple: { label: 'Couple', basePaise: 49900, platformFeePaise: 3100 },
      single: { label: 'Single', basePaise: 19900, platformFeePaise: 2100 },
    },
    competitions: {
      rangoli: { label: 'Rangoli Competition', basePaise: 9900, platformFeePaise: 1100 },
      drawing: { label: 'Drawing Competition', basePaise: 9900, platformFeePaise: 1100 },
    },
  },
};
