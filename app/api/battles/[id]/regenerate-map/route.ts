import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerSupabaseClient } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const { userId, getToken } = await auth()
  if (!userId || !getToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const token = await getToken({ template: 'supabase' })
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const supabase = createServerSupabaseClient(token)
    const { theme } = await req.json().catch(() => ({} as any))
    const { data: battle } = await supabase.from('battles').select('id, session_id').eq('id', id).maybeSingle()
    if (!battle) return NextResponse.json({ error: 'Battle not found' }, { status: 404 })

    const url = new URL('/api/generate-map', req.url).toString()
    const prompt = `Top-down 2D tabletop battle map${theme ? `, theme: ${theme}` : ''}. Vivid, high-contrast, grid-friendly, no labels.`
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Cookie': req.headers.get('cookie') || '' }, body: JSON.stringify({ prompt }) })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return NextResponse.json({ error: j?.error || 'Map generation failed' }, { status: 500 })

    await supabase.from('battles').update({ background_image: j.image }).eq('id', id)
    await supabase.from('maps').update({ background_image: j.image, updated_at: new Date().toISOString() }).eq('session_id', battle.session_id)

    return NextResponse.json({ ok: true, image: j.image })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to regenerate map' }, { status: 500 })
  }
}
