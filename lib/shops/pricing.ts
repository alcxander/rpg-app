/**
 * Pricing catalog and helpers for shop generation.
 * - Keeps items aligned to D&D-ish price bands.
 * - Applies a locked-in ±5% variance at generation time.
 */

export type Rarity = "common" | "uncommon" | "rare" | "wondrous" | "legendary"
export type ShopType = "potion" | "arcana" | "blacksmith" | "general" | "custom"

export type CatalogItem = {
  name: string
  rarity: Rarity
  basePrice: number // in gp
}

const POTION_CATALOG: CatalogItem[] = [
  { name: "Potion of Healing", rarity: "common", basePrice: 50 },
  { name: "Potion of Greater Healing", rarity: "uncommon", basePrice: 100 },
  { name: "Potion of Superior Healing", rarity: "rare", basePrice: 500 },
  { name: "Potion of Supreme Healing", rarity: "wondrous", basePrice: 5000 },
  { name: "Potion of Climbing", rarity: "common", basePrice: 30 },
  { name: "Potion of Invisibility", rarity: "rare", basePrice: 2500 },
  { name: "Potion of Fire Breath", rarity: "uncommon", basePrice: 150 },
  { name: "Antitoxin (vial)", rarity: "common", basePrice: 50 },
]

const ARCANA_CATALOG: CatalogItem[] = [
  { name: "Spell Scroll (Cantrip)", rarity: "common", basePrice: 25 },
  { name: "Spell Scroll (Level 1)", rarity: "common", basePrice: 50 },
  { name: "Spell Scroll (Level 2)", rarity: "uncommon", basePrice: 100 },
  { name: "Spell Scroll (Level 3)", rarity: "uncommon", basePrice: 250 },
  { name: "Spell Scroll (Level 4)", rarity: "rare", basePrice: 500 },
  { name: "Wand of Magic Detection", rarity: "uncommon", basePrice: 500 },
  { name: "Pearl of Power", rarity: "rare", basePrice: 5000 },
  { name: "Bag of Holding", rarity: "wondrous", basePrice: 4000 },
]

const BLACKSMITH_CATALOG: CatalogItem[] = [
  { name: "Dagger", rarity: "common", basePrice: 2 },
  { name: "Longsword", rarity: "common", basePrice: 15 },
  { name: "Greatsword", rarity: "uncommon", basePrice: 50 },
  { name: "Shield", rarity: "common", basePrice: 10 },
  { name: "Chain Mail", rarity: "uncommon", basePrice: 75 },
  { name: "Breastplate", rarity: "rare", basePrice: 400 },
  { name: "Plate Armor", rarity: "wondrous", basePrice: 1500 },
  { name: "Repair Service (per weapon)", rarity: "common", basePrice: 5 },
]

const GENERAL_CATALOG: CatalogItem[] = [
  { name: "Rations (1 day)", rarity: "common", basePrice: 0.5 },
  { name: "Rope (50 feet)", rarity: "common", basePrice: 1 },
  { name: "Torch", rarity: "common", basePrice: 0.01 },
  { name: "Healer's Kit", rarity: "uncommon", basePrice: 5 },
  { name: "Clothes, Traveler's", rarity: "common", basePrice: 2 },
  { name: "Tent (2-person)", rarity: "uncommon", basePrice: 2 },
  { name: "Lantern, Hooded", rarity: "common", basePrice: 5 },
  { name: "Grappling Hook", rarity: "uncommon", basePrice: 2 },
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
    case "custom":
    default:
      // For custom, mix a few from each as a baseline
      return [
        ...POTION_CATALOG.slice(0, 2),
        ...ARCANA_CATALOG.slice(0, 2),
        ...BLACKSMITH_CATALOG.slice(0, 2),
        ...GENERAL_CATALOG.slice(0, 2),
      ]
  }
}

/**
 * Creates a locked-in ±5% adjustment for a base price.
 * Returns integer percent and a rounded final price to 2 decimals.
 */
export function clampTo5Percent(basePrice: number): { pct: number; final: number } {
  // -5..+5 inclusive
  const pct = Math.floor(-5 + Math.random() * 11)
  const final = Math.round(basePrice * (1 + pct / 100) * 100) / 100
  return { pct, final }
}
