import { NextResponse, type NextRequest } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

function rid() {
  return Math.random().toString(36).slice(2, 8)
}

/**
 * GET /api/campaigns
 * Returns campaigns the current user owns (owner_id). Verbose logs included.
 */
export async function GET(req: NextRequest) {
  const reqId = rid()
  const { userId, sessionId } = getAuth(req)
  const cookieLen = req.headers.get("cookie")?.length || 0

  console.log("[api/campaigns] GET start", { reqId, hasUser: !!userId, sessionId, cookieLen })
  if (!userId) {
    console.warn("[api/campaigns] unauthorized", { reqId })
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createAdminClient()

  try {
    // Owned campaigns (owner is the DM)
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

    // If you’d like to support member campaigns, add a safe attempt here.
    // We’ll skip for now to avoid schema mismatches and keep it stable.
    const campaigns = owned || []

    console.log("[api/campaigns] GET done", { reqId, total: campaigns.length })
    return NextResponse.json({ campaigns })
  } catch (e: any) {
    console.error("[api/campaigns] GET exception", { reqId, message: e?.message })
    return NextResponse.json({ error: e?.message || "Internal Server Error" }, { status: 500 })
  }
}

/**
 * POST /api/campaigns
 * Creates a new campaign owned by the current user.
 * Body: { name: string }
 */
export async function POST(req: NextRequest) {
  const reqId = rid()
  const { userId, sessionId } = getAuth(req)
  console.log("[api/campaigns] POST start", { reqId, hasUser: !!userId, sessionId })
  if (!userId) {
    console.warn("[api/campaigns] unauthorized", { reqId })
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const bodyText = await req.text()
    const body = bodyText ? JSON.parse(bodyText) : {}
    const name: string | undefined = body?.name
    console.log("[api/campaigns] POST body", { reqId, hasName: !!name })
    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "name required" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("campaigns")
      .insert({ name, owner_id: userId, access_enabled: true })
      .select("id,name,owner_id,access_enabled,created_at")
      .single()
    console.log("[api/campaigns] POST insert", { reqId, campaignId: data?.id || null, error: error?.message || null })

    if (error || !data) {
      return NextResponse.json({ error: error?.message || "Insert failed" }, { status: 500 })
    }

    console.log("[api/campaigns] POST done", { reqId })
    return NextResponse.json({ campaign: data }, { status: 201 })
  } catch (e: any) {
    console.error("[api/campaigns] POST exception", { reqId, message: e?.message })
    return NextResponse.json({ error: e?.message || "Internal Server Error" }, { status: 500 })
  }
}
