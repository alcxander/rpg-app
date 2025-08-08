// lib/types.ts
import { Session } from "@supabase/supabase-js"; // Assuming this is needed for 'Session' type, if not, remove

export type UserRole = 'DM' | 'Player';

export type User = {
  id: string;
  clerk_id: string;
  name: string;
  role: UserRole | null;
  created_at: string;
  updated_at: string;
};

export type Campaign = {
  id: string;
  name: string;
  owner_id: string;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
};

export type SessionParticipant = {
  userId: string;
  role: UserRole;
};

export type MapToken = {
  id: string;
  type: 'monster' | 'pc';
  x: number;
  y: number;
  image: string; // Explicitly string
  name: string; // Explicitly string
  stats: Record<string, any>; // Explicitly an object
};

export type MapData = {
  session_id: string;
  grid_size: number;
  terrain_data: Record<string, any>;
  background_image?: string | null;
  tokens: MapToken[];
  created_at: string;
  updated_at: string;
};

export type Battle = {
  id: string;
  session_id: string;
  map_ref: string | null;
  monsters: any[];
  allies: any[];
  log: string[]; // Explicitly string[]
  created_at: string;
};

export type Shop = {
  id: string;
  campaign_id: string;
  name: string;
  keeper: {
    name: string;
    race: string;
    age: number;
    temperament: string;
    quote: string;
  };
  inventory: {
    name: string;
    description: string;
    value: number;
    rarity: string;
    quantity: number;
  }[];
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type LootAssignment = {
  id: string;
  session_id: string;
  item_id: string;
  item_data: Record<string, any>;
  assigned_to_user_id: string | null;
  assigned_at: string;
};
