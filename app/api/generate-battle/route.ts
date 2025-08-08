import { NextResponse } from 'next/server';
import { generateContent } from '@/lib/llmClient';
import { createServerSupabaseClient } from '@/lib/supabaseAdmin';
import { MapData, MapToken, Battle } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import { parseCoordinate, formatCoordinate } from '@/lib/utils';
import { auth } from '@clerk/nextjs/server';

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Utilities
const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
const shuffle = <T,>(arr: T[]) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function randomThreeWordName() {
  const a = ['Crimson','Silent','Ancient','Emerald','Shadow','Golden','Frozen','Vast','Vivid','Wild','Misty','Hidden','Brisk','Azure','Scarlet','Ivory','Obsidian','Verdant']
  const b = ['Fox','Oak','River','Blade','Crown','Grove','Harbor','Spire','Vale','Bridge','Canyon','Hollow','Fjord','Tide','Keep','Bastion','Garden','Market']
  const c = ['Ambush','Siege','Skirmish','Rumble','Standoff','Rout','Assault','Outriders','Ambuscade','Raid','Clash','Encounter','Meadow','Crossroads','Outpost','Docks','Ramparts','Bazaar']
  const pick = (arr: string[]) => arr[Math.floor(Math.random()*arr.length)]
  const name = `${pick(a)} ${pick(b)} ${pick(c)}`
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')
  return { name, slug }
}

async function callGenerateMapInternal(prompt: string, req: Request) {
  const url = new URL('/api/generate-map', req.url).toString()
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': req.headers.get('cookie') || '' },
    body: JSON.stringify({ prompt }),
  })
  const text = await res.text()
  let parsed: any = {}
  try { parsed = JSON.parse(text) } catch {}
  if (!res.ok) throw new Error(parsed?.error || 'Failed to generate map image')
  return parsed.image as string
}

