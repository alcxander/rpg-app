import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

// GET /api/players/gold?campaignId=...&playerId=...
// DM/Owner can read all player gold for campaign, or specific player gold
export async function GET(req: NextRequest) {
  const reqId = Math.random().toString(36).substring(7)

  try {
    console.log("[api/players/gold] GET start", { reqId })

    const { userId, getToken } = await auth()
    if (!userId || !getToken) {
      console.log("[api/players/gold] GET unauthorized", { reqId })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const campaignId = req.nextUrl.searchParams.get("campaignId")
    const playerId = req.nextUrl.searchParams.get("playerId")

    if (!campaignId) {
      console.log("[api/players/gold] GET missing campaignId", { reqId })
      return NextResponse.json({ error: "campaignId required" }, { status: 400 })
    }

    console.log("[api/players/gold] GET processing", { reqId, campaignId, playerId, userId })

    const supabase = createAdminClient()

    // Verify campaign exists
    const { data: camp, error: cErr } = await supabase
      .from("campaigns")
      .select("id, owner_id")
      .eq("id", campaignId)
      .single()

    if (cErr || !camp) {
      console.log("[api/players/gold] GET campaign not found", { reqId, error: cErr })
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    let hasDMPrivileges = false
    let accessReason = ""

    if (camp.owner_id === userId) {
      hasDMPrivileges = true
      accessReason = "campaign owner"
    } else {
      // Check if user is a DM in this campaign
      const { data: membership, error: memberError } = await supabase
        .from("campaign_members")
        .select("role")
        .eq("campaign_id", campaignId)
        .eq("user_id", userId)
        .single()

      if (membership && membership.role === "DM") {
        hasDMPrivileges = true
        accessReason = "campaign DM"
      } else if (memberError && memberError.code !== "PGRST116") {
        console.error("[api/players/gold] GET membership check error", { reqId, error: memberError })
      }
    }

    // Allow players to view their own gold
    if (!hasDMPrivileges && playerId === userId) {
      console.log("[api/players/gold] GET player viewing own gold", { reqId, userId })

      const { data, error } = await supabase
        .from("players_gold")
        .select("player_id, gold_amount")
        .eq("campaign_id", campaignId)
        .eq("player_id", userId)

      if (error) {
        console.error("[api/players/gold] GET own gold error", { reqId, error })
        return NextResponse.json({ error: "Failed to load gold" }, { status: 500 })
      }
      return NextResponse.json({ rows: data || [] })
    }

    if (!hasDMPrivileges) {
      console.log("[api/players/gold] GET access denied", { reqId, userId, accessReason })
      return NextResponse.json({ error: "Forbidden - requires DM privileges" }, { status: 403 })
    }

    console.log("[api/players/gold] GET access granted", { reqId, accessReason })

    // First, get all campaign members who are players
    let membersQuery = supabase
      .from("campaign_members")
      .select("user_id, role")
      .eq("campaign_id", campaignId)
      .in("role", ["Player", "DM"]) // Include both players and DMs

    if (playerId) {
      membersQuery = membersQuery.eq("user_id", playerId)
    }

    const { data: members, error: membersError } = await membersQuery

    if (membersError) {
      console.error("[api/players/gold] Members query error:", { reqId, error: membersError })
      return NextResponse.json({ error: "Failed to load campaign members" }, { status: 500 })
    }

    if (!members || members.length === 0) {
      console.log("[api/players/gold] GET no members found", { reqId })
      return NextResponse.json({ rows: [] })
    }

    // Get user details for all members
    const userIds = members.map((m) => m.user_id)
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, name, clerk_id")
      .in("clerk_id", userIds) // Use clerk_id for the lookup since user_id in campaign_members is clerk_id

    if (usersError) {
      console.error("[api/players/gold] Users query error:", { reqId, error: usersError })
      return NextResponse.json({ error: "Failed to load user details" }, { status: 500 })
    }

    // Get gold amounts for all members
    const { data: goldData, error: goldError } = await supabase
      .from("players_gold")
      .select("player_id, gold_amount")
      .eq("campaign_id", campaignId)
      .in("player_id", userIds)

    if (goldError) {
      console.error("[api/players/gold] Gold query error:", { reqId, error: goldError })
      return NextResponse.json({ error: "Failed to load gold data" }, { status: 500 })
    }

    // Combine the data manually
    const formattedData = members.map((member: any) => {
      const user = users?.find((u) => u.clerk_id === member.user_id)
      const gold = goldData?.find((g) => g.player_id === member.user_id)

      return {
        player_id: member.user_id,
        gold_amount: gold?.gold_amount || 0,
        player_name: user?.name || null,
        role: member.role,
      }
    })

    console.log("[api/players/gold] GET success", {
      reqId,
      campaignId,
      memberCount: formattedData.length,
      accessReason,
    })

    return NextResponse.json({ rows: formattedData })
  } catch (error: any) {
    console.error("[api/players/gold] GET error", { reqId, error: error.message, stack: error.stack })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/players/gold
// DM/Owner can upsert a player's gold row
export async function POST(req: NextRequest) {
  const reqId = Math.random().toString(36).substring(7)

  try {
    console.log("[api/players/gold] POST start", { reqId })

    const { userId, getToken } = await auth()
    if (!userId || !getToken) {
      console.log("[api/players/gold] POST unauthorized", { reqId })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { playerId, campaignId, goldAmount } = await req.json().catch(() => ({}))
    if (!playerId || !campaignId || typeof goldAmount !== "number") {
      console.log("[api/players/gold] POST invalid params", { reqId, playerId, campaignId, goldAmount })
      return NextResponse.json({ error: "playerId, campaignId, goldAmount required" }, { status: 400 })
    }

    console.log("[api/players/gold] POST processing", { reqId, playerId, campaignId, goldAmount, userId })

    const supabase = createAdminClient()

    const { data: camp, error: cErr } = await supabase
      .from("campaigns")
      .select("owner_id")
      .eq("id", campaignId)
      .single()

    if (cErr || !camp) {
      console.log("[api/players/gold] POST campaign not found", { reqId, error: cErr })
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    let hasDMPrivileges = false
    let accessReason = ""

    if (camp.owner_id === userId) {
      hasDMPrivileges = true
      accessReason = "campaign owner"
    } else {
      // Check if user is a DM in this campaign
      const { data: membership, error: memberError } = await supabase
        .from("campaign_members")
        .select("role")
        .eq("campaign_id", campaignId)
        .eq("user_id", userId)
        .single()

      if (membership && membership.role === "DM") {
        hasDMPrivileges = true
        accessReason = "campaign DM"
      } else if (memberError && memberError.code !== "PGRST116") {
        console.error("[api/players/gold] POST membership check error", { reqId, error: memberError })
      }
    }

    if (!hasDMPrivileges) {
      console.log("[api/players/gold] POST access denied", { reqId, userId, accessReason })
      return NextResponse.json({ error: "Forbidden - requires DM privileges" }, { status: 403 })
    }

    console.log("[api/players/gold] POST access granted", { reqId, accessReason })

    // Upsert player's gold
    const safeGold = Math.max(0, Math.round(Number(goldAmount) * 100) / 100)

    const { data: existing } = await supabase
      .from("players_gold")
      .select("id")
      .eq("player_id", playerId)
      .eq("campaign_id", campaignId)
      .maybeSingle()

    const row = {
      id: existing?.id,
      player_id: playerId,
      campaign_id: campaignId,
      gold_amount: safeGold,
      updated_at: new Date().toISOString(),
    }

    const { error: upErr } = existing?.id
      ? await supabase.from("players_gold").update(row).eq("id", existing.id)
      : await supabase.from("players_gold").insert(row)

    if (upErr) {
      console.error("[api/players/gold] POST upsert error", { reqId, error: upErr })
      return NextResponse.json({ error: "Failed to update gold" }, { status: 500 })
    }

    console.log("[api/players/gold] POST success", { reqId, playerId, goldAmount: safeGold, accessReason })
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error("[api/players/gold] POST error", { reqId, error: error.message, stack: error.stack })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
