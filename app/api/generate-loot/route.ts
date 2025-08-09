import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createServerSupabaseClient } from "@/lib/supabaseAdmin"
import { generateContent } from "@/lib/llmClient"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const { userId, getToken } = await auth()
  if (!userId || !getToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const token = await getToken({ template: "supabase" })
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const {
      sessionId,
      useMapContext,
      partyLevel,
      partySize,
      difficulty, // e.g., "Easy" | "Medium" | "Hard" | "Deadly" | CR like "CR 5"
      rarityPreference, // "auto" | "low" | "mid" | "high"
      partyLoot, // boolean => use Xanathar's party loot tables
      exactLevel, // boolean => "Exact Level" handling
    } = await req.json()

    const supabase = createServerSupabaseClient(token)

    let contextText = ""
    if (useMapContext && sessionId) {
      const mapRes = await supabase.from("maps").select("tokens").eq("session_id", sessionId).maybeSingle()
      const tokens = Array.isArray(mapRes.data?.tokens) ? (mapRes.data!.tokens as any[]) : []
      const monsters = tokens.filter((t) => t.type === "monster")
      const players = tokens.filter((t) => t.type === "pc")
      const monsterNames = monsters.map((m) => m.name).slice(0, 12)
      contextText = `
Map context:
- Players on map: ${players.length}
- Monsters on map: ${monsters.length}
- Monsters sample: ${monsterNames.join(", ")}
Please scale values and rarity to this context if it improves results.
`
    } else {
      contextText = "Map context not used. Use only the provided inputs."
    }

    // Ask for JSON result so the client can present it nicely. Uses AI SDK [^1].
    const prompt = `
You are a TTRPG loot generator. Return JSON ONLY. Do not include markdown fences.

Inputs:
- Party level: ${Number(partyLevel) || "unknown"}
- Party size: ${Number(partySize) || "unknown"}
- Difficulty or CR: ${String(difficulty || "Medium")}
- Rarity preference: ${String(rarityPreference || "auto")}
- Party loot mode (Xanathar's Guide to Everything, pp. 135-136): ${partyLoot ? "ON" : "OFF"}
- Exact Level handling: ${exactLevel ? "ON" : "OFF"}
${contextText}

Rules:
- Always return a mix with possible zero quantities for categories:
  - trinkets, coins, consumables, scrolls, weapons_gear, adventuring_gear
- Quantities and quality should generally scale with party level/size and difficulty (or map context if provided).
- If partyLoot=ON, structure items as a single party hoard; otherwise as encounter loot. If "Exact Level" is ON, include a proportional number of items for partially-completed tiers per Xanathar's guidance.
- Prefer lower rarity at low levels, increasing with higher challenge/level. "rarity_preference" can nudge item rarities up/down.

JSON shape:
{
  "summary": "1-2 sentence summary",
  "coins": { "cp": number, "sp": number, "gp": number, "pp": number },
  "trinkets": [{ "name": string, "qty": number, "note"?: string }],
  "consumables": [{ "name": string, "qty": number, "rarity"?: string, "note"?: string }],
  "scrolls": [{ "name": string, "qty": number, "rarity"?: string, "note"?: string }],
  "weapons_gear": [{ "name": string, "qty": number, "rarity"?: string, "note"?: string }],
  "adventuring_gear": [{ "name": string, "qty": number, "note"?: string }]
}
Ensure valid JSON and omit any commentary.
`

    const text = await generateContent(prompt) // [^1]

    let cleaned = text.trim()
    if (cleaned.startsWith("```json")) cleaned = cleaned.slice("```json".length)
    if (cleaned.startsWith("```")) cleaned = cleaned.slice(3)
    if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3)
    cleaned = cleaned.trim()

    let parsed: any
    try {
      parsed = JSON.parse(cleaned)
    } catch (e: any) {
      return NextResponse.json(
        { error: "Failed to parse loot JSON from model", raw: cleaned.slice(0, 800) },
        { status: 500 },
      )
    }

    return NextResponse.json({ loot: parsed })
  } catch (e: any) {
    console.error("[generate-loot] error:", e?.message || e)
    return NextResponse.json({ error: e?.message || "Internal error" }, { status: 500 })
  }
}