// Positioning: PCs clustered; monsters staggered with Manhattan distance >= 2 from cluster
function assignPositions(tokens: MapToken[], gridSize: number) {
  const pcs = tokens.filter(t => t.type === 'pc')
  const mons = tokens.filter(t => t.type === 'monster')

  const taken = new Set<string>()
  const key = (x: number, y: number) => `${x},${y}`
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

  // Cluster center for PCs
  const pad = 2
  const cx = randInt(pad, gridSize - 1 - pad)
  const cy = randInt(pad, gridSize - 1 - pad)
  const pcOffsets = shuffle([[0,0],[1,0],[0,1],[1,1],[-1,0],[0,-1],[-1,-1],[2,0],[0,2],[2,1],[1,2],[-2,0],[0,-2],[-1,2],[2,-1]])

  pcs.forEach((pc, i) => {
    const off = pcOffsets[i % pcOffsets.length]
    const x = clamp(cx + off[0], 0, gridSize - 1)
    const y = clamp(cy + off[1], 0, gridSize - 1)
    pc.x = x; pc.y = y
    taken.add(key(x,y))
  })

  // Monsters placed not overlapping PCs and not too close
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

export async function POST(req: Request) {
  const { userId: clerkUserId, sessionId: clerkSessionId, getToken } = await auth();
  if (!clerkUserId || !clerkSessionId || !getToken) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const createdAt = new Date().toISOString()
  let warnings: string[] = []
  let partial = false
  let battleId: string | null = null

  try {
    const sessionToken = await getToken({ template: 'supabase' });
    if (!sessionToken) return NextResponse.json({ error: 'Authentication token missing.' }, { status: 401 });
    const supabase = createServerSupabaseClient(sessionToken);

    const { partyLevel, partySize, challengeRating, locationTheme, additionalNotes, sessionId } = await req.json();
    if (!sessionId) return NextResponse.json({ error: 'Session ID is required.' }, { status: 400 });

    // Verify session + DM role
    const { data: sessionData, error: sErr } = await supabase
      .from('sessions').select('id, participants').eq('id', sessionId).maybeSingle();
    if (sErr || !sessionData) return NextResponse.json({ error: `Session "${sessionId}" not found.` }, { status: 404 });
    const me = (sessionData.participants as any[] || []).find(p => p.userId === clerkUserId)
    if (!me || me.role !== 'DM') return NextResponse.json({ error: 'Only DMs can generate battles for this session.' }, { status: 403 })

    // 1) Ensure a map row exists FIRST to satisfy FK (maps.session_id)
    let mapRefForBattle: string | null = sessionId
    const upMap = await supabase.from('maps').upsert({
      session_id: sessionId,
      grid_size: 20,
      terrain_data: {},
      tokens: [],
      background_image: null,
      created_at: createdAt,
      updated_at: createdAt,
    }, { onConflict: 'session_id' }).select('session_id').maybeSingle()
    if (upMap.error) {
      warnings.push(`Map upsert warning: ${upMap.error.message}`)
      // To avoid FK violation, do NOT reference missing map
      mapRefForBattle = null
      partial = true
    }

    // 2) Insert a stub battle immediately (defensive write)
    const { name, slug } = randomThreeWordName();
    const stubBattle: Partial<Battle> & {
      name: string
      slug: string
      background_image: string | null
      initiative: any
      log: string[]
      map_ref: string | null
    } = {
      session_id: sessionId,
      map_ref: mapRefForBattle,
      monsters: [],
      allies: [],
      log: ['Battle created. Generating...'],
      name,
      slug,
      background_image: null,
      initiative: {},
    }
    const bIns = await supabase.from('battles').insert(stubBattle as any).select('*').single()
    if (bIns.error || !bIns.data) {
      // If even the stub fails, surface the error
      return NextResponse.json({ error: bIns.error?.message || 'Failed to create battle' }, { status: 500 })
    }
    battleId = bIns.data.id

    // Helper to append to battle log defensively
    const appendLog = async (msg: string) => {
      const { data: cur } = await supabase.from('battles').select('log').eq('id', battleId!).maybeSingle()
      const next = Array.isArray(cur?.log) ? [...cur!.log.map(String), String(msg)] : [String(msg)]
      await supabase.from('battles').update({ log: next }).eq('id', battleId!)
    }

    // 3) Kick off image and encounter generation in parallel and wait
    const mapPrompt = `Top-down 2D tabletop battle map, theme: ${locationTheme}. Vivid, high-contrast, grid-friendly, no labels.`
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

      Parameters:
      - party level: ${partyLevel}, party size: ${partySize}, target difficulty: ${challengeRating}
      - terrain theme: ${locationTheme}
      ${additionalNotes ? `Notes: ${additionalNotes}` : ''}
    `;

    const [mapResult, llmResult] = await Promise.allSettled([
      callGenerateMapInternal(mapPrompt, req),
      generateContent(dataPrompt), // AI SDK for encounter JSON [^1][^2]
    ])

    // 4) Apply map background if available
    let background_image: string | null = null
    if (mapResult.status === 'fulfilled') {
      background_image = mapResult.value
      await supabase.from('battles').update({ background_image }).eq('id', battleId)
      if (mapRefForBattle) {
        await supabase.from('maps').update({ background_image, updated_at: new Date().toISOString() }).eq('session_id', sessionId)
      }
      await appendLog('Background generated.')
    } else {
      partial = true
      warnings.push(`Background generation failed: ${mapResult.reason?.message || String(mapResult.reason)}`)
      await appendLog('Background generation failed; using local fallback.')
    }

    // 5) Apply encounter JSON if available; otherwise keep stub
    if (llmResult.status === 'fulfilled') {
      let cleaned = llmResult.value.trim()
      if (cleaned.startsWith('```json')) cleaned = cleaned.slice('```json'.length)
      if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3)
      let encounter: any
      try { encounter = JSON.parse(cleaned) } catch (e: any) {
        partial = true
        warnings.push(`Invalid encounter JSON: ${e.message}`)
        await appendLog('Encounter generation returned invalid JSON.')
        // continue; we still return stub battle/map
      }

      if (encounter?.map && encounter?.monsters && encounter?.pcs) {
        const gridSize = Number(encounter.map.grid_size) || 20

        const tokens: MapToken[] = [
          ...(encounter.monsters || []).map((m: any) => ({
            id: String(m.id || uuidv4()),
            type: 'monster' as const,
            name: String(m.name || 'Unknown Monster'),
            stats: m.stats || {},
            image: String(m.image || ''),
            ...parseCoordinate(String(m.starting_coordinates || 'B2')),
          })),
          ...(encounter.pcs || []).map((p: any) => ({
            id: String(p.id || uuidv4()),
            type: 'pc' as const,
            name: String(p.name || 'Unknown PC'),
            stats: p.stats || {},
            image: String(p.image || ''),
            ...parseCoordinate(String(p.starting_coordinates || 'A1')),
          })),
        ]

        assignPositions(tokens, gridSize)

        // reflect back into entities
        const byId = new Map(tokens.map(t => [t.id, t]))
        ;(encounter.monsters || []).forEach((m: any) => {
          const t = byId.get(String(m.id))
          if (t) m.starting_coordinates = formatCoordinate(t.x, t.y)
        })
        ;(encounter.pcs || []).forEach((p: any) => {
          const t = byId.get(String(p.id))
          if (t) p.starting_coordinates = formatCoordinate(t.x, t.y)
        })

        // initiative
        const init: Record<string, number> = {}
        const everyone = ([] as any[]).concat(encounter.monsters || [], encounter.pcs || [])
        everyone.forEach((c: any) => { const id = String(c.id || c.name || uuidv4()); init[id] = randInt(1,20) })

        // persist encounter entities and map attributes
        await supabase.from('battles').update({
          monsters: encounter.monsters || [],
          allies: encounter.pcs || [],
          initiative: init,
          log: [String(encounter.log_message || 'Battle generated.')],
        }).eq('id', battleId)

        const mapPatch: Partial<MapData> = {
          grid_size: gridSize,
          terrain_data: encounter.map.terrain_features && typeof encounter.map.terrain_features === 'object' ? encounter.map.terrain_features : {},
          tokens,
          updated_at: new Date().toISOString(),
        }
        if (mapRefForBattle) {
          await supabase.from('maps').update(mapPatch as any).eq('session_id', sessionId)
        } else {
          // If we couldn't set map_ref earlier, try to create the map now (best-effort)
          await supabase.from('maps').upsert({ session_id: sessionId, background_image, ...mapPatch } as any, { onConflict: 'session_id' })
          await supabase.from('battles').update({ map_ref: sessionId }).eq('id', battleId)
          mapRefForBattle = sessionId
        }

        await appendLog('Encounter generated.')
      } else {
        partial = true
        warnings.push('Encounter generation missing required fields.')
        await appendLog('Encounter generation failed; no monsters/pcs in response.')
      }
    } else {
      partial = true
      warnings.push(`Encounter generation failed: ${llmResult.reason?.message || String(llmResult.reason)}`)
      await appendLog('Encounter generation failed.')
    }

    // 6) Load latest rows and return
    const bRes = await supabase.from('battles').select('*').eq('id', battleId!).maybeSingle()
    const mRes = await supabase.from('maps').select('*').eq('session_id', sessionId).maybeSingle()

    return NextResponse.json({
      ok: true,
      partial,
      warnings,
      battle: bRes.data || null,
      map: mRes.data || null,
      message: partial ? 'Battle created with partial data.' : 'Battle scenario generated.',
    })
  } catch (error: any) {
    // If we managed to create a stub battle, return partial success instead of 500
    if (battleId) {
      return NextResponse.json({
        ok: true,
        partial: true,
        warnings: [`Error: ${error?.message || String(error)}`],
        battle: { id: battleId },
        map: null,
        message: 'Battle created with partial data (error occurred).',
      })
    }
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
