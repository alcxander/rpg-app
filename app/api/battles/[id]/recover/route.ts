import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerSupabaseClient } from '@/lib/supabaseAdmin'
import { parseCoordinate, formatCoordinate } from '@/lib/utils'
import type { MapData, MapToken } from '@/lib/types'
import { v4 as uuidv4 } from 'uuid'
import { generateContent } from '@/lib/llmClient' // Uses the AI SDK generateText with @ai-sdk/openai [^1]

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min

function assignPositions(tokens: MapToken[], gridSize: number) {
  const pcs = tokens.filter(t => t.type === 'pc')
  const mons = tokens.filter(t => t.type === 'monster')
  const taken = new Set<string>()
  const key = (x: number, y: number) => `${x},${y}`
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

  const pad = 2
  const cx = randInt(pad, gridSize - 1 - pad)
  const cy = randInt(pad, gridSize - 1 - pad)
  const pcOffsets = [[0,0],[1,0],[0,1],[1,1],[-1,0],[0,-1],[-1,-1],[2,0],[0,2],[2,1],[1,2],[-2,0],[0,-2],[-1,2],[2,-1]]

  pcs.forEach((pc, i) => {
    const off = pcOffsets[i % pcOffsets.length]
    const x = clamp(cx + off[0], 0, gridSize - 1)
    const y = clamp(cy + off[1], 0, gridSize - 1)
    pc.x = x; pc.y = y
    taken.add(key(x,y))
  })

  const minDist = 2
  const validSpot = (x: number, y: number) => {
    if (taken.has(key(x,y))) return false
    for (const pc of pcs) {
      const dx = Math.abs(pc.x - x)
      const dy = Math.abs(pc.y - y)
      if (dx + dy < minDist) return false
    }
    return true
  }

  mons.forEach((m) => {
    let tries = 0
    let x = 0, y = 0
    do {
      x = randInt(0, gridSize - 1)
      y = randInt(0, gridSize - 1)
      tries++
      if (tries > 250) break
    } while (!validSpot(x,y))
    m.x = x; m.y = y
    taken.add(key(x,y))
  })
}

