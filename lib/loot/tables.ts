// Minimal loot tables scaffold. Update these with your own data or external links.
// You can replace entries with links to resources you maintain (e.g., 5e.tools book sections).

export type Rarity = 'Common' | 'Uncommon' | 'Rare' | 'Very Rare' | 'Legendary'
export type LootItem =
  | { type: 'coin'; amount: number; currency: 'cp' | 'sp' | 'gp' | 'pp' }
  | { type: 'trinket'; name: string }
  | { type: 'gear'; name: string; rarity?: Rarity }
  | { type: 'consumable'; name: string; rarity?: Rarity }

export type LootRollInput = {
  cr?: 'Easy' | 'Medium' | 'Hard' | 'Deadly'
  partyLevel?: number
  partyLoot?: boolean
  exactLevel?: boolean
}

const coinByCR: Record<NonNullable<LootRollInput['cr']>, { min: number; max: number }> = {
  Easy: { min: 10, max: 50 },
  Medium: { min: 50, max: 150 },
  Hard: { min: 150, max: 400 },
  Deadly: { min: 400, max: 1200 },
}

const trinkets: string[] = [
  'Clockwork beetle that ticks softly',
  'Shard of obsidian warm to the touch',
  'Silver ring etched with constellations',
  'Glass vial of ever-swirling mist',
  'Tiny idol carved from bone',
]

const consumables: { name: string; rarity: Rarity }[] = [
  { name: 'Potion of Healing', rarity: 'Common' },
  { name: 'Potion of Greater Healing', rarity: 'Uncommon' },
  { name: 'Oil of Slipperiness', rarity: 'Uncommon' },
  { name: 'Elixir of Health', rarity: 'Rare' },
]

const gear: { name: string; rarity: Rarity }[] = [
  { name: '+1 Weapon', rarity: 'Uncommon' },
  { name: '+1 Shield', rarity: 'Uncommon' },
  { name: 'Boots of Elvenkind', rarity: 'Uncommon' },
  { name: 'Cloak of Protection', rarity: 'Uncommon' },
  { name: 'Ring of Protection', rarity: 'Rare' },
]

// Reference slots: update these strings to point to your table sources
export const tableReferences = [
  'Xanathar’s Guide to Everything, pp. 135–136',
  'https://5e.tools/book.html#XGE,2,awarding%20magic%20items,0',
  'https://5e.tools/book.html#XDMG,6,random%20magic%20items,0',
  'https://5e.tools/book.html#XDMG,6,arcana%20tables,0',
  'https://5e.tools/book.html#XDMG,6,implements%20tables,0',
]

const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]

export function rollLootTables(input: LootRollInput): LootItem[] {
  const crBand = input.cr || 'Medium'
  const coins = coinByCR[crBand]
  const amount = rand(coins.min, coins.max)
  const gold: LootItem = { type: 'coin', amount, currency: 'gp' }

  // scale by party level a touch
  const level = input.partyLevel || 3
  const bonusTrinkets = level >= 5 ? 1 : 0
  const bonusGear = level >= 9 ? 1 : 0

  const out: LootItem[] = [gold]
  const tCount = 1 + bonusTrinkets
  for (let i = 0; i < tCount; i++) out.push({ type: 'trinket', name: pick(trinkets) })

  // Consumable at Medium+ CR
  if (['Medium', 'Hard', 'Deadly'].includes(crBand)) {
    out.push({ type: 'consumable', ...pick(consumables) })
  }

  // Gear at Hard+
  if (['Hard', 'Deadly'].includes(crBand)) {
    for (let i = 0; i < 1 + bonusGear; i++) out.push({ type: 'gear', ...pick(gear) })
  }

  return out
}
