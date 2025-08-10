/**
 * Small, reusable token image generator via Stability AI.
 * Returns a data URL (PNG) on success, or null on failure.
 * Adds detailed logging (no secrets logged).
 */

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(buffer).toString("base64")
  }
  let binary = ""
  const bytes = new Uint8Array(buffer)
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null as unknown as number[],
      bytes.subarray(i, i + chunk) as unknown as number[],
    )
  }
  return typeof btoa !== "undefined" ? btoa(binary) : ""
}

export async function generateTokenImage(prompt: string): Promise<string | null> {
  try {
    const apiKey = process.env.STABILITY_API_KEY
    console.log("[token-image] start", { hasKey: !!apiKey, promptLen: prompt?.length })
    if (!apiKey) {
      console.warn("[token-image] missing STABILITY_API_KEY")
      return null
    }

    const form = new FormData()
    form.append("prompt", prompt)
    form.append("output_format", "png")
    form.append("aspect_ratio", "1:1")
    form.append("width", "256")
    form.append("height", "256")

    const url = "https://api.stability.ai/v2beta/stable-image/generate/core"
    console.log("[token-image] fetch", { url })
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
    })

    console.log("[token-image] response", { ok: res.ok, status: res.status })
    if (!res.ok) {
      let errText = ""
      try {
        const clone = res.clone()
        errText = await clone.text()
      } catch {
        // ignore
      }
      console.warn("[token-image] non-ok response", { status: res.status, errText: errText?.slice(0, 200) })
      return null
    }

    const buffer = await res.arrayBuffer()
    const base64 = arrayBufferToBase64(buffer)
    const dataUrl = `data:image/png;base64,${base64}`
    console.log("[token-image] success (dataUrl length)", { length: dataUrl.length })
    return dataUrl
  } catch (e: any) {
    console.error("[token-image] exception", { message: e?.message, stack: e?.stack })
    return null
  }
}
