'use client'

import React, { useRef, useEffect, useState } from 'react'
import * as fabric from 'fabric'
import { MapData, MapToken } from '@/lib/types'

interface CanvasMapProps {
  mapData: MapData | null
  isDM: boolean
  onTokenMove: (tokenId: string, x: number, y: number) => void
}

const MIN_ZOOM = 0.5
const MAX_ZOOM = 3
const ZOOM_STEP = 1.05
const CELL_SIZE = 50

function shuffle<T>(array: T[]): T[] {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

async function loadManifest(path: string): Promise<string[]> {
  try {
    const res = await fetch(path, { cache: 'no-store' })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function isCrossOrigin(url: string) {
  try {
    if (url.startsWith('data:')) return false
    const u = new URL(url, window.location.origin)
    return u.origin !== window.location.origin
  } catch {
    return false
  }
}

async function tryLoadImage(url: string): Promise<fabric.Image | null> {
  try {
    const img = await (fabric.Image.fromURL as any)(
      url,
      isCrossOrigin(url) ? { crossOrigin: 'anonymous' } : undefined
    )
    return img as fabric.Image
  } catch {
    return null
  }
}

// Fabric v6-safe background setter: uses setBackgroundImage if available, else assigns backgroundImage directly
function safeSetBackgroundImage(
  c: fabric.Canvas,
  img: fabric.Image | null,
  opts: { left?: number; top?: number; originX?: string; originY?: string; scaleX?: number; scaleY?: number } = {}
) {
  if (img) {
    img.set({
      left: opts.left ?? 0,
      top: opts.top ?? 0,
      originX: (opts.originX as any) ?? 'left',
      originY: (opts.originY as any) ?? 'top',
      scaleX: opts.scaleX ?? 1,
      scaleY: opts.scaleY ?? 1,
      selectable: false,
      evented: false,
    })
  }
  const anyCanvas = c as any
  if (typeof anyCanvas.setBackgroundImage === 'function') {
    anyCanvas.setBackgroundImage(img, undefined, opts)
  } else {
    ;(c as any).backgroundImage = img
  }
}

export default function CanvasMap({ mapData, isDM, onTokenMove }: CanvasMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasElRef = useRef<HTMLCanvasElement>(null)
  const canvasRef = useRef<fabric.Canvas | null>(null)

  const tokenGroupsRef = useRef<Map<string, fabric.Group>>(new Map())

  const [size, setSize] = useState({ width: 0, height: 0 })
  const isDraggingRef = useRef(false)
  const lastPosRef = useRef({ x: 0, y: 0 })
  const panningModeRef = useRef(false)

  const enemiesManifestRef = useRef<string[] | null>(null)
  const playersManifestRef = useRef<string[] | null>(null)
  const mapsManifestRef = useRef<string[] | null>(null)

  const currentMapData: MapData = mapData || {
    session_id: '',
    grid_size: 20,
    terrain_data: {},
    tokens: [],
    background_image: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const gridSize = currentMapData.grid_size || 20
  const mapWidth = gridSize * CELL_SIZE
  const mapHeight = gridSize * CELL_SIZE

  // Observe container size
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
    const onKeyDown = (e: KeyboardEvent) => { if (e.code === 'Space') panningModeRef.current = true }
    const onKeyUp = (e: KeyboardEvent) => { if (e.code === 'Space') panningModeRef.current = false }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  // Init canvas + handlers
  useEffect(() => {
    if (!canvasElRef.current || size.width === 0 || size.height === 0) return

    if (!canvasRef.current) {
      const c = new fabric.Canvas(canvasElRef.current, {
        width: size.width,
        height: size.height,
        selection: false,
        backgroundColor: '#111827',
      })
      canvasRef.current = c

      c.on('mouse:down', (opt: any) => {
        const e = opt?.e as MouseEvent | TouchEvent | undefined
        if (!e) return
        let button = 0
        let clientX = 0, clientY = 0
        if ('button' in e) {
          button = (e as MouseEvent).button
          clientX = (e as MouseEvent).clientX
          clientY = (e as MouseEvent).clientY
        } else if ('touches' in e && e.touches[0]) {
          clientX = e.touches[0].clientX
          clientY = e.touches[0].clientY
        }
        const isMiddle = button === 1
        const isRight = button === 2
        if (isMiddle || isRight || panningModeRef.current) {
          isDraggingRef.current = true
          lastPosRef.current = { x: clientX, y: clientY }
          c.setCursor('grabbing')
          ;(e as any).preventDefault?.()
        }
      })

      c.on('mouse:move', (opt: any) => {
        if (!isDraggingRef.current) return
        const e = opt?.e as MouseEvent | TouchEvent | undefined
        const vpt = c.viewportTransform
        if (!vpt || !e) return

        let clientX = 0, clientY = 0
        if ('clientX' in (e as any)) {
          clientX = (e as MouseEvent).clientX
          clientY = (e as MouseEvent).clientY
        } else if ('touches' in (e as any) && (e as TouchEvent).touches[0]) {
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

      c.on('mouse:up', () => {
        isDraggingRef.current = false
        c.setCursor('default')
      })

      c.on('mouse:wheel', (opt: any) => {
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

      // Snap to grid while moving
      c.on('object:moving', (e) => {
        const obj = e.target
        if (!obj) return
        obj.set({
          left: Math.round((obj.left || 0) / CELL_SIZE) * CELL_SIZE,
          top: Math.round((obj.top || 0) / CELL_SIZE) * CELL_SIZE,
        })
      })

      // Notify on release
      c.on('object:modified', (e) => {
        const obj = e.target as (fabric.Group & { tokenMeta?: { id: string } }) | undefined
        if (!obj?.tokenMeta) return
        const newX = Math.round((obj.left || 0) / CELL_SIZE)
        const newY = Math.round((obj.top || 0) / CELL_SIZE)
        onTokenMove(obj.tokenMeta.id, newX, newY)
        obj.set({ left: newX * CELL_SIZE, top: newY * CELL_SIZE })
        canvasRef.current?.requestRenderAll()
      })

      ;(c as any).upperCanvasEl && ((c as any).upperCanvasEl.oncontextmenu = (e: Event) => e.preventDefault())

      return () => {
        c.dispose()
        canvasRef.current = null
        tokenGroupsRef.current.clear()
      }
    } else {
      const c = canvasRef.current
      c.setDimensions({ width: size.width, height: size.height })
      c.backgroundColor = '#111827'
      c.requestRenderAll()
    }
  }, [size, onTokenMove])

  function choose<T>(arr: T[], fallback: T): T {
    return arr.length ? arr[Math.floor(Math.random() * arr.length)] : fallback
  }

  // Build a Group containing the image clipped in a circle + a border ring
  const buildTokenVisual = async (token: MapToken): Promise<fabric.Group> => {
    let url = token.image
    if (!url) {
      const pool = token.type === 'monster' ? (enemiesManifestRef.current || []) : (playersManifestRef.current || [])
      url = choose(pool, '/maps/forest_01.jpg')
    }

    const img = await (fabric.Image.fromURL as any)(
      url,
      isCrossOrigin(url) ? { crossOrigin: 'anonymous' } : undefined
    ) as fabric.Image

    const diameter = CELL_SIZE
    const iw = (img as any).width || 1
    const ih = (img as any).height || 1
    const scale = Math.min(diameter / iw, diameter / ih)

    img.set({
      originX: 'center',
      originY: 'center',
      left: diameter / 2,
      top: diameter / 2,
      scaleX: scale,
      scaleY: scale,
      opacity: 1,
      objectCaching: true,
      selectable: false,
      evented: false,
    })

    const clip = new fabric.Circle({
      radius: diameter / 2,
      originX: 'center',
      originY: 'center',
      left: diameter / 2,
      top: diameter / 2,
      absolutePositioned: false,
    })
    img.set('clipPath', clip)

    const border = new fabric.Circle({
      radius: diameter / 2,
      originX: 'center',
      originY: 'center',
      left: diameter / 2,
      top: diameter / 2,
      fill: 'transparent',
      stroke: token.type === 'monster' ? '#ef4444' : '#60a5fa',
      strokeWidth: 3,
      selectable: false,
      evented: false,
    })

    const group = new fabric.Group([img, border], {
      left: 0,
      top: 0,
      width: diameter,
      height: diameter,
      selectable: false,
      evented: false,
      objectCaching: true,
    })

    return group
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

    let visualGroup: fabric.Object
    try {
      visualGroup = await buildTokenVisual(token)
    } catch {
      visualGroup = new fabric.Group([
        new fabric.Circle({
          originX: 'center', originY: 'center',
          left: CELL_SIZE / 2, top: CELL_SIZE / 2, radius,
          fill: token.type === 'monster' ? '#dc2626' : '#2563eb',
        }),
      ], { width: CELL_SIZE, height: CELL_SIZE })
    }

    visualGroup.set({
      left,
      top,
      hasControls: false,
      hasBorders: false,
      lockRotation: true,
      lockScalingX: true,
      lockScalingY: true,
      selectable: isDM,
      evented: isDM,
    })

    const group = visualGroup as fabric.Group & { tokenMeta?: { id: string } }
    group.tokenMeta = { id: String(token.id) }

    // Only canvas-level 'object:modified' handler is used to avoid duplicates
    c.add(group)
    tokenGroupsRef.current.set(String(token.id), group)
  }

  const drawGrid = (c: fabric.Canvas) => {
    for (let i = 0; i <= gridSize; i++) {
      c.add(new fabric.Line([i * CELL_SIZE, 0, i * CELL_SIZE, mapHeight], { stroke: '#374151', strokeWidth: 1, selectable: false, evented: false }))
      c.add(new fabric.Line([0, i * CELL_SIZE, mapWidth, i * CELL_SIZE], { stroke: '#374151', strokeWidth: 1, selectable: false, evented: false }))
    }
  }

  // Robust static drawing — wait for background image if provided; otherwise fallback to local manifest
  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    let disposed = false

    const drawStatic = async () => {
      // Batch changes to avoid flicker
      const prev = (c as any).renderOnAddRemove
      ;(c as any).renderOnAddRemove = false

      c.clear()
      c.backgroundColor = '#111827'

      if (!enemiesManifestRef.current) enemiesManifestRef.current = await loadManifest('/tokens/enemies/manifest.json')
      if (!playersManifestRef.current) playersManifestRef.current = await loadManifest('/tokens/players/manifest.json')
      if (!mapsManifestRef.current) mapsManifestRef.current = await loadManifest('/maps/manifest.json')

      // Choose background: use provided image if any; otherwise fallback to local manifests; last resort placeholder
      const candidates: string[] = []
      if (currentMapData.background_image) candidates.push(currentMapData.background_image)
      if (!currentMapData.background_image && mapsManifestRef.current?.length) candidates.push(...shuffle(mapsManifestRef.current))
      candidates.push('/placeholder.svg?height=1000&width=1000')

      let bgImg: fabric.Image | null = null
      for (const url of candidates) {
        bgImg = await tryLoadImage(url)
        if (bgImg) break
      }

      if (bgImg && !disposed) {
        const iw = (bgImg as any).width || (bgImg as any)?.getElement?.()?.naturalWidth || 1
        const ih = (bgImg as any).height || (bgImg as any)?.getElement?.()?.naturalHeight || 1
        const scale = Math.max(mapWidth / iw, mapHeight / ih)
        safeSetBackgroundImage(c, bgImg, { left: 0, top: 0, originX: 'left', originY: 'top', scaleX: scale, scaleY: scale })
      } else {
        safeSetBackgroundImage(c, null)
      }

      // Grid (after background)
      drawGrid(c)

      // Tokens
      tokenGroupsRef.current.clear()
      for (const t of (currentMapData.tokens || [])) {
        await upsertTokenGroup(t, c)
      }

      // Fit & center
      const scaleFit = Math.min((size.width || 1) / mapWidth, (size.height || 1) / mapHeight)
      const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, scaleFit))
      c.setZoom(zoom)
      const vpt = c.viewportTransform
      if (vpt) {
        vpt[4] = (size.width - mapWidth * zoom) / 2
        vpt[5] = (size.height - mapHeight * zoom) / 2
      }

      // Unfreeze render
      ;(c as any).renderOnAddRemove = prev
      c.requestRenderAll()
    }

    drawStatic()
    return () => { disposed = true }
  }, [
    gridSize,
    mapWidth,
    mapHeight,
    size.width,
    size.height,
    currentMapData.background_image,
    currentMapData.tokens,
    isDM,
  ])

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

  return (
    <div ref={containerRef} className="flex-1 h-full bg-gray-900 rounded-lg overflow-hidden relative">
      {size.width > 0 && size.height > 0 && <canvas ref={canvasElRef} style={{ width: '100%', height: '100%' }} />}
      <div className="absolute left-2 bottom-2 text-[11px] text-gray-300 bg-gray-800/70 px-2 py-1 rounded">
        Hold Space and drag, or middle/right-drag to pan. Scroll to zoom.
      </div>
    </div>
  )
}
