import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabaseAdmin';
import { SessionParticipant } from '@/lib/types';
import { auth } from '@clerk/nextjs/server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { userId: clerkUserId, sessionId: clerkSessionId, getToken } = await auth();

  if (!clerkUserId || !clerkSessionId || !getToken) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const sessionToken = await getToken({ template: 'supabase' });
    if (!sessionToken) {
      return NextResponse.json({ error: 'Authentication token missing.' }, { status: 401 });
    }
    const supabase = createServerSupabaseClient(sessionToken);
    const { sessionId } = await req.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required.' }, { status: 400 });
    }

    // Ensure user exists
    const { data: existingUser, error: userFetchError } = await supabase
      .from('users')
      .select('id')
      .eq('id', clerkUserId)
      .maybeSingle();

    if (userFetchError && userFetchError.code !== 'PGRST116') {
      if (userFetchError.code === 'PGRST301') {
        const admin = createAdminClient();
        const { error: adminUserError } = await admin
          .from('users')
          .upsert({ id: clerkUserId, clerk_id: clerkUserId, name: `User ${clerkUserId.substring(0, 8)}` })
          .eq('id', clerkUserId);
        if (adminUserError) throw new Error(`Admin fallback failed creating user: ${adminUserError.message}`);
      } else {
        throw new Error(`Failed to check for existing user: ${userFetchError.message}`);
      }
    } else if (!existingUser) {
      const { error: newUserError } = await supabase
        .from('users')
        .insert({ id: clerkUserId, clerk_id: clerkUserId, name: `User ${clerkUserId.substring(0, 8)}` });
      if (newUserError) throw new Error(`Failed to create user record: ${newUserError.message}`);
    }

    // Ensure campaign exists or create one owned by this user
    let campaignId: string;
    const { data: existingCampaign, error: campaignErr } = await supabase
      .from('campaigns')
      .select('id, owner_id, settings')
      .eq('owner_id', clerkUserId)
      .maybeSingle();

    if (campaignErr && campaignErr.code !== 'PGRST116') {
      throw new Error(`Failed to check for existing campaign: ${campaignErr.message}`);
    }

    if (existingCampaign) {
      campaignId = existingCampaign.id;
    } else {
      const { data: newCampaign, error: newCampaignErr } = await supabase
        .from('campaigns')
        .insert({ name: `Default Campaign for ${clerkUserId.substring(0, 8)}`, owner_id: clerkUserId, settings: { members: [] } })
        .select('id')
        .single();
      if (newCampaignErr || !newCampaign) throw new Error(`Failed to create campaign: ${newCampaignErr?.message}`);
      campaignId = newCampaign.id;
    }

    // Determine role: campaign owner => DM; otherwise Player
    const isOwner = true; // this campaign is owned by the current user (we created or fetched owner's campaign)
    const myRole: SessionParticipant['role'] = isOwner ? 'DM' : 'Player';

    // Build participants: include self (DM for owner)
    const { data: existingSession } = await supabase
      .from('sessions')
      .select('id, participants')
      .eq('id', sessionId)
      .maybeSingle();

    let participants: SessionParticipant[] = [{ userId: clerkUserId, role: myRole }];
    if (existingSession?.participants && Array.isArray(existingSession.participants)) {
      const cur = existingSession.participants as SessionParticipant[];
      const exists = cur.some((p) => p.userId === clerkUserId);
      participants = exists ? cur : [...cur, ...participants];
    }

    // Upsert session to avoid duplicate key
    const { data: upsertedSession, error: upsertErr } = await supabase
      .from('sessions')
      .upsert({ id: sessionId, campaign_id: campaignId, active: true, participants }, { onConflict: 'id' })
      .select('*')
      .single();

    if (upsertErr || !upsertedSession) throw new Error(`Failed to upsert session: ${upsertErr?.message}`);

    return NextResponse.json({ message: 'Session joined/created successfully.', session: upsertedSession });
  } catch (error: any) {
    console.error('API: join-session: Caught error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}