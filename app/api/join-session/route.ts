import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabaseAdmin"
import type { SessionParticipant } from "@/lib/types"
import { auth } from "@clerk/nextjs/server"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const { userId: clerkUserId, getToken } = await auth()

  if (!clerkUserId || !getToken) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 })
  }

  try {
    const sessionToken = await getToken({ template: "supabase" })
    if (!sessionToken) {
      return NextResponse.json({ error: "Authentication token missing." }, { status: 401 })
    }
    const supabase = createServerSupabaseClient(sessionToken)
    const { sessionId } = await req.json()

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required." }, { status: 400 })
    }

    // Must join an existing session; do not auto-create
    const sessionRes = await supabase
      .from("sessions")
      .select("id, campaign_id, participants")
      .eq("id", sessionId)
      .maybeSingle()

    if (sessionRes.error) {
      return NextResponse.json({ error: sessionRes.error.message }, { status: 500 })
    }
    if (!sessionRes.data) {
      return NextResponse.json({ error: `Session "${sessionId}" not found. Ask the DM to create it.` }, { status: 404 })
    }

    const session = sessionRes.data as { id: string; campaign_id: string; participants: any[] | null }

    // Fetch campaign to check owner and members
    const campaignRes = await supabase
      .from("campaigns")
      .select("id, owner_id, settings")
      .eq("id", session.campaign_id)
      .maybeSingle()

    if (campaignRes.error || !campaignRes.data) {
      return NextResponse.json({ error: "Campaign not found for this session." }, { status: 404 })
    }

    const isOwner = campaignRes.data.owner_id === clerkUserId
    const members: string[] = Array.isArray((campaignRes.data.settings as any)?.members)
      ? (campaignRes.data.settings as any).members
      : []

    const alreadyParticipant = (session.participants || []).some((p: any) => p.userId === clerkUserId)
    const allowedToJoin = isOwner || alreadyParticipant || members.includes(clerkUserId)

    if (!allowedToJoin) {
      return NextResponse.json(
        {
          error: "You are not a member of this campaign. Ask the DM to invite you before joining this session.",
        },
        { status: 403 },
      )
    }

    if (alreadyParticipant) {
      return NextResponse.json({ message: "You are already in this session." })
    }

    // Add as Player
    const newParticipants: SessionParticipant[] = [
      ...(Array.isArray(session.participants) ? session.participants : []),
      { userId: clerkUserId, role: isOwner ? "DM" : "Player" },
    ]

    const upd = await supabase
      .from("sessions")
      .update({ participants: newParticipants })
      .eq("id", sessionId)
      .select("id, participants")
      .single()

    if (upd.error) {
      return NextResponse.json({ error: upd.error.message }, { status: 500 })
    }

    return NextResponse.json({ message: "Joined session successfully.", session: upd.data })
  } catch (error: any) {
    console.error("API: join-session: Caught error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
