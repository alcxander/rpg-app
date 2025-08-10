import { NextResponse, type NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

export async function GET(_req: NextRequest) {
  const t0 = Date.now()
  const { userId } = auth()
  const reqId = Math.random().toString(36).slice(2, 8)
  console.log("[api/campaigns] GET start", { reqId, userId })

  if (!userId) {
    console.warn("[api/campaigns] unauthorized", { reqId })
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createAdminClient()

  try {
    // Owned campaigns
    const { data: owned, error: ownedErr } = await supabase
      .from("campaigns")
      .select("id,name,dm_id,access_enabled,created_at")
      .eq("dm_id", userId)
      .order("created_at", { ascending: false })
    console.log("[api/campaigns] owned", { reqId, count: owned?.length ?? 0, ownedErr })

    // Campaigns via sessions membership (best-effort if sessions table exists)
    let memberCampaigns: any[] = []
    const { data: sessions, error: sessErr } = await supabase
      .from("sessions")
      .select("id,campaign_id,participants")
      .contains("participants", [userId] as any) // participants is expected to be a JSON array
    console.log("[api/campaigns] sessions", { reqId, count: sessions?.length ?? 0, sessErr })

    if (!sessErr && sessions && sessions.length) {
      const ids = Array.from(new Set(sessions.map((s) => s.campaign_id).filter(Boolean)))
      if (ids.length) {
        const { data: member, error: memberErr } = await supabase
          .from("campaigns")
          .select("id,name,dm_id,access_enabled,created_at")
          .in("id", ids)
        console.log("[api/campaigns] member campaigns", { reqId, count: member?.length ?? 0, memberErr })
        memberCampaigns = member || []
      }
    }

    // Merge unique by id
    const map = new Map<string, any>()
    for (const c of owned || []) map.set(c.id, c)
    for (const c of memberCampaigns) map.set(c.id, c)
    const campaigns = Array.from(map.values())

    console.log("[api/campaigns] done", { reqId, total: campaigns.length, ms: Date.now() - t0 })
    return NextResponse.json({ campaigns })
  } catch (e: any) {
    console.error("[api/campaigns] exception", { reqId, message: e?.message, stack: e?.stack })
    return NextResponse.json({ error: e?.message || "Internal Server Error" }, { status: 500 })
  }
}
