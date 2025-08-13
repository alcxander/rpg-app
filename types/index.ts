export interface CampaignOption {
  id: string
  name: string
  owner_id?: string
  access_enabled?: boolean
  created_at?: string
}

export interface Campaign {
  id: string
  name: string
  owner_id: string
  is_owner: boolean
  is_member: boolean
  member_role: string | null
  access_enabled?: boolean
  created_at: string
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
  inventory: ShopkeeperInventoryItem[]
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
  name: string
  created_at: string
}

export interface MapToken {
  id: string
  name: string
  x: number
  y: number
  imageUrl: string
  isPlayer: boolean
  hp: number
  maxHp: number
  ac: number
  initiativeOrder: number
}

export interface Battle {
  id: string
  session_id: string
  name: string
  entities: BattleEntity[]
  map_url?: string
  created_at: string
}

export interface BattleEntity {
  id: string
  name: string
  type: "monster" | "ally"
  hp: number
  max_hp: number
  ac: number
  initiative_order: number
  token_image?: string
  stats?: Record<string, any>
}

export interface LootResult {
  id: string
  session_id: string
  items: LootItem[]
  generated_at: string
}

export interface LootItem {
  name: string
  description: string
  rarity: string
  value: number
  quantity: number
}

export interface User {
  id: string
  clerk_id: string
  name: string
  email?: string
  created_at: string
}

export interface PlayerGold {
  player_id: string
  campaign_id: string
  gold_amount: number
  player_name?: string
  player_clerk_id?: string
  role?: string
  joined_at?: string
}

export interface Message {
  id: string
  user_id: string
  user_name: string
  content: string
  created_at: string
}

export interface SessionState {
  id: string
  map?: string | null
  tokens?: MapToken[]
}
