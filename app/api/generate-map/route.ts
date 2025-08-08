import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Calls Stability AI SD3 to generate a top-down battle map background as a base64 data URL.
export async function POST(req: Request) {
  const requestId = Math.random().toString(36).slice(2)
  try {
    const STABILITY_API_KEY = process.env.STABILITY_API_KEY
    if (!STABILITY_API_KEY) {
      console.error(`[stability:${requestId}] No STABILITY_API_KEY set`)
      return NextResponse.json({ error: 'STABILITY_API_KEY is not set' }, { status: 500 })
    }

    const { prompt } = await req.json()
    if (!prompt || typeof prompt !== 'string') {
      console.error(`[stability:${requestId}] Missing prompt`)
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
    }

    console.log(`[stability:${requestId}] Requesting SD3 image. Prompt length=${prompt.length}`)

    const startedAt = Date.now()
    const form = new FormData()
    form.append('prompt', prompt)
    form.append('aspect_ratio', '1:1')
    form.append('output_format', 'png')

    // Correct SD3 endpoint; Accept must be image/* (or application/json)
    const res = await fetch('https://api.stability.ai/v2beta/stable-image/generate/sd3', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STABILITY_API_KEY}`,
        Accept: 'image/*',
      },
      body: form,
    })

    const durationMs = Date.now() - startedAt
    console.log(`[stability:${requestId}] Response status=${res.status} in ${durationMs}ms`)

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error(`[stability:${requestId}] Error ${res.status}. Body: ${errText.slice(0, 500)}`)
      return NextResponse.json({ error: `Stability API error: ${res.status}`, details: errText.slice(0, 500) }, { status: 500 })
    }

    const arrayBuf = await res.arrayBuffer()
    const base64 = Buffer.from(arrayBuf).toString('base64')
    const dataUrl = `data:image/png;base64,${base64}`
    console.log(`[stability:${requestId}] Image generated. Size=${base64.length}b64 chars`)
    return NextResponse.json({ image: dataUrl, requestId, durationMs })
  } catch (e: any) {
    console.error(`[stability:${requestId}] Exception:`, e?.message || e)
    return NextResponse.json({ error: e?.message || 'Failed to generate image', requestId }, { status: 500 })
  }
}
