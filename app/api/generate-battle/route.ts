import { NextResponse } from 'next/server';
import { generateContent } from '@/lib/llmClient';
import { createServerSupabaseClient } from '@/lib/supabaseAdmin';
import { MapData, MapToken, Battle } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import { parseCoordinate } from '@/lib/utils';
import { auth } from '@clerk/nextjs/server';

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
  console.log(`[generate-battle] Calling generate-map: ${url}`)
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Forward cookies to satisfy Clerk middleware (even though we exempted the route as well)
      'Cookie': req.headers.get('cookie') || '',
    },
    body: JSON.stringify({ prompt }),
  })
  const text = await res.text()
  let parsed: any = {}
  try { parsed = JSON.parse(text) } catch { /* ignore */ }

  console.log(`[generate-battle] generate-map status=${res.status} requestId=${parsed?.requestId || 'n/a'} duration=${parsed?.durationMs || 'n/a'}`)
  if (!res.ok) {
    console.warn('[generate-battle] generate-map failed: ', text.slice(0, 500))
    throw new Error(parsed?.error || 'Failed to generate map image')
  }
  return parsed.image as string
}

async function callStabilityDirect(prompt: string) {
  const key = process.env.STABILITY_API_KEY
  if (!key) throw new Error('STABILITY_API_KEY not set')

  const form = new FormData()
  form.append('prompt', prompt)
  form.append('aspect_ratio', '1:1')
  form.append('output_format', 'png')

  const started = Date.now()
  // SD3: Accept must be image/*
  const res = await fetch('https://api.stability.ai/v2beta/stable-image/generate/sd3', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, Accept: 'image/*' },
    body: form,
  })
  const ms = Date.now() - started
  console.log(`[generate-battle] direct Stability status=${res.status} in ${ms}ms`)
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Stability direct error ${res.status}: ${errText.slice(0, 500)}`)
  }
  const arrayBuf = await res.arrayBuffer()
  const base64 = Buffer.from(arrayBuf).toString('base64')
  return `data:image/png;base64,${base64}`
}

async function generateBackgroundImage(prompt: string, req: Request) {
  try {
    return await callGenerateMapInternal(prompt, req)
  } catch (e) {
    console.warn('[generate-battle] Internal generate-map failed; falling back to direct Stability call.', e)
    return await callStabilityDirect(prompt)
  }
}

export async function POST(req: Request) {
  const { userId: clerkUserId, sessionId: clerkSessionId, getToken } = await auth();

  if (!clerkUserId || !clerkSessionId || !getToken) {
    console.error('Clerk authentication failed: No userId or sessionId found.');
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const sessionToken = await getToken({ template: 'supabase' });
    if (!sessionToken) {
      console.error('Failed to get Supabase session token from Clerk.');
      return NextResponse.json({ error: 'Authentication token missing.' }, { status: 401 });
    }

    const supabase = createServerSupabaseClient(sessionToken);
    const { partyLevel, partySize, challengeRating, locationTheme, additionalNotes, sessionId } = await req.json();

    if (!sessionId) {
      console.error('Missing required fields for battle generation: sessionId');
      return NextResponse.json({ error: 'Session ID is required.' }, { status: 400 });
    }

    const { data: sessionData, error: sessionCheckError } = await supabase
      .from('sessions')
      .select('id, participants')
      .eq('id', sessionId)
      .maybeSingle();

    if (sessionCheckError || !sessionData) {
      console.error(`Session ${sessionId} not found or accessible during battle generation. Supabase Error:`, sessionCheckError);
      return NextResponse.json({ error: `Session "${sessionId}" not found. Please ensure you have joined a valid session.` }, { status: 404 });
    }

    const isParticipant = (sessionData.participants as any[] || []).some(p => p.userId === clerkUserId);
    if (!isParticipant) {
      console.error(`User ${clerkUserId} is not a participant in session ${sessionId}.`);
      return NextResponse.json({ error: `User ${clerkUserId} is not a participant in session ${sessionId}.` }, { status: 403 });
    }

    // Encounter JSON via AI SDK [^1]
    const dataPrompt = `
      You are a TTRPG encounter designer. Create a JSON ONLY response for a D&D-like encounter.

      Goals:
      - Use a 20x20 grid ("grid_size": 20).
      - Include monsters and pcs with stats and "starting_coordinates" using A1..T20.
      - Include "terrain_features" (object keyed by coordinates with descriptions).
      - Provide a "log_message" as the first activity line.

      Diversity requirements for monsters:
      - Include 3 to 5 distinct monster SPECIES suitable for the terrain theme (${locationTheme}).
      - Avoid repeating the same species; mix combat roles (skirmisher, artillery, controller, brute, leader).
      - Keep overall difficulty near ${challengeRating}.

      JSON Structure:
      {
        "map": {
          "grid_size": 20,
          "terrain_features": {
            "A1": "Dense Forest",
            "C3": "Rocky Outcrop"
          }
        },
        "monsters": [
          { "id": "monster-1", "name": "Goblin Skirmisher", "stats": {"HP": 10, "AC": 13}, "starting_coordinates": "B2", "image": "" }
        ],
        "pcs": [
          { "id": "pc-1", "name": "Fighter", "stats": {"HP": 25, "AC": 16}, "starting_coordinates": "A1", "image": "" }
        ],
        "log_message": "An ambush springs from the brush!"
      }

      Parameters:
      - party level: ${partyLevel}, party size: ${partySize}, target difficulty: ${challengeRating}
      - terrain theme: ${locationTheme}
      ${additionalNotes ? `Notes: ${additionalNotes}` : ''}
    `;

    const llmResponse = await generateContent(dataPrompt); // [^1]

    let cleaned = llmResponse.trim();
    if (cleaned.startsWith('\`\`\`json')) cleaned = cleaned.slice('\`\`\`json'.length);
    if (cleaned.endsWith('\`\`\`')) cleaned = cleaned.slice(0, -3);
    cleaned = cleaned.trim();

    let battleData: any;
    try {
      battleData = JSON.parse(cleaned);
    } catch (e: any) {
      throw new Error(`Failed to parse LLM response: ${e.message}. Raw: ${cleaned.slice(0, 300)}...`);
    }

    if (!battleData?.map || !battleData?.monsters || !battleData?.pcs) {
      throw new Error('LLM response missing map, monsters, or pcs.');
    }

    const mapTokens: MapToken[] = [
      ...(battleData.monsters || []).map((m: any) => ({
        id: String(m.id || uuidv4()),
        type: 'monster',
        name: String(m.name || 'Unknown Monster'),
        stats: m.stats || {},
        image: String(m.image || ''),
        ...parseCoordinate(String(m.starting_coordinates || 'B2')),
      })),
      ...(battleData.pcs || []).map((p: any) => ({
        id: String(p.id || uuidv4()),
        type: 'pc',
        name: String(p.name || 'Unknown PC'),
        stats: p.stats || {},
        image: String(p.image || ''),
        ...parseCoordinate(String(p.starting_coordinates || 'A1')),
      })),
    ];

    // Stability image (or fallback)
    const imagePrompt = `
      Top-down 2D tabletop RPG battle map, vibrant colors, high-contrast grid-friendly details.
      Theme: ${locationTheme}. Avoid text labels or UI. Centered composition. Bright, readable, vivid, game-ready.
      Include terrain flavor appropriate to the theme with a variety of obstacles and cover.
    `;
    let backgroundImage: string | null = null;
    try {
      backgroundImage = await generateBackgroundImage(imagePrompt, req);
    } catch (e) {
      console.warn('Map image generation failed, falling back to /maps/1.jpg', e);
      backgroundImage = null; // CanvasMap will fall back to local manifest or /maps/1.jpg
    }

    const { name, slug } = randomThreeWordName();

    const newMap: MapData = {
      session_id: sessionId,
      grid_size: Number(battleData.map.grid_size) || 20,
      terrain_data: battleData.map.terrain_features && typeof battleData.map.terrain_features === 'object'
        ? battleData.map.terrain_features
        : {},
      tokens: mapTokens,
      background_image: backgroundImage,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const newBattle: Battle & { name?: string; slug?: string; background_image?: string | null } = {
      id: uuidv4(),
      session_id: sessionId,
      map_ref: sessionId,
      monsters: battleData.monsters || [],
      allies: battleData.pcs || [],
      log: [String(battleData.log_message || 'Battle generated.')],
      created_at: new Date().toISOString(),
      name,
      slug,
      background_image: backgroundImage ?? null,
    };

    const { error: mapUpsertError } = await supabase
      .from('maps')
      .upsert(newMap, { onConflict: 'session_id' });

    if (mapUpsertError) {
      console.error('Error upserting map to Supabase:', mapUpsertError);
      throw new Error(`Failed to save map data to database: ${mapUpsertError.message}`);
    }

    const { error: battleInsertError } = await supabase
      .from('battles')
      .insert(newBattle as any);

    if (battleInsertError) {
      console.error('Error inserting battle to Supabase:', battleInsertError);
      throw new Error(`Failed to save battle data to database: ${battleInsertError.message}`);
    }

    console.log(`[generate-battle] Created battle "${name}" (${newBattle.id}) for session ${sessionId}`)

    return NextResponse.json({
      map: newMap,
      battle: newBattle,
      message: 'Battle scenario generated and saved successfully.',
    });
  } catch (error: any) {
    console.error('Caught error in generate-battle API route:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
