import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createClient } from "@/lib/supabaseAdmin"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const campaignId = params.id
  const { access_enabled } = await req.json()

  const supabase = createClient()

  const { data: camp, error: cErr } = await supabase
    .from("campaigns")
    .select("id, dm_id, access_enabled, name")
    .eq("id", campaignId)
    .single()

  if (cErr || !camp) return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
  if (camp.dm_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { data: updated, error: uErr } = await supabase
    .from("campaigns")
    .update({ access_enabled: Boolean(access_enabled) })
    .eq("id", campaignId)
    .select("id, name, access_enabled")
    .single()

  if (uErr) return NextResponse.json({ error: "Failed to update" }, { status: 500 })

  return NextResponse.json({ ok: true, campaign: updated })
}
