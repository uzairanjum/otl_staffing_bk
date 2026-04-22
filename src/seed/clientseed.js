'use strict';

const Client = require('../modules/client/Client');
const Job = require('../modules/job/Job');
const User = require('../common/models/User');
const logger = require('../config/logger');

const SEED_REP_PASSWORD = 'admin@123';

function hexToRgb(hex) {
  const x = String(hex).replace('#', '').trim();
  if (x.length !== 6) return { r: 100, g: 100, b: 100 };
  return {
    r: parseInt(x.slice(0, 2), 16),
    g: parseInt(x.slice(2, 4), 16),
    b: parseInt(x.slice(4, 6), 16),
  };
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h;
  const l = (max + min) / 2;
  let s;
  if (max === min) {
    h = 0;
    s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return { h: h * 360, s, l };
}

function hslToRgb(h, s, l) {
  let hh = ((h % 360) + 360) % 360;
  hh /= 360;
  let r;
  let g;
  let b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      let tt = t;
      if (tt < 0) tt += 1;
      if (tt > 1) tt -= 1;
      if (tt < 1 / 6) return p + (q - p) * 6 * tt;
      if (tt < 1 / 2) return q;
      if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, hh + 1 / 3);
    g = hue2rgb(p, q, hh);
    b = hue2rgb(p, q, hh - 1 / 3);
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

function rgbToHex(r, g, b) {
  const clamp = (n) => Math.max(0, Math.min(255, n));
  const x = (n) => clamp(n).toString(16).padStart(2, '0');
  return `#${x(r)}${x(g)}${x(b)}`;
}

/** Blend rgb toward white (simulates ~50% opacity on white) → opaque hex. */
function blendRgbWithWhite(r, g, b, clientWeight) {
  const w = 1 - clientWeight;
  return {
    r: Math.round(r * clientWeight + 255 * w),
    g: Math.round(g * clientWeight + 255 * w),
    b: Math.round(b * clientWeight + 255 * w),
  };
}

/**
 * Each job gets a distinct hex: hue stepped from client brand, then 50/50 blend with white (soft tint).
 * @param {string} clientHex
 * @param {number} jobIndex 0..n-1
 * @param {number} totalJobs
 */
function jobColorFromClient(clientHex, jobIndex, totalJobs) {
  const { r, g, b } = hexToRgb(clientHex);
  const hsl = rgbToHsl(r, g, b);
  const step = 360 / Math.max(totalJobs, 1);
  const nh = (hsl.h + step * jobIndex) % 360;
  const ns = Math.min(0.95, Math.max(0.5, hsl.s * 0.98 + 0.02));
  const nl = Math.min(0.52, Math.max(0.36, hsl.l));
  const out = hslToRgb(nh, ns, nl);
  const blended = blendRgbWithWhite(out.r, out.g, out.b, 0.5);
  return rgbToHex(blended.r, blended.g, blended.b);
}

/**
 * Twelve rich demo clients: strong brand colors, multiple reps, multiple jobs per client.
 * Idempotent: keyed by `seed.client.{idx}@otlstaffing.local`.
 */
const CLIENT_BLUEPRINTS = [
  {
    idx: 1,
    name: 'Grand Plaza Hospitality Group',
    organization: 'Grand Plaza Holdings LLC',
    phone: '+1 (212) 555-0101',
    address: '450 Lexington Avenue, New York, NY 10017, USA',
    notes:
      'Flagship urban hospitality partner. Prefers 48-hour notice for large events. Primary billing contact is AP shared inbox.',
    website: 'https://grandplaza-hospitality.example.com',
    color: '#B91C1C',
    representatives: [
      { first_name: 'James', last_name: 'Morrison', role: 'Director of Operations', phone: '+1 (212) 555-0111' },
      { first_name: 'Elena', last_name: 'Vasquez', role: 'Event Sales Lead', phone: '+1 (212) 555-0112' },
      { first_name: 'Marcus', last_name: 'Chen', role: 'Venue Security Liaison', phone: '+1 (212) 555-0113' },
    ],
    jobs: [
      { name: 'Grand Plaza — Banquets & Galas', description: 'High-volume plated service and bar for ballrooms up to 800 guests.', location: 'Midtown East — Lexington Ballroom' },
      { name: 'Grand Plaza — Rooftop Lounge', description: 'Evening cocktail service Thu–Sat; craft bar program.', location: '42nd Floor — Skyline Lounge' },
      { name: 'Grand Plaza — In-Room Dining', description: 'Overnight room service coordination with kitchen.', location: 'Tower A & B guest floors' },
    ],
  },
  {
    idx: 2,
    name: 'Harborline Catering Collective',
    organization: 'Harborline Food Co-op',
    phone: '+1 (617) 555-0202',
    address: '88 Atlantic Wharf, Boston, MA 02210, USA',
    notes: 'Waterfront events specialist. Dock access for vendor trucks Gate C only.',
    website: 'https://harborline-catering.example.com',
    color: '#0369A1',
    representatives: [
      { first_name: 'Olivia', last_name: 'Brooks', role: 'Executive Chef Partner', phone: '+1 (617) 555-0221' },
      { first_name: 'Noah', last_name: 'Patel', role: 'Logistics Coordinator', phone: '+1 (617) 555-0222' },
    ],
    jobs: [
      { name: 'Harborline — Corporate Lunches', description: 'Weekday drop-off and staffed buffets for Seaport offices.', location: 'Seaport District — rotating sites' },
      { name: 'Harborline — Wedding Season', description: 'Full-service weddings May–October; includes tent crew.', location: 'Atlantic Wharf Pier Pavilion' },
      { name: 'Harborline — Film & TV Craft', description: 'On-set catering; union meal rules apply.', location: 'Greater Boston mobile' },
      { name: 'Harborline — Holiday Retail Pop-Ups', description: 'Mall kiosk staffing and sampling.', location: 'CambridgeSide + Prudential Center' },
    ],
  },
  {
    idx: 3,
    name: 'Summit Ridge Conference Centers',
    organization: 'Summit Ridge Education Trust',
    phone: '+1 (303) 555-0303',
    address: '1900 Blake Street, Denver, CO 80202, USA',
    notes: 'Tech and pharma offsites. AV vendor is in-house; staffing must badge 24h ahead.',
    website: 'https://summitridge-events.example.com',
    color: '#047857',
    representatives: [
      { first_name: 'Rachel', last_name: 'Nguyen', role: 'Client Success Manager', phone: '+1 (303) 555-0331' },
      { first_name: 'Daniel', last_name: 'Okonkwo', role: 'Facilities Manager', phone: '+1 (303) 555-0332' },
      { first_name: 'Kim', last_name: 'Sato', role: 'Registration & Badge Desk', phone: '+1 (303) 555-0333' },
    ],
    jobs: [
      { name: 'Summit Ridge — Executive Retreats', description: 'Multi-day leadership programs; breakout rooms and hikes.', location: 'Denver Blake Campus' },
      { name: 'Summit Ridge — Hybrid Broadcast', description: 'Stagehands and runners for livestream studios.', location: 'Studio B + C' },
    ],
  },
  {
    idx: 4,
    name: 'Velvet Room Entertainment',
    organization: 'Velvet Room LLC',
    phone: '+1 (323) 555-0404',
    address: '6801 Hollywood Boulevard, Los Angeles, CA 90028, USA',
    notes: 'Nightlife and private members clubs. Dress code strictly enforced for all staff.',
    website: 'https://velvetroom-la.example.com',
    color: '#A21CAF',
    representatives: [
      { first_name: 'Tasha', last_name: 'Williams', role: 'VIP Host Manager', phone: '+1 (323) 555-0441' },
      { first_name: 'Diego', last_name: 'Flores', role: 'Bar Program Director', phone: '+1 (323) 555-0442' },
    ],
    jobs: [
      { name: 'Velvet Room — Main Club Floor', description: 'Thu–Sat late shifts; bottle service and coat check.', location: 'Hollywood — Main venue' },
      { name: 'Velvet Room — Private Members Lounge', description: 'Invitation-only floor; discreet service.', location: 'Rooftop annex' },
      { name: 'Velvet Room — Pop-Up Warehouse Parties', description: 'Quarterly one-off events; security-heavy.', location: 'Arts District rotating warehouses' },
    ],
  },
  {
    idx: 5,
    name: 'Ironwood Stadium Services',
    organization: 'Ironwood Sports Management Inc.',
    phone: '+1 (312) 555-0505',
    address: '1060 W Addison Street, Chicago, IL 60613, USA',
    notes: 'Concourse concessions and premium suites. Union window for certain roles.',
    website: 'https://ironwood-stadium.example.com',
    color: '#C2410C',
    representatives: [
      { first_name: 'Chris', last_name: "O'Brien", role: 'Concessions Supervisor', phone: '+1 (312) 555-0551' },
      { first_name: 'Aisha', last_name: 'Khan', role: 'Suite Hospitality Lead', phone: '+1 (312) 555-0552' },
      { first_name: 'Tyler', last_name: 'Berg', role: 'Crowd Control Coordinator', phone: '+1 (312) 555-0553' },
    ],
    jobs: [
      { name: 'Ironwood — MLB Home Stand', description: 'Game-day staffing Apr–Sep; includes rain-delay holds.', location: 'Wrigleyville ballpark zone' },
      { name: 'Ironwood — Concert Load-In', description: 'Arena shows; union stewards on call.', location: 'United Center satellite lots' },
      { name: 'Ironwood — College Bowl Week', description: 'Short-term surge hiring; 12-hour shifts.', location: 'Soldier Field north campus' },
      { name: 'Ironwood — Marathon Finish Village', description: 'Annual city marathon hydration and medical tent support.', location: 'Grant Park finish line' },
    ],
  },
  {
    idx: 6,
    name: 'Coral Bay Resorts & Spas',
    organization: 'Coral Bay International',
    phone: '+1 (305) 555-0606',
    address: '4441 Collins Avenue, Miami Beach, FL 33140, USA',
    notes: 'Beachfront properties. Bilingual English/Spanish preferred for guest-facing roles.',
    website: 'https://coralbay-resorts.example.com',
    color: '#0D9488',
    representatives: [
      { first_name: 'Isabella', last_name: 'Ruiz', role: 'Guest Experience Director', phone: '+1 (305) 555-0661' },
      { first_name: 'Liam', last_name: "O'Connell", role: 'Pool & Beach Operations', phone: '+1 (305) 555-0662' },
    ],
    jobs: [
      { name: 'Coral Bay — Main Tower F&B', description: 'All-day dining, pool bar, and minibreakfast.', location: 'Miami Beach — Tower One' },
      { name: 'Coral Bay — Spa & Wellness Weekends', description: 'Detox retreats; light catering and juice bar.', location: 'Spa annex' },
      { name: 'Coral Bay — Destination Weddings', description: 'Beach ceremonies up to 200 guests.', location: 'Private beach north cove' },
    ],
  },
  {
    idx: 7,
    name: 'MetroArts Pavilion',
    organization: 'MetroArts Nonprofit',
    phone: '+1 (215) 555-0707',
    address: '300 S Broad Street, Philadelphia, PA 19102, USA',
    notes: 'Performing arts and galas. Volunteer ushers separate contract; OTL handles paid bar only.',
    website: 'https://metroarts-pavilion.example.com',
    color: '#C026D3',
    representatives: [
      { first_name: 'Priya', last_name: 'Shah', role: 'Development Events Manager', phone: '+1 (215) 555-0771' },
      { first_name: 'Greg', last_name: 'Wallace', role: 'House Manager', phone: '+1 (215) 555-0772' },
      { first_name: 'Nina', last_name: 'Kowalski', role: 'Box Office Liaison', phone: '+1 (215) 555-0773' },
    ],
    jobs: [
      { name: 'MetroArts — Opening Night Receptions', description: "Champagne service and passed hors d'oeuvres.", location: 'Grand Tier lobby' },
      { name: 'MetroArts — Youth Program Snacks', description: 'Weekend matinee family concessions.', location: 'Education wing café' },
    ],
  },
  {
    idx: 8,
    name: 'Pacific Northwest Brew Hall',
    organization: 'PNW Brew Hall Co.',
    phone: '+1 (206) 555-0808',
    address: '1424 Western Avenue, Seattle, WA 98101, USA',
    notes: 'Taproom and festival tap takeover events. TIPS and food-handler certs required.',
    website: 'https://pnw-brewhall.example.com',
    color: '#1D4ED8',
    representatives: [
      { first_name: 'Jordan', last_name: 'Lee', role: 'Taproom GM', phone: '+1 (206) 555-0881' },
      { first_name: 'Sam', last_name: 'Rivera', role: 'Events & Festivals', phone: '+1 (206) 555-0882' },
    ],
    jobs: [
      { name: 'PNW Brew Hall — Daily Taproom', description: 'Line cooks, bar, and dish on rotating shifts.', location: 'Waterfront taproom' },
      { name: 'PNW Brew Hall — Summer Beer Garden', description: 'Outdoor service Apr–Sep.', location: 'Pier 62 extension' },
      { name: 'PNW Brew Hall — Brewers’ Invitational', description: 'Annual 3-day festival; 40+ booths.', location: 'Gas Works Park' },
      { name: 'PNW Brew Hall — Corporate Tap Takeovers', description: 'Private buyouts Tue/Wed evenings.', location: 'Western Ave main hall' },
    ],
  },
  {
    idx: 9,
    name: 'Sunbelt Arena Complex',
    organization: 'Sunbelt Venues LP',
    phone: '+1 (615) 555-0909',
    address: '501 Broadway, Nashville, TN 37203, USA',
    notes: 'Country music residencies and sports. Parking marshals coordinated separately.',
    website: 'https://sunbelt-arena.example.com',
    color: '#CA8A04',
    representatives: [
      { first_name: 'Hannah', last_name: 'McCoy', role: 'Premium Seating Manager', phone: '+1 (615) 555-0991' },
      { first_name: 'Jake', last_name: 'Turner', role: 'Backstage Catering Lead', phone: '+1 (615) 555-0992' },
      { first_name: 'Monica', last_name: 'Diaz', role: 'Vendor Credentialing', phone: '+1 (615) 555-0993' },
    ],
    jobs: [
      { name: 'Sunbelt — Residency Rider Catering', description: 'Artist green rooms and crew meals.', location: 'Arena backstage complex' },
      { name: 'Sunbelt — Rodeo & Fair Week', description: '10-day fair; corn dogs to VIP steak.', location: 'Exhibition Hall + midway' },
    ],
  },
  {
    idx: 10,
    name: 'Rosewood Private Dining Club',
    organization: 'Rosewood Members Association',
    phone: '+1 (415) 555-1010',
    address: '690 Market Street, San Francisco, CA 94104, USA',
    notes: 'Members-only. NDAs for all staff; background checks Level 2.',
    website: 'https://rosewood-private.example.com',
    color: '#BE185D',
    representatives: [
      { first_name: 'Victoria', last_name: 'Ashford', role: 'Membership Director', phone: '+1 (415) 555-1011' },
      { first_name: 'Henry', last_name: 'Duval', role: 'Maître d’', phone: '+1 (415) 555-1012' },
    ],
    jobs: [
      { name: 'Rosewood — Chef’s Table Series', description: '12-seat tasting menu; wine pairings.', location: 'Market Street — private kitchen' },
      { name: 'Rosewood — Board Lunch Program', description: 'Weekday private rooms for directors.', location: 'Floors 4–6 club rooms' },
      { name: 'Rosewood — New Year’s Eve Gala', description: 'Annual black-tie; coat check and caviar station.', location: 'Grand ballroom' },
    ],
  },
  {
    idx: 11,
    name: 'Lakeside University Auxiliary',
    organization: 'State Board of Regents',
    phone: '+1 (608) 555-1111',
    address: '800 Langdon Street, Madison, WI 53706, USA',
    notes: 'Athletics and commencement. Student workers mixed with OTL agency fill.',
    website: 'https://lakeside-aux.example.com',
    color: '#15803D',
    representatives: [
      { first_name: 'Dr. Patricia', last_name: 'Lund', role: 'Auxiliary Services VP', phone: '+1 (608) 555-1119' },
      { first_name: 'Kevin', last_name: 'Hart', role: 'Athletics Operations', phone: '+1 (608) 555-1118' },
      { first_name: 'Sofia', last_name: 'Martens', role: 'Commencement Coordinator', phone: '+1 (608) 555-1117' },
    ],
    jobs: [
      { name: 'Lakeside — Football Saturdays', description: 'Concessions and suites; 7 home games.', location: 'Camp Randall Stadium' },
      { name: 'Lakeside — Spring Commencement', description: 'Three ceremonies; chair setup and VIP tea.', location: 'Kohl Center + Field House' },
      { name: 'Lakeside — Summer Conference Housing', description: 'Dormitory desk and dining hall.', location: 'Lakeshore residence halls' },
      { name: 'Lakeside — Alumni Weekend', description: 'Tented brunch and evening gala.', location: 'Memorial Union Terrace' },
    ],
  },
  {
    idx: 12,
    name: 'Aurora Flight Catering & Lounges',
    organization: 'Aurora Aviation Services',
    phone: '+1 (404) 555-1212',
    address: '6000 N Terminal Parkway, Atlanta, GA 30320, USA',
    notes: 'Airside badges; badging lead time 10 business days. TSA rules strictly enforced.',
    website: 'https://aurora-flight-catering.example.com',
    color: '#7C3AED',
    representatives: [
      { first_name: 'Andre', last_name: 'Washington', role: 'Airside Operations Manager', phone: '+1 (404) 555-1221' },
      { first_name: 'Mei', last_name: 'Lin', role: 'Lounge Experience Lead', phone: '+1 (404) 555-1222' },
    ],
    jobs: [
      { name: 'Aurora — Concourse B Lounges', description: 'Premium lounge buffets and bar.', location: 'ATL Concourse B' },
      { name: 'Aurora — Red-Eye Bank', description: 'Overnight flight meal assembly.', location: 'Catering commissary Building 7' },
      { name: 'Aurora — Charter & VIP FBO', description: 'Private jet galley loading.', location: 'Signature Flight Support — ATL' },
    ],
  },
];

/**
 * @param {{ company: import('mongoose').Document }} opts
 */
async function seedDemoClients({ company }) {
  const companyId = company._id;
  let clientsCreated = 0;
  let clientsSkipped = 0;
  let repsCreated = 0;
  let jobsCreated = 0;

  for (const bp of CLIENT_BLUEPRINTS) {
    const email = `seed.client.${String(bp.idx).padStart(2, '0')}@otlstaffing.local`;
    let client = await Client.findOne({ company_id: companyId, email });

    if (!client) {
      client = await Client.create({
        company_id: companyId,
        name: bp.name,
        email,
        phone: bp.phone,
        organization: bp.organization,
        address: bp.address,
        notes: bp.notes,
        color: bp.color,
        website: bp.website,
        status: 'active',
      });
      clientsCreated += 1;
      logger.info('Seed client created', { name: bp.name, email });
    } else {
      clientsSkipped += 1;
      logger.info('Seed client already exists', { email });
    }

    let r = 0;
    for (const rep of bp.representatives) {
      r += 1;
      const repEmail = `rep_${String(bp.idx).padStart(2, '0')}_${String(r).padStart(2, '0')}@otlstaffing.dev`;
      const existsRep = await User.findOne({ company_id: companyId, email: repEmail });
      if (existsRep) continue;

      await User.create({
        client_id: client._id,
        company_id: companyId,
        name: `${rep.first_name} ${rep.last_name}`.trim(),
        first_name: rep.first_name,
        last_name: rep.last_name,
        email: repEmail,
        phone: rep.phone,
        address: bp.address,
        representativerole: rep.role,
        password_hash: SEED_REP_PASSWORD,
        status: 'active',
        role: 'client_rep',
        first_login: true,
        is_active: true,
      });
      repsCreated += 1;
      logger.info('Seed client rep created', { client: bp.name, email: repEmail });
    }

    const totalJobs = bp.jobs.length;
    let j = 0;
    for (const job of bp.jobs) {
      const jobColor = jobColorFromClient(bp.color, j, totalJobs);
      j += 1;
      const dup = await Job.findOne({
        company_id: companyId,
        client_id: client._id,
        name: job.name,
      });
      if (dup) continue;

      await Job.create({
        company_id: companyId,
        client_id: client._id,
        name: job.name,
        description: job.description,
        location: job.location,
        color: jobColor,
        status: 'active',
      });
      jobsCreated += 1;
    }
  }

  logger.info('Client seed summary', {
    clientsCreated,
    clientsSkipped,
    representativesCreated: repsCreated,
    jobsCreated,
    totalClientBlueprints: CLIENT_BLUEPRINTS.length,
    repPassword: SEED_REP_PASSWORD,
    jobColorNote: 'Each job #RRGGBB hex: hue stepped from client, 50/50 blend with white',
  });

  return { clientsCreated, clientsSkipped, repsCreated, jobsCreated };
}

module.exports = {
  seedDemoClients,
};
