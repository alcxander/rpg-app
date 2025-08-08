import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerSupabaseClient } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const { userId, getToken } = await auth()
  if (!userId || !getToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const token = await getToken({ template: 'supabase' })
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { monsters, allies, initiative } = body || {}
    const supabase = createServerSupabaseClient(token)

    const { error } = await supabase.from('battles').update({
      ...(Array.isArray(monsters) ? { monsters } : {}),
      ...(Array.isArray(allies) ? { allies } : {}),
      ...(initiative && typeof initiative === 'object' ? { initiative } : {}),
    }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 403 })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to update entities' }, { status: 500 })
  }
}
