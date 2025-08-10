import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createClient } from "@/lib/supabaseAdmin"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const supabase = createClient()
  const id = params.id

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .select("id, owner_id, access_enabled")
    .eq("id", id)
    .single()
  if (error || !campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
  if (campaign.owner_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const enabled = Boolean(body?.access_enabled)

  const { data: updated, error: uErr } = await supabase
    .from("campaigns")
    .update({ access_enabled: enabled })
    .eq("id", id)
    .select("id, access_enabled")
    .single()

  if (uErr) return NextResponse.json({ error: "Failed to update" }, { status: 500 })
  return NextResponse.json({ ok: true, campaign: updated })
}
