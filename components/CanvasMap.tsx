"use client"

import type React from "react"

import { useRef, useEffect, useState } from "react"
import * as fabric from "fabric"
import type { MapToken } from "@/types"

interface CanvasMapProps {
  mapUrl: string | null
  tokens: MapToken[]
  onTokensUpdate: (tokens: MapToken[]) => void
  width: number
  height: number
}

export default function CanvasMap({ mapUrl, tokens, onTokensUpdate, width, height }: CanvasMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [draggedToken, setDraggedToken] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const canvasElRef = useRef<HTMLCanvasElement>(null)
  const canvasRefFabric = useRef<fabric.Canvas | null>(null)
  const tokenGroupsRef = useRef<Map<string, fabric.Group>>(new Map())
  const bgImageObjRef = useRef<any>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const isDraggingRef = useRef(false)
  const lastPosRef = useRef({ x: 0, y: 0 })
  const panningModeRef = useRef(false)
  const gridDrawnRef = useRef(false)
  const viewportFittedRef = useRef(false)

  const CELL_SIZE = 50
  const MIN_ZOOM = 0.5
  const MAX_ZOOM = 3
  const ZOOM_STEP = 1.05

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Draw background map if available
    if (mapUrl) {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height)
        drawTokens(ctx)
      }
      img.src = mapUrl
    } else {
      // Draw grid background
      drawGrid(ctx)
      drawTokens(ctx)
    }
  }, [mapUrl, tokens, width, height])

  const drawGrid = (ctx: CanvasRenderingContext2D) => {
    const gridSize = 40
    ctx.strokeStyle = "#e5e7eb"
    ctx.lineWidth = 1

    // Draw vertical lines
    for (let x = 0; x <= width; x += gridSize) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }

    // Draw horizontal lines
    for (let y = 0; y <= height; y += gridSize) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }
  }

  const drawTokens = (ctx: CanvasRenderingContext2D) => {
    tokens.forEach((token) => {
      // Draw token circle
      ctx.beginPath()
      ctx.arc(token.x, token.y, 20, 0, 2 * Math.PI)
      ctx.fillStyle = token.isPlayer ? "#3b82f6" : "#ef4444"
      ctx.fill()
      ctx.strokeStyle = "#000"
      ctx.lineWidth = 2
      ctx.stroke()

      // Draw token name
      ctx.fillStyle = "#fff"
      ctx.font = "12px Arial"
      ctx.textAlign = "center"
      ctx.fillText(token.name.substring(0, 3), token.x, token.y + 4)
    })
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Find clicked token
    const clickedToken = tokens.find((token) => {
      const distance = Math.sqrt((x - token.x) ** 2 + (y - token.y) ** 2)
      return distance <= 20
    })

    if (clickedToken) {
      setDraggedToken(clickedToken.id)
      setDragOffset({
        x: x - clickedToken.x,
        y: y - clickedToken.y,
      })
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!draggedToken) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left - dragOffset.x
    const y = e.clientY - rect.top - dragOffset.y

    const updatedTokens = tokens.map((token) => (token.id === draggedToken ? { ...token, x, y } : token))

    onTokensUpdate(updatedTokens)
  }

  const handleMouseUp = () => {
    setDraggedToken(null)
    setDragOffset({ x: 0, y: 0 })
  }

  useEffect(() => {
    const el = canvasRef.current
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

  useEffect(() => {
    if (!canvasElRef.current) return
    const c = new fabric.Canvas(canvasElRef.current, {
      selection: false,
      backgroundColor: "#111827",
    })
    canvasRefFabric.current = c

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
      const updatedTokens = tokens.map((token) =>
        token.id === obj.tokenMeta.id ? { ...token, x: newX, y: newY } : token,
      )
      onTokensUpdate(updatedTokens)
      obj.set({ left: newX * CELL_SIZE, top: newY * CELL_SIZE })
      canvasRefFabric.current?.requestRenderAll()
    })
    ;(c as any).upperCanvasEl && ((c as any).upperCanvasEl.oncontextmenu = (e: Event) => e.preventDefault())

    return () => {
      c.dispose()
      canvasRefFabric.current = null
      tokenGroupsRef.current.clear()
      bgImageObjRef.current = null
      gridDrawnRef.current = false
      viewportFittedRef.current = false
    }
  }, [])

  useEffect(() => {
    const c = canvasRefFabric.current
    if (!c || width === 0 || height === 0) return
    c.setDimensions({ width, height })

    if (!viewportFittedRef.current) {
      const scaleFit = Math.min(width / (tokens.length * CELL_SIZE), height / (tokens.length * CELL_SIZE))
      const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, scaleFit))
      c.setZoom(zoom)
      const vpt = c.viewportTransform
      if (vpt) {
        vpt[4] = (width - tokens.length * CELL_SIZE * zoom) / 2
        vpt[5] = (height - tokens.length * CELL_SIZE * zoom) / 2
      }
      viewportFittedRef.current = true
    }
    c.requestRenderAll()
  }, [width, height, tokens])

  return (
    <div className="border rounded-lg overflow-hidden">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="cursor-pointer"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      <canvas ref={canvasElRef} />
    </div>
  )
}
