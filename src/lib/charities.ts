export interface Charity {
  id: string;
  name: string;
  tagline: string;
  description: string;
  emoji: string;
  ein: string; // IRS 501(c)(3) identifier — shown for legitimacy
  website: string;
}

// All are real US 501(c)(3) organizations, verified 4/4 stars on Charity
// Navigator as of July 2026. Staked is not affiliated with or endorsed by any
// of them; forfeited stakes are donated in a monthly batch (Option A model —
// see docs/escrow-feasibility.md).
export const CHARITIES: Charity[] = [
  {
    id: 'givedirectly',
    name: 'GiveDirectly',
    tagline: 'Cash directly to people in extreme poverty',
    description: 'Sends money straight to the world’s poorest households — no strings attached, rigorously studied.',
    emoji: '💸',
    ein: '27-1661997',
    website: 'givedirectly.org',
  },
  {
    id: 'against-malaria',
    name: 'Against Malaria Foundation',
    tagline: 'Nets that stop a top killer of children',
    description: 'Funds insecticide-treated bed nets, one of the most cost-effective ways to save lives.',
    emoji: '🦟',
    ein: '20-3069841',
    website: 'againstmalaria.com',
  },
  {
    id: 'st-jude',
    name: 'St. Jude Children’s Research Hospital',
    tagline: 'Kids fight cancer; families never get a bill',
    description: 'Treats and studies childhood cancer and other deadly diseases — families pay nothing.',
    emoji: '🎗️',
    ein: '35-1044585',
    website: 'stjude.org',
  },
  {
    id: 'doctors-without-borders',
    name: 'Doctors Without Borders',
    tagline: 'Emergency medicine where it’s needed most',
    description: 'Delivers medical care in conflict zones, epidemics, and disasters in 70+ countries.',
    emoji: '🏥',
    ein: '13-3433452',
    website: 'doctorswithoutborders.org',
  },
  {
    id: 'charity-water',
    name: 'charity: water',
    tagline: 'Clean water for every person on the planet',
    description: 'Funds wells and water systems; 100% of public donations go to water projects.',
    emoji: '💧',
    ein: '22-3936753',
    website: 'charitywater.org',
  },
  {
    id: 'feeding-america',
    name: 'Feeding America',
    tagline: 'Meals for families across the U.S.',
    description: 'The largest U.S. hunger-relief network — food banks serving every county in America.',
    emoji: '🍎',
    ein: '36-3673599',
    website: 'feedingamerica.org',
  },
  {
    id: 'nature-conservancy',
    name: 'The Nature Conservancy',
    tagline: 'Protecting land, water, and climate',
    description: 'Conserves forests, rivers, and oceans in 70+ countries with science-driven projects.',
    emoji: '🌳',
    ein: '53-0242652',
    website: 'nature.org',
  },
];

// Challenges created before the real-charity list shipped reference these ids.
const LEGACY_CHARITY_IDS: Record<string, string> = {
  'clean-water': 'charity-water',
  'food-bank': 'feeding-america',
  reforestation: 'nature-conservancy',
};

export function getCharityById(id: string | null | undefined): Charity | null {
  if (!id) return null;
  const resolvedId = LEGACY_CHARITY_IDS[id] ?? id;
  return CHARITIES.find((c) => c.id === resolvedId) ?? null;
}
