export interface Charity {
  id: string;
  name: string;
  tagline: string;
  description: string;
  emoji: string;
}

export const CHARITIES: Charity[] = [
  {
    id: 'clean-water',
    name: 'Clean Water Fund',
    tagline: 'Safe drinking water worldwide',
    description: 'Builds wells and water systems for communities without reliable access to clean water.',
    emoji: '💧',
  },
  {
    id: 'food-bank',
    name: 'Community Food Bank',
    tagline: 'Meals for families in need',
    description: 'Distributes groceries and hot meals to households facing food insecurity.',
    emoji: '🍎',
  },
  {
    id: 'reforestation',
    name: 'Reforestation Project',
    tagline: 'Planting trees to fight climate change',
    description: 'Restores forests and captures carbon by planting native trees around the globe.',
    emoji: '🌳',
  },
];

export function getCharityById(id: string | null | undefined): Charity | null {
  return CHARITIES.find((c) => c.id === id) ?? null;
}
