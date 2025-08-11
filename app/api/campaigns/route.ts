import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * GET /api/campaigns
 * Returns campaigns owned by the current user.
 */
export async function GET(req: NextRequest) {
  const reqId = Math.random().toString(36).slice(2, 8);
  try {
    const { userId, sessionId } = auth();
    console.log("[api/campaigns] GET start", { reqId, hasUser: !!userId, sessionId });

    if (!userId) {
      console.warn("[api/campaigns] GET unauthorized", { reqId });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from("campaigns")
      .select("id,name,owner_id,access_enabled,created_at,updated_at")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[api/campaigns] GET query error", { reqId, error: error.message });
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    console.log("[api/campaigns] GET done", { reqId, count: data?.length ?? 0 });
    return NextResponse.json({ campaigns: data ?? [] }, { status: 200 });
  } catch (e: any) {
    console.error("[api/campaigns] GET exception", e?.message || e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/campaigns
 * Creates a campaign with the current user as owner.
 * Body: { name?: string }
 */
export async function POST(req: NextRequest) {
  const reqId = Math.random().toString(36).slice(2, 8);
  try {
    const { userId, sessionId } = auth();
    console.log("[api/campaigns] POST start", { reqId, hasUser: !!userId, sessionId });

    if (!userId) {
      console.warn("[api/campaigns] POST unauthorized", { reqId });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({} as any));
    const name = (body?.name as string) || "New Campaign";

    const { data, error } = await supabaseAdmin
      .from("campaigns")
      .insert({ name, owner_id: userId, access_enabled: true })
      .select("id,name,owner_id,access_enabled,created_at,updated_at")
      .single();

    if (error) {
      console.error("[api/campaigns] POST insert error", { reqId, error: error.message });
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    console.log("[api/campaigns] POST done", { reqId, id: data?.id });
    return NextResponse.json({ campaign: data }, { status: 201 });
  } catch (e: any) {
    console.error("[api/campaigns] POST exception", e?.message || e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
