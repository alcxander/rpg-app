import { NextResponse, type NextRequest } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

export const runtime = "nodejs"

function rid() {
  return Math.random().toString(36).slice(2, 8)
}

export async function GET(req: NextRequest) {
  const t0 = Date.now()
  const reqId = rid()

  // Auth (using getAuth(req) is the most reliable inside Route Handlers)
  const { userId, sessionId } = getAuth(req)
  const cookieLen = (req.headers.get("cookie") || "").length
  const authz = req.headers.get("authorization")
  console.log("[api/campaigns] GET start", { reqId, hasUser: !!userId, sessionId, cookieLen, hasAuthz: !!authz })

  if (!userId) {
    console.warn("[api/campaigns] unauthorized", { reqId })
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createAdminClient()

  try {
    // 1) Campaigns owned by user (owner_id is canonical; dm_id kept as fallback)
    const { data: owned, error: ownedErr } = await supabase
      .from("campaigns")
      .select("id,name,owner_id,dm_id,access_enabled,created_at")
      .or(`owner_id.eq.${userId},dm_id.eq.${userId}`)
      .order("created_at", { ascending: false })

    console.log("[api/campaigns] owned result", {
      reqId,
      count: owned?.length ?? 0,
      error: ownedErr?.message || null,
    })

    // 2) Best-effort: campaigns where user appears in sessions.participants
    //    This handles member access if your sessions store participant user IDs or objects.
    let memberCampaigns: any[] = []
    const { data: sessionsById, error: sessErrId } = await supabase
      .from("sessions")
      .select("campaign_id,participants")
      .contains("participants", [userId] as any) // participants contains "userId" as a raw value
    console.log("[api/campaigns] sessions contains userId", {
      reqId,
      count: sessionsById?.length ?? 0,
      error: sessErrId?.message || null,
    })

    if (!sessErrId && sessionsById?.length) {
      const ids = Array.from(new Set(sessionsById.map((s: any) => s.campaign_id).filter(Boolean)))
      if (ids.length) {
        const { data: member, error: memberErr } = await supabase
          .from("campaigns")
          .select("id,name,owner_id,dm_id,access_enabled,created_at")
          .in("id", ids)
        console.log("[api/campaigns] member campaigns", {
          reqId,
          count: member?.length ?? 0,
          error: memberErr?.message || null,
        })
        memberCampaigns = member || []
      }
    }

    // Merge unique by id
    const map = new Map<string, any>()
    for (const c of owned || []) map.set(c.id, c)
    for (const c of memberCampaigns) map.set(c.id, c)
    const campaigns = Array.from(map.values())

    console.log("[api/campaigns] GET done", { reqId, total: campaigns.length, ms: Date.now() - t0 })
    return NextResponse.json({ campaigns })
  } catch (e: any) {
    console.error("[api/campaigns] GET exception", {
      reqId,
      message: e?.message,
      stack: e?.stack?.split("\n").slice(0, 3).join(" | "),
    })
    return NextResponse.json({ error: e?.message || "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const t0 = Date.now()
  const reqId = rid()
  const { userId, sessionId } = getAuth(req)
  const cookieLen = (req.headers.get("cookie") || "").length
  console.log("[api/campaigns] POST start", { reqId, hasUser: !!userId, sessionId, cookieLen })

  if (!userId) {
    console.warn("[api/campaigns] POST unauthorized", { reqId })
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: any = null
  try {
    body = await req.json()
  } catch (e: any) {
    console.error("[api/campaigns] POST parse error", { reqId, message: e?.message })
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const name = String(body?.name || "").trim()
  if (!name) {
    console.warn("[api/campaigns] POST missing name", { reqId })
    return NextResponse.json({ error: "Name is required" }, { status: 400 })
  }

  const supabase = createAdminClient()

  try {
    const insertPayload = { name, owner_id: userId, access_enabled: true }
    console.log("[api/campaigns] POST inserting", { reqId, insertPayload })

    const { data, error } = await supabase
      .from("campaigns")
      .insert(insertPayload)
      .select("id,name,owner_id,access_enabled,created_at")
      .single()

    if (error) {
      console.error("[api/campaigns] POST insert error", { reqId, error: error.message })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log("[api/campaigns] POST done", { reqId, id: data?.id, ms: Date.now() - t0 })
    return NextResponse.json({ campaign: data })
  } catch (e: any) {
    console.error("[api/campaigns] POST exception", {
      reqId,
      message: e?.message,
      stack: e?.stack?.split("\n").slice(0, 3).join(" | "),
    })
    return NextResponse.json({ error: e?.message || "Internal Server Error" }, { status: 500 })
  }
}
