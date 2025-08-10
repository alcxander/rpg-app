/**
 * Price and catalog helpers for shop generation.
 * Prices are representative and can be adjusted as needed.
 * Final price is clamped to +/- 5% of base price at generation time.
 */

export type Rarity = "common" | "uncommon" | "rare" | "wondrous" | "legendary"
export type ShopType = "potion" | "arcana" | "blacksmith" | "general" | "custom"

export type CatalogItem = {
  name: string
  rarity: Rarity
  basePrice: number // in gp
}

/** +/- 5% clamp applied randomly */
export function clampTo5Percent(base: number): { pct: number; final: number } {
  const sign = Math.random() < 0.5 ? -1 : 1
  const pctAbs = Math.floor(Math.random() * 6) // 0-5
  const pct = sign * pctAbs
  const final = Math.max(0, Math.round((base * (100 + pct)) / 100))
  return { pct, final }
}

/**
 * Catalogs per shop type.
 * Bias toward common/uncommon with rare/wondrous appearing, legendary very rare.
 */
const POTION_CATALOG: CatalogItem[] = [
  { name: "Potion of Healing", rarity: "common", basePrice: 50 },
  { name: "Potion of Greater Healing", rarity: "uncommon", basePrice: 150 },
  { name: "Potion of Superior Healing", rarity: "rare", basePrice: 450 },
  { name: "Potion of Supreme Healing", rarity: "wondrous", basePrice: 1350 },
  { name: "Potion of Climbing", rarity: "common", basePrice: 30 },
  { name: "Potion of Invisibility", rarity: "wondrous", basePrice: 2500 },
  { name: "Potion of Heroism", rarity: "rare", basePrice: 1200 },
  { name: "Antitoxin", rarity: "common", basePrice: 50 },
  { name: "Potion of Speed", rarity: "wondrous", basePrice: 3000 },
  { name: "Elixir of Health", rarity: "rare", basePrice: 500 },
]

const ARCANA_CATALOG: CatalogItem[] = [
  { name: "Spell Scroll (Cantrip)", rarity: "common", basePrice: 25 },
  { name: "Spell Scroll (1st level)", rarity: "common", basePrice: 50 },
  { name: "Spell Scroll (2nd level)", rarity: "uncommon", basePrice: 150 },
  { name: "Spell Scroll (3rd level)", rarity: "uncommon", basePrice: 300 },
  { name: "Spell Scroll (4th level)", rarity: "rare", basePrice: 750 },
  { name: "Spell Scroll (5th level)", rarity: "rare", basePrice: 1350 },
  { name: "Pearl of Power", rarity: "rare", basePrice: 1000 },
  { name: "Wand of the War Mage +1", rarity: "uncommon", basePrice: 300 },
  { name: "Wand of Magic Detection", rarity: "uncommon", basePrice: 250 },
  { name: "Ring of Spell Storing", rarity: "wondrous", basePrice: 5000 },
]

const BLACKSMITH_CATALOG: CatalogItem[] = [
  { name: "Dagger", rarity: "common", basePrice: 2 },
  { name: "Shortsword", rarity: "common", basePrice: 10 },
  { name: "Longsword", rarity: "common", basePrice: 15 },
  { name: "Greatsword", rarity: "uncommon", basePrice: 50 },
  { name: "Rapier", rarity: "uncommon", basePrice: 25 },
  { name: "Shield", rarity: "common", basePrice: 10 },
  { name: "Chain Shirt", rarity: "uncommon", basePrice: 50 },
  { name: "+1 Weapon (certificate)", rarity: "rare", basePrice: 1500 },
  { name: "+1 Shield (certificate)", rarity: "rare", basePrice: 1500 },
  { name: "Repair Service", rarity: "common", basePrice: 5 },
]

const GENERAL_CATALOG: CatalogItem[] = [
  { name: "Rations (1 day)", rarity: "common", basePrice: 0.5 },
  { name: "Rope (50 feet)", rarity: "common", basePrice: 1 },
  { name: "Torch", rarity: "common", basePrice: 0.01 },
  { name: "Lantern", rarity: "common", basePrice: 5 },
  { name: "Healer’s Kit", rarity: "uncommon", basePrice: 5 },
  { name: "Clothes, Traveler’s", rarity: "common", basePrice: 2 },
  { name: "Backpack", rarity: "common", basePrice: 2 },
  { name: "Lock", rarity: "uncommon", basePrice: 10 },
  { name: "Spyglass", rarity: "wondrous", basePrice: 1000 },
  { name: "Tent, Two-Person", rarity: "uncommon", basePrice: 2 },
]

export function pickCatalog(type: ShopType): CatalogItem[] {
  switch (type) {
    case "potion":
      return POTION_CATALOG
    case "arcana":
      return ARCANA_CATALOG
    case "blacksmith":
      return BLACKSMITH_CATALOG
    case "general":
      return GENERAL_CATALOG
    default:
      return GENERAL_CATALOG
  }
}
