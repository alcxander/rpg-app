const STABILITY_URL = "https://api.stability.ai/v2beta/stable-image/generate/core"

function toBase64(bytes: ArrayBuffer) {
  // Browser-safe base64 encode
  let binary = ""
  const bytesArr = new Uint8Array(bytes)
  const len = bytesArr.byteLength
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytesArr[i])
  return typeof btoa !== "undefined" ? btoa(binary) : Buffer.from(binary, "binary").toString("base64")
}

/**
 * Generates a token image using Stability Core and returns a data URL.
 * Falls back to null on error so the caller can use a placeholder.
 */
export async function generateTokenImage(prompt: string): Promise<string | null> {
  const key = process.env.STABILITY_API_KEY
  if (!key) {
    console.warn("[token-image] missing STABILITY_API_KEY")
    return null
  }

  try {
    const fd = new FormData()
    fd.append("prompt", prompt)
    fd.append("output_format", "png")
    fd.append("aspect_ratio", "1:1")

    const res = await fetch(STABILITY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: "image/*",
      },
      body: fd,
    })

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "")
      console.error("[token-image] stability error", { status: res.status, body: bodyText })
      return null
    }

    const buf = await res.arrayBuffer()
    const b64 = toBase64(buf)
    return `data:image/png;base64,${b64}`
  } catch (e: any) {
    console.error("[token-image] exception", { message: e?.message })
    return null
  }
}
