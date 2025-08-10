/**
 * Pricing catalog and helpers for shop inventories.
 * Applies +/- 5% variance and realistic rarity distributions per shop type.
 */

export type Rarity = "common" | "uncommon" | "rare" | "wondrous" | "legendary"
export type ShopType = "potion" | "arcana" | "blacksmith" | "general" | "custom"

type CatalogItem = {
  name: string
  rarity: Rarity
  basePrice: number // in gp
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))

export function priceWithVariance(base: number): { final: number; variancePct: number } {
  // +/- 5% integer variance
  const variancePct = Math.floor(Math.random() * 11 /* 0..10 */ - 5)
  const final = Math.round((base * (100 + variancePct)) / 100)
  return { final, variancePct }
}

const POTION_CATALOG: CatalogItem[] = [
  { name: "Potion of Healing", rarity: "common", basePrice: 50 },
  { name: "Potion of Greater Healing", rarity: "uncommon", basePrice: 150 },
  { name: "Potion of Superior Healing", rarity: "rare", basePrice: 450 },
  { name: "Potion of Climbing", rarity: "common", basePrice: 50 },
  { name: "Potion of Resistance", rarity: "rare", basePrice: 300 },
]

const ARCANA_CATALOG: CatalogItem[] = [
  { name: "Scroll of Magic Missile", rarity: "common", basePrice: 25 },
  { name: "Scroll of Fireball", rarity: "rare", basePrice: 300 },
  { name: "Pearl of Power", rarity: "rare", basePrice: 600 },
  { name: "Wand of Web", rarity: "uncommon", basePrice: 300 },
  { name: "Spellbook Copy Service", rarity: "common", basePrice: 50 },
]

const BLACKSMITH_CATALOG: CatalogItem[] = [
  { name: "Longsword", rarity: "common", basePrice: 15 },
  { name: "Shield", rarity: "common", basePrice: 10 },
  { name: "+1 Weapon", rarity: "uncommon", basePrice: 500 },
  { name: "Repair Service", rarity: "common", basePrice: 5 },
  { name: "+1 Armor", rarity: "rare", basePrice: 1000 },
]

const GENERAL_CATALOG: CatalogItem[] = [
  { name: "Rations (1 day)", rarity: "common", basePrice: 5 },
  { name: "Rope (50 feet)", rarity: "common", basePrice: 1 },
  { name: "Grappling Hook", rarity: "common", basePrice: 2 },
  { name: "Healer's Kit", rarity: "common", basePrice: 5 },
  { name: "Antitoxin", rarity: "uncommon", basePrice: 50 },
]

// We keep legendary extremely rare in generation logic (almost never).
export function getCatalogFor(type: ShopType): CatalogItem[] {
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

export function pickWeightedRarity(): Rarity {
  // Approx distribution: common 55%, uncommon 30%, rare 12%, wondrous 3%, legendary 0.2%
  const n = Math.random() * 100
  if (n < 55) return "common"
  if (n < 85) return "uncommon"
  if (n < 97) return "rare"
  if (n < 99.8) return "wondrous"
  return "legendary"
}

export function randomStockByRarity(r: Rarity): number {
  switch (r) {
    case "common":
      return 2 + Math.floor(Math.random() * 9) // 2-10
    case "uncommon":
      return 1 + Math.floor(Math.random() * 5) // 1-5
    case "rare":
      return 1 + Math.floor(Math.random() * 2) // 1-2
    case "wondrous":
      return 1
    case "legendary":
      return 1
  }
}

export function pickItemsForType(type: ShopType, count: number) {
  const cat = getCatalogFor(type)
  const items: {
    item_name: string
    rarity: Rarity
    base_price: number
    final_price: number
    price_adjustment_percent: number
    stock_quantity: number
  }[] = []

  // Compute target rarity picks but ensure items match catalog rarity and name diversity
  for (let i = 0; i < count; i++) {
    const targetRarity = pickWeightedRarity()
    // Keep legendary very infrequent and clamp it out most times
    const rarity: Rarity = targetRarity === "legendary" && Math.random() < 0.95 ? "rare" : targetRarity

    // Filter catalog by rarity; if empty fall back to whole catalog
    const choices = cat.filter((c) => c.rarity === rarity)
    const chosen = choices.length
      ? choices[Math.floor(Math.random() * choices.length)]
      : cat[Math.floor(Math.random() * cat.length)]
    const { final, variancePct } = priceWithVariance(chosen.basePrice)
    const stock = randomStockByRarity(chosen.rarity)

    items.push({
      item_name: chosen.name,
      rarity: chosen.rarity,
      base_price: chosen.basePrice,
      final_price: final,
      price_adjustment_percent: variancePct,
      stock_quantity: stock,
    })
  }

  return items
}
