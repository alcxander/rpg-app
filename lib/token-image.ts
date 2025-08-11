/**
 * Generate a token image via Stability's v2beta Core endpoint and return a data URL.
 * Falls back to null on any error – caller should provide a local fallback image.
 */
export async function generateTokenImage(prompt: string): Promise<string | null> {
  const apiKey = process.env.STABILITY_API_KEY
  if (!apiKey) {
    console.warn("[token-image] missing STABILITY_API_KEY")
    return null
  }

  try {
    // v2beta core requires multipart/form-data and Accept: image/*
    const form = new FormData()
    form.append("prompt", prompt)
    form.append("output_format", "png")
    form.append("aspect_ratio", "1:1")

    const res = await fetch("https://api.stability.ai/v2beta/stable-image/generate/core", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "image/*",
      },
      body: form,
    })

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      console.error("[token-image] stability error", { status: res.status, body })
      return null
    }

    const blob = await res.blob()
    const arrayBuf = await blob.arrayBuffer()
    const base64 = arrayBufferToBase64(arrayBuf)
    return `data:image/png;base64,${base64}`
  } catch (e: any) {
    console.error("[token-image] exception", { message: e?.message })
    return null
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = ""
  const bytes = new Uint8Array(buffer)
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  // btoa is available in the Next.js Node runtime
  return btoa(binary)
}
