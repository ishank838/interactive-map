/** Deep mining deposits roll one of these ores per world. */
export const DEEP_ORES = [
  { id: 'aluminium', title: 'Aluminium' },
  { id: 'coal', title: 'Coal' },
  { id: 'copper', title: 'Copper' },
  { id: 'gold', title: 'Gold' },
  { id: 'iron', title: 'Iron' },
  { id: 'oxite', title: 'Oxite' },
  { id: 'platinum', title: 'Platinum' },
  { id: 'sulfur', title: 'Sulfur' },
  { id: 'titanium', title: 'Titanium' },
] as const

export type DeepOreId = (typeof DEEP_ORES)[number]['id']

export const DEEP_MINING_ICON = 'deep_mining_deposit'

const oreIds = new Set<string>(DEEP_ORES.map((ore) => ore.id))

export function isDeepOreId(value: string): value is DeepOreId {
  return oreIds.has(value)
}

export function oreTitle(oreId: string | undefined): string | null {
  if (!oreId) return null
  return DEEP_ORES.find((ore) => ore.id === oreId)?.title ?? null
}

export function isDeepMiningCategory(category: { icon: string } | undefined): boolean {
  return category?.icon === DEEP_MINING_ICON
}
