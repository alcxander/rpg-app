export interface CampaignOption {
  id: string
  name: string
  owner_id?: string
  access_enabled?: boolean
  created_at?: string
}

export interface Shopkeeper {
  id: string
  campaign_id: string
  name: string
  race: string
  age: number
  alignment: string
  quote: string
  description: string
  shop_type: string
  image_url: string | null
  removed?: boolean
  removed_at?: string | null
  created_at: string
  inventory?: ShopkeeperInventoryItem[]
}

export interface ShopkeeperInventoryItem {
  id: string
  shopkeeper_id: string
  item_name: string
  rarity: string
  base_price: number
  price_adjustment_percent: number
  final_price: number
  stock_quantity: number
  created_at: string
}

export interface SessionOption {
  id: string
  campaign_id: string
  created_at: string
}

export interface MapToken {
  id: string
  type: "monster" | "pc"
  name: string
  image: string
  stats: Record<string, any>
  x: number
  y: number
}
