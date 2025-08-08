import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServerSupabaseClient } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

export async function GET() {
  const { userId, getToken } = await auth();
  if (!userId || !getToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const token = await getToken({ template: 'supabase' });
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServerSupabaseClient(token);

  console.log('[api/campaigns] GET for user', userId);

  const owned = await supabase.from('campaigns').select('id, name, updated_at').eq('owner_id', userId);
  if (owned.error) {
    console.error('[api/campaigns] owned error:', owned.error.message);
    return NextResponse.json({ error: owned.error.message }, { status: 500 });
  }

  let participantCampaignIds: string[] = [];
  const sessionsRes = await supabase
    .from('sessions')
    .select('campaign_id')
    .contains('participants', [{ userId }]);

  if (sessionsRes.error) {
    console.warn('[api/campaigns] sessions contains failed; continuing with owned only:', sessionsRes.error.message);
  } else {
    participantCampaignIds = (sessionsRes.data || []).map((s) => s.campaign_id).filter(Boolean);
  }

  const campaignIds = Array.from(new Set([...(owned.data || []).map((c) => c.id), ...participantCampaignIds]));

  if (campaignIds.length === 0) {
    return NextResponse.json({ campaigns: owned.data || [] });
  }

  let campaigns: { data: any[] | null; error: any } = { data: [], error: null };
  if (campaignIds.length > 0) {
    campaigns = await supabase.from('campaigns').select('id, name, updated_at').in('id', campaignIds);
  }

  if (campaigns.error) {
    console.error('[api/campaigns] campaigns error:', campaigns.error.message);
    return NextResponse.json({ error: campaigns.error.message }, { status: 500 });
  }

  return NextResponse.json({ campaigns: campaigns.data });
}

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

  if (error) {
    console.error('[api/campaigns] POST error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  console.log('[api/campaigns] Created campaign', data?.id);
  return NextResponse.json({ campaign: data });
}
