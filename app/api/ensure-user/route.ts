import { NextResponse } from "next/server"
import { auth, currentUser } from "@clerk/nextjs/server"
import { createServerSupabaseClient } from "@/lib/supabaseAdmin"

export const runtime = "nodejs"

export async function POST() {
  const { userId, getToken } = await auth()
  if (!userId || !getToken) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }
  const token = await getToken({ template: "supabase" })
  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const supabase = createServerSupabaseClient(token)
    const clerkUser = await currentUser()
    const name =
      clerkUser?.fullName ||
      clerkUser?.username ||
      clerkUser?.primaryEmailAddress?.emailAddress ||
      `User ${userId.substring(0, 8)}`

    // Upsert our user row; policy allows user to insert/update their own row
    const { error } = await supabase.from("users").upsert(
      {
        id: userId,
        clerk_id: userId,
        name: String(name),
      },
      { onConflict: "id" },
    )

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || "Failed to ensure user" }, { status: 500 })
  }
}