async function callGenerateMapInternal(prompt: string, req: Request) {
  const url = new URL('/api/generate-map', req.url).toString()
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Cookie': req.headers.get('cookie') || '' }, body: JSON.stringify({ prompt }) })
  const text = await res.text()
  let parsed: any = {}
  try { parsed = JSON.parse(text) } catch {}
  if (!res.ok) throw new Error(parsed?.error || 'Failed to generate map image')
  return parsed.image as string
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const { userId, getToken } = await auth()
  if (!userId || !getToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const token = await getToken({ template: 'supabase' })
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const supabase = createServerSupabaseClient(token)

    // Load battle and map
    const bRes = await supabase.from('battles').select('*').eq('id', id).maybeSingle()
    if (bRes.error || !bRes.data) return NextResponse.json({ error: 'Battle not found' }, { status: 404 })
    const battle: any = bRes.data

    let mRes = await supabase.from('maps').select('*').eq('session_id', battle.session_id).maybeSingle()
    if (mRes.error && mRes.error.code !== 'PGRST116') {
      return NextResponse.json({ error: mRes.error.message }, { status: 500 })
    }
    let map: any = mRes.data
    if (!map) {
      const now = new Date().toISOString()
      const up = await supabase.from('maps').upsert({ session_id: battle.session_id, grid_size: 20, terrain_data: {}, tokens: [], background_image: null, created_at: now, updated_at: now }, { onConflict: 'session_id' }).select('*').maybeSingle()
      if (up.error || !up.data) return NextResponse.json({ error: up.error?.message || 'Failed to create map' }, { status: 500 })
      map = up.data
    }

    const missingBg = !battle.background_image && !map.background_image
    const missingEntities = (!Array.isArray(battle.monsters) || battle.monsters.length === 0) && (!Array.isArray(battle.allies) || battle.allies.length === 0)
    const missingTokens = !Array.isArray(map.tokens) || map.tokens.length === 0

    // Step 1: background if missing
    if (missingBg) {
      const prompt = `Top-down 2D tabletop battle map, vivid, high-contrast, grid-friendly, no labels.`
      const img = await callGenerateMapInternal(prompt, req)
      await supabase.from('battles').update({ background_image: img }).eq('id', id)
      await supabase.from('maps').update({ background_image: img, updated_at: new Date().toISOString() }).eq('session_id', battle.session_id)
      battle.background_image = img
      map.background_image = img
    }

    // Step 2: entities if missing (AI SDK) [^1]
    if (missingEntities) {
      const dataPrompt = `
        You are a TTRPG encounter designer. Create a JSON ONLY response for a D&D-like encounter.

        Goals:
        - Use a 20x20 grid ("grid_size": 20).
        - Include monsters and pcs with stats and "starting_coordinates" using A1..T20.
        - Each monster MUST include a numeric field "cr".
        - Include "terrain_features" (object keyed by coordinates with descriptions).
        - Provide a "log_message" as the first activity line.

        JSON Structure:
        {
          "map": { "grid_size": 20, "terrain_features": { "A1": "Dense Forest", "C3": "Rocky Outcrop" } },
          "monsters": [ { "id": "monster-1", "name": "Goblin Skirmisher", "cr": 0.25, "stats": {"HP": 10, "AC": 13}, "starting_coordinates": "B2", "image": "" } ],
          "pcs": [ { "id": "pc-1", "name": "Fighter", "stats": {"HP": 25, "AC": 16}, "starting_coordinates": "A1", "image": "" } ],
          "log_message": "An ambush springs from the brush!"
        }
      `
      let text = await generateContent(dataPrompt)
      let cleaned = text.trim()
      if (cleaned.startsWith('```json')) cleaned = cleaned.slice('```json'.length)
      if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3)
      const encounter = JSON.parse(cleaned)

      const gridSize = Number(encounter?.map?.grid_size) || 20
      const tokens: MapToken[] = [
        ...(encounter?.monsters || []).map((m: any) => ({
          id: String(m.id || uuidv4()),
          type: 'monster' as const,
          name: String(m.name || 'Monster'),
          stats: m.stats || {},
          image: String(m.image || ''),
          ...parseCoordinate(String(m.starting_coordinates || 'B2')),
        })),
        ...(encounter?.pcs || []).map((p: any) => ({
          id: String(p.id || uuidv4()),
          type: 'pc' as const,
          name: String(p.name || 'PC'),
          stats: p.stats || {},
          image: String(p.image || ''),
          ...parseCoordinate(String(p.starting_coordinates || 'A1')),
        })),
      ]

      assignPositions(tokens, gridSize)

      const byId = new Map(tokens.map((t) => [t.id, t]))
      ;(encounter.monsters || []).forEach((m: any) => { const t = byId.get(String(m.id)); if (t) m.starting_coordinates = formatCoordinate(t.x, t.y) })
      ;(encounter.pcs || []).forEach((p: any) => { const t = byId.get(String(p.id)); if (t) p.starting_coordinates = formatCoordinate(t.x, t.y) })

      const everyone = ([] as any[]).concat(encounter.monsters || [], encounter.pcs || [])
      const initiative: Record<string, number> = {}
      everyone.forEach((c: any) => { const k = String(c.id || c.name || uuidv4()); initiative[k] = randInt(1, 20) })

      await supabase.from('battles').update({
        monsters: encounter.monsters || [],
        allies: encounter.pcs || [],
        initiative,
        log: [String(encounter.log_message || 'Recovered battle.')],
      }).eq('id', id)

      const mapPatch: Partial<MapData> = {
        grid_size: gridSize,
        terrain_data: encounter?.map?.terrain_features && typeof encounter.map.terrain_features === 'object' ? encounter.map.terrain_features : {},
        tokens,
        updated_at: new Date().toISOString(),
      }
      await supabase.from('maps').update(mapPatch as any).eq('session_id', battle.session_id)
      battle.monsters = encounter.monsters || []
      battle.allies = encounter.pcs || []
      battle.initiative = initiative
      map.tokens = tokens
      map.grid_size = gridSize
      map.terrain_data = mapPatch.terrain_data || {}
    } else if (missingTokens) {
      // Rebuild tokens from existing entities
      const mkToken = (it: any, type: 'monster'|'pc'): MapToken => {
        const coord = parseCoordinate(String(it.starting_coordinates || (type === 'pc' ? 'A1' : 'B2')))
        return {
          id: String(it.id || uuidv4()),
          type,
          name: String(it.name || (type === 'pc' ? 'PC' : 'Monster')),
          image: String(it.image || ''),
          stats: typeof it.stats === 'object' && it.stats ? it.stats : {},
          x: coord.x,
          y: coord.y,
        }
      }
      const tokens: MapToken[] = [
        ...((battle.monsters as any[]) || []).map((m: any) => mkToken(m, 'monster')),
        ...((battle.allies as any[]) || []).map((p: any) => mkToken(p, 'pc')),
      ]
      const gridSize = Number(map.grid_size) || 20
      assignPositions(tokens, gridSize)
      await supabase.from('maps').update({ tokens, updated_at: new Date().toISOString() }).eq('session_id', battle.session_id)
      map.tokens = tokens
    }

    // Return fresh rows
    const refreshedBattle = await supabase.from('battles').select('*').eq('id', id).maybeSingle()
    const refreshedMap = await supabase.from('maps').select('*').eq('session_id', battle.session_id).maybeSingle()
    return NextResponse.json({ ok: true, battle: refreshedBattle.data || null, map: refreshedMap.data || null })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to recover battle' }, { status: 500 })
  }
}
