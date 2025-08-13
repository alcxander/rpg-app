"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MapPin, ZoomIn, ZoomOut, RotateCcw } from "lucide-react"
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
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [selectedToken, setSelectedToken] = useState<string | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Draw background
    ctx.fillStyle = "#1f2937"
    ctx.fillRect(0, 0, width, height)

    // Draw map if available
    if (mapUrl) {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => {
        ctx.save()
        ctx.translate(offset.x, offset.y)
        ctx.scale(scale, scale)
        ctx.drawImage(img, 0, 0, width, height)
        ctx.restore()
        drawTokens(ctx)
      }
      img.src = mapUrl
    } else {
      // Draw grid
      drawGrid(ctx)
      drawTokens(ctx)
    }
  }, [mapUrl, tokens, scale, offset, selectedToken, width, height])

  const drawGrid = (ctx: CanvasRenderingContext2D) => {
    const gridSize = 40 * scale
    ctx.strokeStyle = "#374151"
    ctx.lineWidth = 1

    for (let x = offset.x % gridSize; x < width; x += gridSize) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }

    for (let y = offset.y % gridSize; y < height; y += gridSize) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }
  }

  const drawTokens = (ctx: CanvasRenderingContext2D) => {
    tokens.forEach((token) => {
      const x = token.x * scale + offset.x
      const y = token.y * scale + offset.y
      const radius = 20 * scale

      // Draw token circle
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, 2 * Math.PI)
      ctx.fillStyle = token.isPlayer ? "#10b981" : "#ef4444"
      ctx.fill()

      // Draw selection ring
      if (selectedToken === token.id) {
        ctx.strokeStyle = "#fbbf24"
        ctx.lineWidth = 3
        ctx.stroke()
      }

      // Draw token name
      ctx.fillStyle = "#ffffff"
      ctx.font = `${12 * scale}px sans-serif`
      ctx.textAlign = "center"
      ctx.fillText(token.name, x, y + radius + 15 * scale)
    })
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Check if clicking on a token
    const clickedToken = tokens.find((token) => {
      const tokenX = token.x * scale + offset.x
      const tokenY = token.y * scale + offset.y
      const distance = Math.sqrt((x - tokenX) ** 2 + (y - tokenY) ** 2)
      return distance <= 20 * scale
    })

    if (clickedToken) {
      setSelectedToken(clickedToken.id)
    } else {
      setSelectedToken(null)
      setIsDragging(true)
      setDragStart({ x: x - offset.x, y: y - offset.y })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return

    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setOffset({
      x: x - dragStart.x,
      y: y - dragStart.y,
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev * 1.2, 3))
  }

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev / 1.2, 0.5))
  }

  const handleReset = () => {
    setScale(1)
    setOffset({ x: 0, y: 0 })
    setSelectedToken(null)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Battle Map
        </CardTitle>
        <CardDescription>Interactive map with token positioning</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleZoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={handleZoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <canvas
              ref={canvasRef}
              width={width}
              height={height}
              className="cursor-move"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
          </div>

          {selectedToken && (
            <div className="text-sm text-muted-foreground">
              Selected: {tokens.find((t) => t.id === selectedToken)?.name}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
