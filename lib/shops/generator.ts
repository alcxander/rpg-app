/**
 * Shopkeeper and inventory generator with debug logging.
 */
import { type ShopType, pickCatalog, clampTo5Percent, type CatalogItem, type Rarity } from "./pricing"

export type GeneratedItem = {
  item_name: string
  rarity: Rarity
  base_price: number
  price_adjustment_percent: number
  final_price: number
  stock_quantity: number
}

export type GeneratedShopkeeper = {
  name: string
  race: string
  age: number
  alignment: string
  quote: string
  description: string
  shop_type: ShopType
  items: GeneratedItem[]
}

const RACES = ["Human", "Elf", "Dwarf", "Halfling", "Tiefling", "Half-Orc", "Gnome", "Dragonborn"]
const ALIGNMENTS = ["LG", "NG", "CG", "LN", "N", "CN", "LE", "NE", "CE"]
const SHOP_TYPES: ShopType[] = ["potion", "arcana", "blacksmith", "general"]

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function sampleDistinct<T>(arr: T[], n: number): T[] {
  const a = [...arr]
  const out: T[] = []
  for (let i = 0; i < n && a.length; i++) {
    const idx = Math.floor(Math.random() * a.length)
    out.push(a[idx])
    a.splice(idx, 1)
  }
  return out
}

function randomName(): string {
  const first = [
    "Ari",
    "Bel",
    "Cor",
    "Dara",
    "Eli",
    "Fen",
    "Gav",
    "Hala",
    "Iri",
    "Jas",
    "Kor",
    "Lia",
    "Mira",
    "Nim",
    "Ori",
    "Perr",
    "Quin",
    "Ria",
    "Ser",
    "Tess",
    "Ul",
    "Val",
    "Wyn",
    "Xan",
    "Yara",
    "Zev",
  ]
  const last = [
    "Amber",
    "Bright",
    "Cinder",
    "Dusk",
    "Ember",
    "Frost",
    "Glimmer",
    "Hollow",
    "Iron",
    "Jade",
    "Keen",
    "Loom",
    "Mirth",
    "Night",
    "Oak",
    "Proud",
    "Quick",
    "Reed",
    "Stone",
    "Thorn",
    "Umber",
    "Vale",
    "Wraith",
    "Xylo",
    "Yew",
    "Zephyr",
  ]
  return `${pick(first)}${Math.random() < 0.5 ? "" : pick(first).toLowerCase()} ${pick(last)}`
}

function randomQuote(): string {
  const lines = [
    "Coin's good, but stories are better.",
    "Everything has a price—some just don't pay in gold.",
    "If it breaks, I'll fix it. If it kills, I won't ask.",
    "Keep your wits sharp and your blade sharper.",
    "Magic's a tool—respect it or it bites back.",
  ]
  return pick(lines)
}

function randomDescription(type: ShopType): string {
  const base = [
    "weathered face, ink-stained fingers",
    "braided hair, scar across cheek",
    "gleaming eyes, steady hands",
    "soft voice, aromatics lingering",
    "booming laugh, soot on apron",
  ]
  const aboutShop = {
    potion: "shelves of vials, herbal scents, simmering alembics",
    arcana: "runes etched on counters, crackle of latent magic",
    blacksmith: "anvil rings, heat-warped air, walls of steel",
    general: "miscellany packed tight, creaking floorboards",
    custom: "curios piled high, strange trinkets everywhere",
  }[type]
  return `${pick(base)}; ${aboutShop}.`
}

function stockForRarity(r: Rarity): number {
  switch (r) {
    case "common":
      return Math.floor(5 + Math.random() * 8) // 5-12
    case "uncommon":
      return Math.floor(2 + Math.random() * 5) // 2-6
    case "rare":
      return Math.random() < 0.5 ? 1 : 2
    case "wondrous":
      return 1
    case "legendary":
      return Math.random() < 0.1 ? 1 : 0
    default:
      return 1
  }
}

function clampByType(items: CatalogItem[], min: number, max: number): CatalogItem[] {
  const count = Math.floor(min + Math.random() * (max - min + 1))
  return sampleDistinct(items, Math.min(count, items.length))
}

export function generateShopkeepers(count = 5): GeneratedShopkeeper[] {
  console.log("[generator] start generateShopkeepers", { count })
  const result: GeneratedShopkeeper[] = []
  for (let i = 0; i < count; i++) {
    const type = pick(SHOP_TYPES)
    const name = randomName()
    const race = pick(RACES)
    const age = Math.floor(18 + Math.random() * 60)
    const alignment = pick(ALIGNMENTS)
    const quote = randomQuote()
    const description = randomDescription(type)

    const catalog = clampByType(pickCatalog(type), 5, 10)
    const items: GeneratedItem[] = catalog
      .map((c) => {
        const { pct, final } = clampTo5Percent(c.basePrice)
        const qty = stockForRarity(c.rarity)
        return {
          item_name: c.name,
          rarity: c.rarity,
          base_price: Number(c.basePrice),
          price_adjustment_percent: pct,
          final_price: Number(final),
          stock_quantity: qty,
        }
      })
      .filter((x) => x.stock_quantity > 0)

    const shop: GeneratedShopkeeper = {
      name,
      race,
      age,
      alignment,
      quote,
      description,
      shop_type: type,
      items,
    }
    console.log("[generator] generated shopkeeper", {
      index: i,
      shop_type: type,
      name,
      race,
      age,
      alignment,
      items_count: items.length,
    })
    result.push(shop)
  }
  console.log("[generator] finished generateShopkeepers", { generated: result.length })
  return result
}
