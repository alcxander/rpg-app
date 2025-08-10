/**
 * Minimal D&D-like pricing references to meet spec.
 * These are approximate anchors; final_price applies +/-5% adjustment once.
 */

export type Rarity = "common" | "uncommon" | "rare" | "wondrous" | "legendary"

export type ShopType = "potion" | "arcana" | "blacksmith" | "general" | "custom"

export type CatalogItem = {
  name: string
  rarity: Rarity
  basePrice: number // gp
}

export const PotionCatalog: CatalogItem[] = [
  { name: "Potion of Healing", rarity: "common", basePrice: 50 },
  { name: "Potion of Greater Healing", rarity: "uncommon", basePrice: 150 },
  { name: "Potion of Superior Healing", rarity: "rare", basePrice: 450 },
  { name: "Potion of Supreme Healing", rarity: "wondrous", basePrice: 1350 },
  { name: "Potion of Climbing", rarity: "common", basePrice: 50 },
  { name: "Potion of Invisibility", rarity: "wondrous", basePrice: 2500 },
]

export const ArcanaCatalog: CatalogItem[] = [
  { name: "Spell Scroll (1st level)", rarity: "common", basePrice: 50 },
  { name: "Spell Scroll (2nd level)", rarity: "uncommon", basePrice: 150 },
  { name: "Spell Scroll (3rd level)", rarity: "uncommon", basePrice: 300 },
  { name: "Spell Scroll (4th level)", rarity: "rare", basePrice: 800 },
  { name: "Wand of Magic Detection (charges)", rarity: "rare", basePrice: 1000 },
  { name: "Pearl of Power", rarity: "rare", basePrice: 3000 },
]

export const SmithCatalog: CatalogItem[] = [
  { name: "Dagger", rarity: "common", basePrice: 2 },
  { name: "Shortsword", rarity: "common", basePrice: 10 },
  { name: "Longsword", rarity: "common", basePrice: 15 },
  { name: "Shield", rarity: "common", basePrice: 10 },
  { name: "Chain Mail", rarity: "uncommon", basePrice: 75 },
  { name: "Plate Armor", rarity: "rare", basePrice: 1500 },
  { name: "Repair Service", rarity: "common", basePrice: 5 },
]

export const GeneralCatalog: CatalogItem[] = [
  { name: "Rations (1 day)", rarity: "common", basePrice: 0.5 },
  { name: "Rope (50 ft)", rarity: "common", basePrice: 1 },
  { name: "Torch", rarity: "common", basePrice: 0.01 },
  { name: "Healer's Kit", rarity: "common", basePrice: 5 },
  { name: "Backpack", rarity: "common", basePrice: 2 },
  { name: "Grappling Hook", rarity: "uncommon", basePrice: 2 },
]

export function pickCatalog(type: ShopType): CatalogItem[] {
  switch (type) {
    case "potion":
      return PotionCatalog
    case "arcana":
      return ArcanaCatalog
    case "blacksmith":
      return SmithCatalog
    case "general":
      return GeneralCatalog
    default:
      return GeneralCatalog
  }
}

export function clampTo5Percent(base: number): { pct: number; final: number } {
  // Random integer -5..+5
  const pct = Math.floor(Math.random() * 11) - 5
  const final = Math.max(0.01, Math.round(base * (1 + pct / 100) * 100) / 100)
  return { pct, final }
}
