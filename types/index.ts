export interface Campaign {
  id: string
  name: string
  description?: string
  created_at: string
  updated_at: string
  dm_user_id: string
  members?: CampaignMember[]
}

export interface CampaignMember {
  id: string
  campaign_id: string
  user_id: string
  role: "dm" | "player"
  joined_at: string
  user?: {
    id: string
    email: string
    name?: string
  }
}

export interface RealtimeSession {
  id: string
  campaign_id: string
  name: string
  status: "active" | "paused" | "ended"
  created_at: string
  updated_at: string
  current_battle_id?: string
  participants?: SessionParticipant[]
}

export interface SessionParticipant {
  id: string
  session_id: string
  user_id: string
  character_name?: string
  joined_at: string
}

export interface Battle {
  id: string
  session_id: string
  name: string
  description?: string
  status: "active" | "completed"
  created_at: string
  updated_at: string
  background_image?: string
  entities?: BattleEntity[]
  initiative_order?: InitiativeEntry[]
  current_turn?: number
}

export interface BattleEntity {
  id: string
  battle_id: string
  name: string
  type: "player" | "enemy" | "npc"
  hp: number
  max_hp: number
  ac: number
  position_x: number
  position_y: number
  token_image?: string
  stats?: EntityStats
}

export interface EntityStats {
  strength: number
  dexterity: number
  constitution: number
  intelligence: number
  wisdom: number
  charisma: number
}

export interface InitiativeEntry {
  entity_id: string
  initiative: number
  entity?: BattleEntity
}

export interface ChatMessage {
  id: string
  session_id: string
  user_id: string
  user_name: string
  message: string
  message_type: "chat" | "system" | "roll"
  created_at: string
}

export interface Message {
  id: string
  user_name: string
  message: string
  message_type: "chat" | "system" | "roll"
  created_at: string
}

export interface Shopkeeper {
  id: string
  campaign_id: string
  name: string
  description?: string
  location?: string
  personality?: string
  created_at: string
  updated_at: string
  inventory?: ShopItem[]
}

export interface ShopItem {
  id: string
  shopkeeper_id: string
  name: string
  description?: string
  price: number
  quantity: number
  category: string
  rarity: "common" | "uncommon" | "rare" | "very_rare" | "legendary"
  created_at: string
  updated_at: string
}

export interface PlayerGold {
  id: string
  campaign_id: string
  user_id: string
  amount: number
  updated_at: string
}

export interface LootTable {
  id: string
  name: string
  description?: string
  items: LootItem[]
}

export interface LootItem {
  name: string
  description?: string
  rarity: "common" | "uncommon" | "rare" | "very_rare" | "legendary"
  weight: number
  value?: number
}

export interface GeneratedLoot {
  items: LootItem[]
  total_value: number
  generated_at: string
}

export interface SessionState {
  battle?: Battle
  entities: BattleEntity[]
  messages: ChatMessage[]
  initiative_order: InitiativeEntry[]
  current_turn: number
}

export interface UseRealtimeSessionReturn {
  session: RealtimeSession | null
  loading: boolean
  error: string | null
  refetch: () => void
  sessionState: SessionState
  updateSessionState: (updates: Partial<SessionState>) => void
}
