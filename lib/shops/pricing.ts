// Types
export type Rarity = "common" | "uncommon" | "rare" | "wondrous" | "legendary"
export type ShopType = "potion" | "arcana" | "blacksmith" | "general"

export type CatalogItem = {
  name: string
  rarity: Rarity
  basePrice: number
}

// D&D-inspired baseline prices, trimmed to essentials, keep rare/wondrous/legendary sparse
const POTION_CATALOG: CatalogItem[] = [
  { name: "Potion of Healing", rarity: "common", basePrice: 50 },
  { name: "Potion of Greater Healing", rarity: "uncommon", basePrice: 150 },
  { name: "Potion of Superior Healing", rarity: "rare", basePrice: 450 },
  { name: "Potion of Climbing", rarity: "common", basePrice: 50 },
  { name: "Potion of Invisibility (vial)", rarity: "wondrous", basePrice: 2500 },
  { name: "Antitoxin", rarity: "common", basePrice: 50 },
  { name: "Elixir of Health", rarity: "wondrous", basePrice: 1200 },
  { name: "Oil of Slipperiness", rarity: "uncommon", basePrice: 250 },
  { name: "Potion of Resistance", rarity: "uncommon", basePrice: 300 },
  { name: "Potion of Heroism", rarity: "rare", basePrice: 800 },
]

const ARCANA_CATALOG: CatalogItem[] = [
  { name: "Spell Scroll (1st level)", rarity: "common", basePrice: 75 },
  { name: "Spell Scroll (2nd level)", rarity: "uncommon", basePrice: 150 },
  { name: "Spell Scroll (3rd level)", rarity: "uncommon", basePrice: 300 },
  { name: "Spell Scroll (4th level)", rarity: "rare", basePrice: 500 },
  { name: "Wand of Magic Detection", rarity: "uncommon", basePrice: 250 },
  { name: "Pearl of Power", rarity: "rare", basePrice: 1000 },
  { name: "Cloak of Protection", rarity: "rare", basePrice: 1500 },
  { name: "Bag of Holding", rarity: "uncommon", basePrice: 400 },
  { name: "Sending Stone (pair)", rarity: "uncommon", basePrice: 500 },
  { name: "Ring of Mind Shielding", rarity: "rare", basePrice: 2000 },
]

const BLACKSMITH_CATALOG: CatalogItem[] = [
  { name: "Dagger", rarity: "common", basePrice: 2 },
  { name: "Shortsword", rarity: "common", basePrice: 10 },
  { name: "Longsword", rarity: "common", basePrice: 15 },
  { name: "Greataxe", rarity: "common", basePrice: 30 },
  { name: "Shield", rarity: "common", basePrice: 10 },
  { name: "Chain Shirt", rarity: "uncommon", basePrice: 50 },
  { name: "Breastplate", rarity: "uncommon", basePrice: 400 },
  { name: "Plate Armor", rarity: "rare", basePrice: 1500 },
  { name: "Smithing Repairs (per item)", rarity: "common", basePrice: 5 },
  { name: "Silvered Weapon Surcharge", rarity: "uncommon", basePrice: 100 },
]

const GENERAL_CATALOG: CatalogItem[] = [
  { name: "Rations (1 day)", rarity: "common", basePrice: 0.5 },
  { name: "Rope (50 feet)", rarity: "common", basePrice: 1 },
  { name: "Grappling Hook", rarity: "common", basePrice: 2 },
  { name: "Healer's Kit", rarity: "common", basePrice: 5 },
  { name: "Lantern, Hooded", rarity: "common", basePrice: 5 },
  { name: "Oil (flask)", rarity: "common", basePrice: 0.1 },
  { name: "Climber’s Kit", rarity: "uncommon", basePrice: 25 },
  { name: "Ball Bearings (bag)", rarity: "common", basePrice: 1 },
  { name: "Vial (glass)", rarity: "common", basePrice: 1 },
  { name: "Tent (two-person)", rarity: "common", basePrice: 2 },
]

// Functions
export function pickCatalog(type: ShopType): CatalogItem[] {
  switch (type) {
    case "potion":
      return POTION_CATALOG
    case "arcana":
      return ARCANA_CATALOG
    case "blacksmith":
      return BLACKSMITH_CATALOG
    case "general":
    default:
      return GENERAL_CATALOG
  }
}

export function clampTo5Percent(base: number): { pct: number; final: number } {
  // Random int between -5 and 5
  const pct = Math.floor(Math.random() * 11) - 5
  const final = Math.round(base * (1 + pct / 100) * 100) / 100
  return { pct, final }
}
