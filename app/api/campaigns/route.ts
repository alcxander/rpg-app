import { NextResponse, type NextRequest } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

export const runtime = "nodejs"

function rid() {
  return Math.random().toString(36).slice(2, 8)
}

/**
 * GET /api/campaigns
 * Returns campaigns owned by the current user.
 */
export async function GET(req: NextRequest) {
  const reqId = rid()
  try {
    const { userId, sessionId } = getAuth(req)
    console.log("[api/campaigns] GET start", { reqId, hasUser: !!userId, sessionId, path: req.nextUrl.pathname })

    if (!userId) {
      console.warn("[api/campaigns] GET unauthorized", { reqId })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("campaigns")
      .select("id,name,owner_id,access_enabled,created_at")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[api/campaigns] GET query error", { reqId, error: error.message })
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }

    console.log("[api/campaigns] GET done", { reqId, count: data?.length ?? 0 })
    return NextResponse.json({ campaigns: data ?? [] })
  } catch (e: any) {
    console.error("[api/campaigns] GET exception", { reqId, message: e?.message })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/campaigns
 * Creates a new campaign owned by the current user.
 * Body: { name: string }
 */
export async function POST(req: NextRequest) {
  const reqId = rid()
  try {
    const { userId, sessionId } = getAuth(req)
    console.log("[api/campaigns] POST start", { reqId, hasUser: !!userId, sessionId, path: req.nextUrl.pathname })

    if (!userId) {
      console.warn("[api/campaigns] POST unauthorized", { reqId })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let name = ""
    try {
      const body = await req.json()
      name = String(body?.name || "").trim()
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }
    if (!name) {
      return NextResponse.json({ error: "name required" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("campaigns")
      .insert({ name, owner_id: userId, access_enabled: true })
      .select("id,name,owner_id,access_enabled,created_at")
      .single()

    if (error || !data) {
      console.error("[api/campaigns] POST insert error", { reqId, error: error?.message || "unknown" })
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }

    console.log("[api/campaigns] POST done", { reqId, id: data.id })
    return NextResponse.json({ campaign: data }, { status: 201 })
  } catch (e: any) {
    console.error("[api/campaigns] POST exception", { reqId, message: e?.message })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
