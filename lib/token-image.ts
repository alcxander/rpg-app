/**
 * Stability image generation via multipart/form-data.
 * Returns a data URL (image/png) or null on failure.
 */
export async function generateShopkeeperImage(prompt: string): Promise<{
  imageUrl: string | null
  provider: "stability" | "fallback"
  prompt: string
}> {
  const key = process.env.STABILITY_API_KEY
  if (!key) {
    return { imageUrl: null, provider: "fallback", prompt }
  }

  try {
    const form = new FormData()
    form.set("prompt", prompt)
    form.set("output_format", "png")

    const res = await fetch("https://api.stability.ai/v2beta/stable-image/generate/core", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: "image/*",
      },
      body: form,
    })

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      console.warn("[token-image] stability error", { status: res.status, body })
      return { imageUrl: null, provider: "fallback", prompt }
    }

    const buf = await res.arrayBuffer()
    const base64 = Buffer.from(new Uint8Array(buf)).toString("base64")
    const dataUrl = `data:image/png;base64,${base64}`
    return { imageUrl: dataUrl, provider: "stability", prompt }
  } catch (e: any) {
    console.warn("[token-image] exception", { message: e?.message })
    return { imageUrl: null, provider: "fallback", prompt }
  }
}
