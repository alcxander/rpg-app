/**
 * Token image generation via Stability API (multipart/form-data).
 * Returns a data URL (image/png) on success, or null on failure.
 */
export async function generateTokenImage(prompt: string): Promise<string | null> {
  const apiKey = process.env.STABILITY_API_KEY
  const reqId = Math.random().toString(36).slice(2, 8)
  if (!apiKey) {
    console.warn("[token-image] Missing STABILITY_API_KEY", { reqId })
    return null
  }

  try {
    const form = new FormData()
    form.append("prompt", prompt)
    form.append("output_format", "png")
    form.append("mode", "text-to-image")
    // Keep costs down and keep it fast
    form.append("width", "256")
    form.append("height", "256")
    form.append("cfg_scale", "3")
    form.append("steps", "14")

    const resp = await fetch("https://api.stability.ai/v2beta/stable-image/generate/core", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "image/*",
      },
      body: form,
    })

    if (!resp.ok) {
      let errBody = ""
      try {
        errBody = await resp.text()
      } catch {}
      console.error("[token-image] stability error", { reqId, status: resp.status, body: errBody })
      return null
    }

    const buf = await resp.arrayBuffer()
    const base64 = Buffer.from(buf).toString("base64")
    const dataUrl = `data:image/png;base64,${base64}`
    return dataUrl
  } catch (e: any) {
    console.error("[token-image] exception", { reqId, message: e?.message })
    return null
  }
}
