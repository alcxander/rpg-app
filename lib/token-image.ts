/**
 * Small, cost-efficient token image generation. If it fails, return null so
 * the caller can use a local fallback image.
 */
export async function generateTokenImage(prompt: string): Promise<string | null> {
  const key = process.env.STABILITY_API_KEY
  const reqId = Math.random().toString(36).slice(2, 8)
  console.log("[token-image] start", { reqId, hasKey: Boolean(key), promptLen: prompt?.length || 0 })

  if (!key) {
    console.warn("[token-image] missing STABILITY_API_KEY; using fallback", { reqId })
    return null
  }

  try {
    // Stability simple image generation endpoint (example, may vary per account plan).
    const res = await fetch("https://api.stability.ai/v2beta/stable-image/generate/core", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        output_format: "png",
        width: 256,
        height: 256,
        // keep it cheap and fast
        cfg_scale: 3,
        steps: 10,
      }),
    })

    console.log("[token-image] response", { reqId, ok: res.ok, status: res.status })

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      console.warn("[token-image] non-200", { reqId, status: res.status, bodyPreview: text.slice(0, 200) })
      return null
    }

    // Assume Stability returns base64 or binary. Handle common shapes.
    const ct = res.headers.get("content-type") || ""
    if (ct.includes("application/json")) {
      const json: any = await res.json().catch(() => null)
      const b64 = json?.image || json?.artifacts?.[0]?.base64
      if (typeof b64 === "string" && b64.length > 0) {
        const dataUrl = `data:image/png;base64,${b64}`
        console.log("[token-image] json->dataurl", { reqId, len: b64.length })
        return dataUrl
      }
      console.warn("[token-image] json missing image", { reqId })
      return null
    }

    // Fallback to binary
    const arrayBuf = await res.arrayBuffer()
    const b64 = arrayBufferToBase64(arrayBuf)
    const dataUrl = `data:image/png;base64,${b64}`
    console.log("[token-image] binary->dataurl", { reqId, len: b64.length })
    return dataUrl
  } catch (e: any) {
    console.error("[token-image] exception", { reqId, message: e?.message })
    return null
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = ""
  const bytes = new Uint8Array(buffer)
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return typeof btoa === "function" ? btoa(binary) : Buffer.from(binary, "binary").toString("base64")
}
