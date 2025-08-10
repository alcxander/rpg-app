/**
 * Small, reusable token image generator via Stability AI.
 * Returns a data URL (PNG) on success, or null on failure.
 * Keep prompts concise to reduce cost.
 */
export async function generateTokenImage(prompt: string): Promise<string | null> {
  try {
    const apiKey = process.env.STABILITY_API_KEY
    if (!apiKey) return null

    const form = new FormData()
    form.append("prompt", prompt)
    form.append("output_format", "png")
    form.append("aspect_ratio", "1:1")
    form.append("width", "256")
    form.append("height", "256")

    const res = await fetch("https://api.stability.ai/v2beta/stable-image/generate/core", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
    })

    if (!res.ok) {
      // Avoid throwing; just gracefully degrade
      return null
    }

    const buffer = await res.arrayBuffer()
    const base64 = Buffer.from(buffer).toString("base64")
    return `data:image/png;base64,${base64}`
  } catch {
    return null
  }
}
