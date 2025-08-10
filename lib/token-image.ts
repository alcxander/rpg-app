/**
 * Reusable token image generation using Stability AI.
 * Returns a data URL (small 256x256 PNG) to store directly in DB for portability.
 * If generation fails, returns null and caller must use a fallback.
 */
export async function generateTokenImage(prompt: string): Promise<string | null> {
  const key = process.env.STABILITY_API_KEY
  if (!key) {
    console.warn("STABILITY_API_KEY not set; skipping image generation.")
    return null
  }

  try {
    // v2beta stable-image core: efficient, small image
    const endpoint = "https://api.stability.ai/v2beta/stable-image/generate/core"
    const form = new FormData()
    form.append("prompt", prompt)
    form.append("aspect_ratio", "1:1")
    form.append("output_format", "png")
    // Keep cost down: no high-res / upscaling

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: "image/png",
      },
      body: form,
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => "")
      console.error("Stability image generation failed:", res.status, errText)
      return null
    }

    const arrayBuf = await res.arrayBuffer()
    const bytes = Buffer.from(arrayBuf).toString("base64")
    const dataUrl = `data:image/png;base64,${bytes}`
    return dataUrl
  } catch (err) {
    console.error("generateTokenImage error:", err)
    return null
  }
}
