/**
 * Token image generation via Stability API.
 * Returns a data URL (image/png) on success, or null on failure.
 */
export async function generateTokenImage(prompt: string): Promise<string | null> {
  const apiKey = process.env.STABILITY_API_KEY
  if (!apiKey) {
    console.warn("[token-image] Missing STABILITY_API_KEY")
    return null
  }

  try {
    const resp = await fetch("https://api.stability.ai/v2beta/stable-image/generate/core", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "image/*",
      },
      body: JSON.stringify({
        prompt,
        output_format: "png",
        aspect_ratio: "1:1",
        mode: "text-to-image",
      }),
    })

    if (!resp.ok) {
      // Stability returns JSON error bodies when Accept is not image/*, but we set Accept image/*,
      // so parse best-effort text.
      let errText = ""
      try {
        errText = await resp.text()
      } catch {}
      console.error("[token-image] stability error", { status: resp.status, body: errText.slice(0, 1000) })
      return null
    }

    // Response is an image binary
    const arrayBuf = await resp.arrayBuffer()
    // Next.js Node runtime supports Buffer
    const base64 = Buffer.from(arrayBuf).toString("base64")
    const dataUrl = `data:image/png;base64,${base64}`
    return dataUrl
  } catch (e: any) {
    console.error("[token-image] exception", { message: e?.message })
    return null
  }
}
