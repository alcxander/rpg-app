import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createClient } from "@/lib/supabaseAdmin"

export const runtime = "nodejs"

export async function GET() {
  try {
    const { userId } = auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createClient()
    // List campaigns where the user is the DM. You can extend to include membership as needed.
    const { data, error } = await supabase
      .from("campaigns")
      .select("id, name, access_enabled, dm_id")
      .eq("dm_id", userId)
      .order("created_at", { ascending: false })

    if (error) throw error

    return NextResponse.json({ campaigns: data ?? [] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const { userId, getToken } = await auth()
  if (!userId || !getToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const token = await getToken({ template: "supabase" })
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const name = String(body?.name || "").trim()
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 })

  const supabase = createClient()
  const { data, error } = await supabase
    .from("campaigns")
    .insert({ name, owner_id: userId, settings: { members: [] } })
    .select("id, name")
    .single()

  if (error) {
    console.error("[api/campaigns] POST error:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  console.log("[api/campaigns] Created campaign", data?.id)
  return NextResponse.json({ campaign: data })
}
