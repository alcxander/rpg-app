"use client"

import { useRef, useEffect, useState } from "react"
import * as fabric from "fabric"
import type { MapData, MapToken } from "@/lib/types"

interface CanvasMapProps {
  mapData: MapData | null
  isDM: boolean
  onTokenMove: (tokenId: string, x: number, y: number) => void
  highlightTokenId?: string | null
}

const MIN_ZOOM = 0.5
const MAX_ZOOM = 3
const ZOOM_STEP = 1.05
const CELL_SIZE = 50

async function loadManifest(path: string): Promise<string[]> {
  try {
    const res = await fetch(path, { cache: "no-store" })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function isCrossOrigin(url: string) {
  try {
    if (url.startsWith("data:")) return false
    const u = new URL(url, window.location.origin)
    return u.origin !== window.location.origin
  } catch {
    return false
  }
}

async function loadImageSafe(url: string): Promise<any> {
  return await fabric.Image.fromURL(url, isCrossOrigin(url) ? { crossOrigin: "anonymous" as const } : undefined)
}

export default function CanvasMap({ mapData, isDM, onTokenMove, highlightTokenId = null }: CanvasMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasElRef = useRef<HTMLCanvasElement>(null)
  const canvasRef = useRef<fabric.Canvas | null>(null)

  const tokenGroupsRef = useRef<
    Map<string, fabric.Group & { tokenMeta?: { id: string; type?: "monster" | "pc" }; _border?: fabric.Circle }>
  >(new Map())
  const bgImageObjRef = useRef<any>(null)

  const [size, setSize] = useState({ width: 0, height: 0 })
  const isDraggingRef = useRef(false)
  const lastPosRef = useRef({ x: 0, y: 0 })
  const panningModeRef = useRef(false)

  const enemiesManifestRef = useRef<string[] | null>(null)
  const playersManifestRef = useRef<string[] | null>(null)
  const mapsManifestRef = useRef<string[] | null>(null)

  const gridDrawnRef = useRef(false)
  const viewportFittedRef = useRef(false)
  const onTokenMoveRef = useRef(onTokenMove)
  useEffect(() => {
    onTokenMoveRef.current = onTokenMove
  }, [onTokenMove])

  const currentMapData: MapData = mapData || {
    session_id: "",
    grid_size: 20,
    terrain_data: {},
    tokens: [],
    background_image: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  const tokenIdsKey = (currentMapData.tokens || [])
    .map((t) => String(t.id))
    .sort()
    .join(",")

  const gridSize = currentMapData.grid_size || 20
  const mapWidth = gridSize * CELL_SIZE
  const mapHeight = gridSize * CELL_SIZE

  // Observe container size only
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cr = entry.contentRect
        setSize({ width: Math.max(0, cr.width | 0), height: Math.max(0, cr.height | 0) })
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Spacebar panning
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") panningModeRef.current = true
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") panningModeRef.current = false
    }
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
    }
  }, [])

  // Create canvas and attach handlers ONCE
  useEffect(() => {
    if (!canvasElRef.current) return
    const c = new fabric.Canvas(canvasElRef.current, {
      selection: false,
      backgroundColor: "#111827",
    })
    canvasRef.current = c

    c.on("mouse:down", (opt: any) => {
      const e = opt?.e as MouseEvent | TouchEvent | undefined
      if (!e) return
      let button = 0
      let clientX = 0,
        clientY = 0
      if ("button" in e) {
        button = (e as MouseEvent).button
        clientX = (e as MouseEvent).clientX
        clientY = (e as MouseEvent).clientY
      } else if ("touches" in e && e.touches[0]) {
        clientX = e.touches[0].clientX
        clientY = e.touches[0].clientY
      }
      const isMiddle = button === 1
      const isRight = button === 2
      if (isMiddle || isRight || panningModeRef.current) {
        isDraggingRef.current = true
        lastPosRef.current = { x: clientX, y: clientY }
        c.setCursor("grabbing")
        ;(e as any).preventDefault?.()
      }
    })

    c.on("mouse:move", (opt: any) => {
      if (!isDraggingRef.current) return
      const e = opt?.e as MouseEvent | TouchEvent | undefined
      const vpt = c.viewportTransform
      if (!vpt || !e) return
      let clientX = 0,
        clientY = 0
      if ("clientX" in (e as any)) {
        clientX = (e as MouseEvent).clientX
        clientY = (e as MouseEvent).clientY
      } else if ("touches" in (e as any) && (e as TouchEvent).touches[0]) {
        clientX = (e as TouchEvent).touches[0].clientX
        clientY = (e as TouchEvent).touches[0].clientY
      }
      const dx = clientX - lastPosRef.current.x
      const dy = clientY - lastPosRef.current.y
      vpt[4] += dx
      vpt[5] += dy
      lastPosRef.current = { x: clientX, y: clientY }
      c.requestRenderAll()
    })

    c.on("mouse:up", () => {
      isDraggingRef.current = false
      c.setCursor("default")
    })

    c.on("mouse:wheel", (opt: any) => {
      const e = opt?.e as WheelEvent | undefined
      if (!e) return
      let zoom = c.getZoom()
      const direction = e.deltaY > 0 ? 1 : -1
      zoom *= direction > 0 ? ZOOM_STEP : 1 / ZOOM_STEP
      if (zoom > MAX_ZOOM) zoom = MAX_ZOOM
      if (zoom < MIN_ZOOM) zoom = MIN_ZOOM
      const pt = new fabric.Point((e as any).offsetX ?? 0, (e as any).offsetY ?? 0)
      c.zoomToPoint(pt, zoom)
      e.preventDefault()
      e.stopPropagation()
    })

    // Snap and emit on end
    c.on("object:moving", (e) => {
      const obj = e.target
      if (!obj) return
      obj.set({
        left: Math.round((obj.left || 0) / CELL_SIZE) * CELL_SIZE,
        top: Math.round((obj.top || 0) / CELL_SIZE) * CELL_SIZE,
      })
    })
    c.on("object:modified", (e) => {
      const obj = e.target as (fabric.Group & { tokenMeta?: { id: string } }) | undefined
      if (!obj?.tokenMeta) return
      const newX = Math.round((obj.left || 0) / CELL_SIZE)
      const newY = Math.round((obj.top || 0) / CELL_SIZE)
      onTokenMoveRef.current?.(obj.tokenMeta.id, newX, newY)
      obj.set({ left: newX * CELL_SIZE, top: newY * CELL_SIZE })
      canvasRef.current?.requestRenderAll()
    })
    ;(c as any).upperCanvasEl && ((c as any).upperCanvasEl.oncontextmenu = (e: Event) => e.preventDefault())

    return () => {
      c.dispose()
      canvasRef.current = null
      tokenGroupsRef.current.clear()
      bgImageObjRef.current = null
      gridDrawnRef.current = false
      viewportFittedRef.current = false
    }
  }, [])

  // Only update canvas pixel size; never dispose here
  useEffect(() => {
    const c = canvasRef.current
    if (!c || size.width === 0 || size.height === 0) return
    c.setDimensions({ width: size.width, height: size.height })

    // Fit & center viewport ONCE when size becomes available
    if (!viewportFittedRef.current) {
      const scaleFit = Math.min((size.width || 1) / mapWidth, (size.height || 1) / mapHeight)
      const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, scaleFit))
      c.setZoom(zoom)
      const vpt = c.viewportTransform
      if (vpt) {
        vpt[4] = (size.width - mapWidth * zoom) / 2
        vpt[5] = (size.height - mapHeight * zoom) / 2
      }
      viewportFittedRef.current = true
    }
    c.requestRenderAll()
  }, [size.width, size.height, mapWidth, mapHeight])

  function choose<T>(arr: T[], fallback: T): T {
    return arr.length ? arr[Math.floor(Math.random() * arr.length)] : fallback
  }

  // Token visual
  const buildTokenVisual = async (token: MapToken): Promise<fabric.Object> => {
    let url = token.image
    if (!url) {
      const pool = token.type === "monster" ? enemiesManifestRef.current || [] : playersManifestRef.current || []
      url = choose(pool, "/placeholder.svg?height=100&width=100")
    }

    const img: any = await loadImageSafe(url).catch(() => null)

    const radius = CELL_SIZE / 2
    if (!img) {
      // fallback colored circle
      return new fabric.Circle({ left: 0, top: 0, radius, fill: token.type === "monster" ? "#b91c1c" : "#1d4ed8" })
    }

    const iw = img.width || 1
    const ih = img.height || 1
    const scale = Math.max(CELL_SIZE / iw, CELL_SIZE / ih)
    img.set({ left: 0, top: 0, scaleX: scale, scaleY: scale })

    // circular clip
    const clip = new fabric.Circle({ radius, left: radius, top: radius, originX: "center", originY: "center" })
    ;(clip as any).absolutePositioned = false
    img.set("clipPath", clip)

    return img
  }

  const upsertTokenGroup = async (token: MapToken, c: fabric.Canvas) => {
    const existing = tokenGroupsRef.current.get(String(token.id))
    const left = token.x * CELL_SIZE
    const top = token.y * CELL_SIZE
    const radius = CELL_SIZE / 2

    if (existing) {
      existing.set({ left, top })
      existing.setCoords()
      return
    }

    let visual: fabric.Object
    try {
      visual = await buildTokenVisual(token)
    } catch {
      visual = new fabric.Circle({ left: 0, top: 0, radius, fill: token.type === "monster" ? "#b91c1c" : "#1d4ed8" })
    }

    visual.set({ left: 0, top: 0, selectable: isDM, evented: isDM })

    const border = new fabric.Circle({
      radius,
      left: radius,
      top: radius,
      originX: "center",
      originY: "center",
      fill: "transparent",
      stroke: token.type === "monster" ? "#7f1d1d" : "#1e3a8a",
      strokeWidth: 3,
      selectable: false,
      evented: false,
    })

    const group = new fabric.Group([visual, border], {
      left,
      top,
      width: CELL_SIZE,
      height: CELL_SIZE,
      hasControls: false,
      hasBorders: false,
      lockRotation: true,
      lockScalingX: true,
      lockScalingY: true,
      selectable: isDM,
      evented: isDM,
      shadow: undefined,
    }) as fabric.Group & { tokenMeta?: { id: string; type?: "monster" | "pc" }; _border?: fabric.Circle }

    group.tokenMeta = { id: String(token.id), type: token.type }
    group._border = border

    try {
      c.add(group)
      tokenGroupsRef.current.set(String(token.id), group)
    } catch (e) {
      console.error("upsertTokenGroup: add failed", e)
    }
  }

  const drawGrid = (c: fabric.Canvas) => {
    for (let i = 0; i <= gridSize; i++) {
      c.add(
        new fabric.Line([i * CELL_SIZE, 0, i * CELL_SIZE, mapHeight], {
          stroke: "#374151",
          strokeWidth: 1,
          selectable: false,
          evented: false,
        }),
      )
      c.add(
        new fabric.Line([0, i * CELL_SIZE, mapWidth, i * CELL_SIZE], {
          stroke: "#374151",
          strokeWidth: 1,
          selectable: false,
          evented: false,
        }),
      )
    }
  }

  async function resolveBackgroundCandidate(): Promise<string> {
    const manifestChoice =
      mapsManifestRef.current && mapsManifestRef.current.length
        ? mapsManifestRef.current[Math.floor(Math.random() * mapsManifestRef.current.length)]
        : "/placeholder.svg?height=800&width=800"
    return currentMapData.background_image || manifestChoice
  }

  async function loadBackground(c: fabric.Canvas) {
    const candidate = await resolveBackgroundCandidate()
    const candidates: string[] = [candidate]

    if (mapsManifestRef.current?.length) {
      const shuffled = [...mapsManifestRef.current].sort(() => Math.random() - 0.5).slice(0, 2)
      for (const u of shuffled) if (!candidates.includes(u)) candidates.push(u)
    }
    candidates.push("/placeholder.svg?height=800&width=800")

    let fImg: any = null
    for (const url of candidates) {
      try {
        fImg = await loadImageSafe(url)
        if (fImg) break
      } catch {
        // try next
      }
    }
    if (!fImg) return

    const iw = fImg.width || (fImg as any)?.getElement?.()?.naturalWidth || 1
    const ih = fImg.height || (fImg as any)?.getElement?.()?.naturalHeight || 1
    const scale = Math.max(mapWidth / iw, mapHeight / ih)
    fImg.set({
      left: 0,
      top: 0,
      selectable: false,
      evented: false,
      scaleX: scale,
      scaleY: scale,
    })

    // Remove previous bg if any, then add and send behind WITHOUT clearing canvas
    if (bgImageObjRef.current) {
      try {
        c.remove(bgImageObjRef.current)
      } catch {}
      bgImageObjRef.current = null
    }

    c.add(fImg)
    if (typeof (fImg as any).sendToBack === "function") {
      ;(fImg as any).sendToBack()
    }
    bgImageObjRef.current = fImg
    c.requestRenderAll()
  }

  // STATIC: manifests, grid, initial tokens — only when set changes
  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    let cancelled = false

    const setupStatic = async () => {
      if (!enemiesManifestRef.current) enemiesManifestRef.current = await loadManifest("/tokens/enemies/manifest.json")
      if (!playersManifestRef.current) playersManifestRef.current = await loadManifest("/tokens/players/manifest.json")
      if (!mapsManifestRef.current) mapsManifestRef.current = await loadManifest("/maps/manifest.json")

      if (!gridDrawnRef.current) {
        c.backgroundColor = "#111827"
        drawGrid(c)
        gridDrawnRef.current = true
      }

      // Remove groups for removed IDs
      const wantedIds = new Set((currentMapData.tokens || []).map((t) => String(t.id)))
      tokenGroupsRef.current.forEach((g, id) => {
        if (!wantedIds.has(id)) {
          try {
            c.remove(g)
          } catch {}
          tokenGroupsRef.current.delete(id)
        }
      })

      // Upsert groups for current tokens
      for (const t of currentMapData.tokens || []) {
        if (cancelled) return
        await upsertTokenGroup(t, c)
      }

      c.requestRenderAll()
    }

    setupStatic()
    return () => {
      cancelled = true
    }
  }, [tokenIdsKey, gridSize, mapWidth, mapHeight, isDM, currentMapData.tokens])

  // Background: only if image or grid size changes
  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    loadBackground(c).catch((err) => {
      console.error("background load failed", err)
    })
  }, [currentMapData.background_image, gridSize])

  // Positions-only update
  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const tokens = currentMapData.tokens || []
    for (const t of tokens) {
      const g = tokenGroupsRef.current.get(String(t.id))
      const desiredLeft = t.x * CELL_SIZE
      const desiredTop = t.y * CELL_SIZE
      if (g && (g.left !== desiredLeft || g.top !== desiredTop)) {
        g.set({ left: desiredLeft, top: desiredTop })
        g.setCoords()
      }
    }
    c.requestRenderAll()
  }, [currentMapData.tokens])

  // Highlight token by id (stronger highlight)
  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    tokenGroupsRef.current.forEach((g) => {
      // reset shadow
      g.set({ shadow: undefined })
      // reset ring color/width
      const t = g.tokenMeta?.type
      if (g._border) {
        g._border.set({
          stroke: t === "monster" ? "#7f1d1d" : "#1e3a8a",
          strokeWidth: 3,
        })
      }
    })
    if (!highlightTokenId) {
      c.requestRenderAll()
      return
    }
    const g = tokenGroupsRef.current.get(String(highlightTokenId))
    if (!g) return
    g.set({
      shadow: new fabric.Shadow({
        color: "rgba(251, 191, 36, 0.95)", // stronger amber glow
        blur: 45,
        offsetX: 0,
        offsetY: 0,
      }),
    })
    if (g._border) {
      g._border.set({
        stroke: "#f59e0b", // amber ring
        strokeWidth: 6,
      })
    }
    if (typeof (g as any).bringToFront === "function") {
      ;(g as any).bringToFront()
    }
    c.requestRenderAll()
  }, [highlightTokenId])

  return (
    <div ref={containerRef} className="flex-1 h-full bg-gray-900 rounded-lg overflow-hidden relative">
      <canvas ref={canvasElRef} />
      <div className="absolute left-2 bottom-2 text-[11px] text-gray-300 bg-gray-800/70 px-2 py-1 rounded">
        Hold Space and drag, or middle/right-drag to pan. Scroll to zoom.
      </div>
    </div>
  )
}
