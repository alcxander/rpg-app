import { pickItemsForType, type ShopType } from "./pricing"

const RACES = ["Human", "Elf", "Dwarf", "Halfling", "Gnome", "Half-Orc", "Tiefling", "Dragonborn", "Half-Elf"]
const ALIGNMENTS = [
  "Lawful Good",
  "Neutral Good",
  "Chaotic Good",
  "Lawful Neutral",
  "True Neutral",
  "Chaotic Neutral",
  "Lawful Evil",
  "Neutral Evil",
  "Chaotic Evil",
]
const SHOP_TYPES: ShopType[] = ["potion", "arcana", "blacksmith", "general"]

function rpick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomName(): string {
  const first = ["Aria", "Borin", "Cael", "Dara", "Eryn", "Finn", "Garr", "Hilda", "Ivor", "Jora", "Kelm", "Lysa"]
  const last = ["Thorn", "Brew", "Iron", "Rune", "Shade", "Vale", "Stone", "Grove", "Ash", "Frost", "Storm"]
  return `${rpick(first)} ${rpick(last)}`
}

function randomQuote(): string {
  const qs = [
    "Gold's good, but stories are better.",
    "Everything has a price, even secrets.",
    "You break it, you bought it.",
    "Keep your blade sharp and your wits sharper.",
  ]
  return rpick(qs)
}

function randomDescription(): string {
  const ds = [
    "Weathered face, keen eyes, and ink-stained fingers.",
    "Soot-smeared apron, broad shoulders, and a booming laugh.",
    "Quiet smile, immaculate robes, and a faint smell of herbs.",
    "Scar across the cheek, steady hands, and a wary gaze.",
  ]
  return rpick(ds)
}

export type GeneratedItem = {
  item_name: string
  rarity: "common" | "uncommon" | "rare" | "wondrous" | "legendary"
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

export function generateShopkeepers(count: number): GeneratedShopkeeper[] {
  const list: GeneratedShopkeeper[] = []
  const howMany = Math.max(5, Math.min(20, Math.floor(count) || 5))
  for (let i = 0; i < howMany; i++) {
    const shop_type = rpick(SHOP_TYPES)
    const itemsCount = 5 + Math.floor(Math.random() * 6) // 5-10
    const items = pickItemsForType(shop_type, itemsCount)

    const sk: GeneratedShopkeeper = {
      name: randomName(),
      race: rpick(RACES),
      age: 20 + Math.floor(Math.random() * 50),
      alignment: rpick(ALIGNMENTS),
      quote: randomQuote(),
      description: randomDescription(),
      shop_type,
      items,
    }
    // Log generation summary for debugging
    console.log("[generator] shopkeeper", {
      name: sk.name,
      type: sk.shop_type,
      items: sk.items.length,
    })
    list.push(sk)
  }
  return list
}
