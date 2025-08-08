import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServerSupabaseClient } from '@/lib/supabaseAdmin';
import type { SessionParticipant } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { userId, getToken } = await auth();
  if (!userId || !getToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const token = await getToken({ template: 'supabase' });
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServerSupabaseClient(token);
  const url = new URL(req.url);
  const campaignId = url.searchParams.get('campaignId');

  if (!campaignId) return NextResponse.json({ error: 'campaignId is required' }, { status: 400 });

  console.log('[api/sessions] GET sessions for campaign', campaignId, 'user', userId)

  const { data, error } = await supabase
    .from('sessions')
    .select('id, campaign_id, active, participants, updated_at')
    .eq('campaign_id', campaignId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[api/sessions] GET error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ sessions: data });
}

export async function POST(req: Request) {
  const { userId, getToken } = await auth();
  if (!userId || !getToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const token = await getToken({ template: 'supabase' });
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServerSupabaseClient(token);
  const { campaignId, sessionId } = await req.json();
  if (!campaignId || !sessionId) return NextResponse.json({ error: 'campaignId and sessionId are required' }, { status: 400 });

  console.log('[api/sessions] POST create session', sessionId, 'for campaign', campaignId, 'user', userId)

  // ensure campaign exists and is owned by user (RLS will enforce anyway)
  const campaign = await supabase.from('campaigns').select('id, owner_id, settings').eq('id', campaignId).maybeSingle();
  if (campaign.error || !campaign.data) {
    console.error('[api/sessions] campaign fetch error', campaign.error?.message)
    return NextResponse.json({ error: campaign.error?.message || 'Campaign not found' }, { status: 404 });
  }

  const members: string[] = Array.isArray((campaign.data.settings as any)?.members) ? (campaign.data.settings as any).members : [];
  const participants: SessionParticipant[] = [
    { userId, role: 'DM' },
    ...members.filter((m) => m !== userId).map((m) => ({ userId: m, role: 'Player' as const })),
  ];

  const upsert = await supabase
    .from('sessions')
    .upsert(
      { id: sessionId, campaign_id: campaignId, active: true, participants },
      { onConflict: 'campaign_id,id' }
    )
    .select('id, participants')
    .single();

  if (upsert.error) {
    console.error('[api/sessions] upsert error', upsert.error.message)
    return NextResponse.json({ error: upsert.error.message }, { status: 500 });
  }
  console.log('[api/sessions] Created/Upserted session', upsert.data?.id)
  return NextResponse.json({ session: upsert.data });
}
