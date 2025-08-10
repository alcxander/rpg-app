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

  // Robust auth retrieval for Route Handlers
  const { userId, sessionId } = getAuth(req)
  const cookieLen = (req.headers.get("cookie") || "").length
  const hasAuthz = !!req.headers.get("authorization")
  console.log("[api/campaigns] GET start", { reqId, hasUser: !!userId, sessionId, cookieLen, hasAuthz })

  if (!userId) {
    console.warn("[api/campaigns] GET unauthorized", { reqId })
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createAdminClient()

  try {
    // 1) Campaigns owned by user (canonical field: owner_id)
    const { data: owned, error: ownedErr } = await supabase
      .from("campaigns")
      .select("id,name,owner_id,access_enabled,created_at")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false })

    console.log("[api/campaigns] owned result", {
      reqId,
      count: owned?.length ?? 0,
      error: ownedErr?.message || null,
    })

    // 2) Best-effort membership via sessions.participants
    //    We don't know the exact column type in your DB, so try a couple of safe strategies:
    //    a) 'cs' with a JSON payload like [{ userId: "..." }] (used previously in your app)
    //    b) fallback: 'cs' with just the userId string (if participants is an array of raw strings)
    let participantCampaignIds: string[] = []

    // Strategy a)
    try {
      const containsValue = JSON.stringify([{ userId }])
      const sessionsRes = await supabase
        .from("sessions")
        .select("campaign_id")
        .filter("participants", "cs", containsValue)

      console.log("[api/campaigns] sessions (strategy a)", {
        reqId,
        count: sessionsRes.data?.length ?? 0,
        error: sessionsRes.error?.message || null,
      })

      if (!sessionsRes.error && sessionsRes.data?.length) {
        participantCampaignIds = sessionsRes.data.map((s: any) => s.campaign_id).filter(Boolean)
      } else {
        // Strategy b)
        const sessionsResB = await supabase
          .from("sessions")
          .select("campaign_id")
          .filter("participants", "cs", JSON.stringify([userId]))

        console.log("[api/campaigns] sessions (strategy b)", {
          reqId,
          count: sessionsResB.data?.length ?? 0,
          error: sessionsResB.error?.message || null,
        })

        if (!sessionsResB.error && sessionsResB.data?.length) {
          participantCampaignIds = sessionsResB.data.map((s: any) => s.campaign_id).filter(Boolean)
        }
      }
    } catch (e: any) {
      console.warn("[api/campaigns] sessions query exception", { reqId, message: e?.message })
    }

    const ownedIds = (owned || []).map((c) => c.id)
    const uniqueIds = Array.from(new Set<string>([...ownedIds, ...participantCampaignIds])).filter(Boolean)

    // If no membership campaigns resolved, return owned immediately to avoid an extra query
    if (uniqueIds.length === 0) {
      console.log("[api/campaigns] GET done (owned only)", {
        reqId,
        total: owned?.length ?? 0,
        ms: Date.now() - t0,
      })
      return NextResponse.json({ campaigns: owned || [] })
    }

    // Merge owned + member campaigns
    const { data: campaigns, error: memberErr } = await supabase
      .from("campaigns")
      .select("id,name,owner_id,access_enabled,created_at")
      .in("id", uniqueIds)

    console.log("[api/campaigns] merged result", {
      reqId,
      total: campaigns?.length ?? 0,
      error: memberErr?.message || null,
      ms: Date.now() - t0,
    })

    if (memberErr) {
      return NextResponse.json({ error: memberErr.message }, { status: 500 })
    }

    return NextResponse.json({ campaigns: campaigns || [] })
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
  console.log("[api/campaigns] POST start", { reqId, hasUser: !!userId, sessionId })

  if (!userId) {
    console.warn("[api/campaigns] POST unauthorized", { reqId })
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: any
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
