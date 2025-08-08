import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerSupabaseClient } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const { userId, getToken } = await auth()
  if (!userId || !getToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const token = await getToken({ template: 'supabase' })
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { message } = await req.json()
    if (!message || typeof message !== 'string') return NextResponse.json({ error: 'message is required' }, { status: 400 })

    const supabase = createServerSupabaseClient(token)
    const { data: battle, error: bErr } = await supabase.from('battles').select('id, log').eq('id', id).maybeSingle()
    if (bErr || !battle) return NextResponse.json({ error: 'Battle not found' }, { status: 404 })

    const nextLog = Array.isArray(battle.log) ? [...battle.log.map(String), String(message)] : [String(message)]
    const { error: updErr } = await supabase.from('battles').update({ log: nextLog }).eq('id', id)
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 403 })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to append log' }, { status: 500 })
  }
}
