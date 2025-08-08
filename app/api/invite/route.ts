import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServerSupabaseClient } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

// GET: list campaigns owned by the user and campaigns where the user participates in any session
export async function GET() {
  const { userId, getToken } = await auth();
  if (!userId || !getToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const token = await getToken({ template: 'supabase' });
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServerSupabaseClient(token);

  const owned = await supabase.from('campaigns').select('id, name, updated_at').eq('owner_id', userId);
  if (owned.error) return NextResponse.json({ error: owned.error.message }, { status: 500 });

  const sessions = await supabase
    .from('sessions')
    .select('campaign_id')
    .contains('participants', [{ userId } as any]); // PostgREST JSON contains filter

  if (sessions.error) return NextResponse.json({ error: sessions.error.message }, { status: 500 });

  const campaignIds = Array.from(new Set([...(owned.data || []).map((c) => c.id), ...(sessions.data || []).map((s) => s.campaign_id)]));
  const campaigns =
    campaignIds.length > 0
      ? await supabase.from('campaigns').select('id, name, updated_at').in('id', campaignIds)
      : { data: [], error: null as any };

  if (campaigns.error) return NextResponse.json({ error: campaigns.error.message }, { status: 500 });

  return NextResponse.json({ campaigns: campaigns.data });
}

// POST: create campaign { name: string }
export async function POST(req: Request) {
  const { userId, getToken } = await auth();
  if (!userId || !getToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const token = await getToken({ template: 'supabase' });
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const name = String(body?.name || '').trim();
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  const supabase = createServerSupabaseClient(token);
  const { data, error } = await supabase.from('campaigns').insert({ name, owner_id: userId, settings: { members: [] } }).select('id, name').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ campaign: data });
}
