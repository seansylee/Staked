export interface Charity {
  id: string;
  name: string;
  tagline: string;
  description: string;
  emoji: string;
  ein: string; // IRS 501(c)(3) identifier — shown for legitimacy
  website: string;
}

// FEATURED_CHARITIES is the picker list shown when starting a new challenge
// (trimmed to 3 by request). ALL_CHARITIES additionally keeps older, no-longer-
// offered orgs resolvable by id so existing challenges that picked one still
// render correctly instead of showing a blank charity.
//
// Every entry is a real, currently-operating US 501(c)(3) — id, EIN, and
// website independently verified against Charity Navigator / IRS records
// (all 4/4 stars where rated) on 2026-08-05. Staked is not affiliated with or
// endorsed by any of them; forfeited stakes are donated in a monthly batch
// (Option A model — see docs/escrow-feasibility.md).
export const FEATURED_CHARITIES: Charity[] = [
  {
    id: 'givedirectly',
    name: 'GiveDirectly',
    tagline: 'Cash directly to people in extreme poverty',
    description: 'Sends money straight to the world’s poorest households — no strings attached, rigorously studied.',
    emoji: '💸',
    ein: '27-1661997',
    website: 'https://www.givedirectly.org',
  },
  {
    id: 'charity-water',
    name: 'charity: water',
    tagline: 'Clean water for every person on the planet',
    description: 'Funds wells and water systems; 100% of public donations go to water projects.',
    emoji: '💧',
    ein: '22-3936753',
    website: 'https://www.charitywater.org',
  },
  {
    id: 'feeding-america',
    name: 'Feeding America',
    tagline: 'Meals for families across the U.S.',
    description: 'The largest U.S. hunger-relief network — food banks serving every county in America.',
    emoji: '🍎',
    ein: '36-3673599',
    website: 'https://www.feedingamerica.org',
  },
];

// Kept only so getCharityById can still resolve challenges created while these
// were offered in the picker. Not shown to new users.
const RETIRED_CHARITIES: Charity[] = [
  {
    id: 'against-malaria',
    name: 'Against Malaria Foundation',
    tagline: 'Nets that stop a top killer of children',
    description: 'Funds insecticide-treated bed nets, one of the most cost-effective ways to save lives.',
    emoji: '🦟',
    ein: '20-3069841',
    website: 'https://www.againstmalaria.com',
  },
  {
    id: 'st-jude',
    name: 'St. Jude Children’s Research Hospital',
    tagline: 'Kids fight cancer; families never get a bill',
    description: 'Treats and studies childhood cancer and other deadly diseases — families pay nothing.',
    emoji: '🎗️',
    ein: '35-1044585',
    website: 'https://www.stjude.org',
  },
  {
    id: 'doctors-without-borders',
    name: 'Doctors Without Borders',
    tagline: 'Emergency medicine where it’s needed most',
    description: 'Delivers medical care in conflict zones, epidemics, and disasters in 70+ countries.',
    emoji: '🏥',
    ein: '13-3433452',
    website: 'https://www.doctorswithoutborders.org',
  },
  {
    id: 'nature-conservancy',
    name: 'The Nature Conservancy',
    tagline: 'Protecting land, water, and climate',
    description: 'Conserves forests, rivers, and oceans in 70+ countries with science-driven projects.',
    emoji: '🌳',
    ein: '53-0242652',
    website: 'https://www.nature.org',
  },
];

const ALL_CHARITIES: Charity[] = [...FEATURED_CHARITIES, ...RETIRED_CHARITIES];

// Challenges created before the real-charity list shipped reference these ids.
const LEGACY_CHARITY_IDS: Record<string, string> = {
  'clean-water': 'charity-water',
  'food-bank': 'feeding-america',
  reforestation: 'nature-conservancy',
};

export function getCharityById(id: string | null | undefined): Charity | null {
  if (!id) return null;
  const resolvedId = LEGACY_CHARITY_IDS[id] ?? id;
  return ALL_CHARITIES.find((c) => c.id === resolvedId) ?? null;
}
