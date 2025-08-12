import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { POST } from "@/app/api/campaigns/[id]/invite/route"

// Mock Clerk
vi.mock("@clerk/nextjs/server", () => ({
  getAuth: vi.fn(),
}))

// Mock Supabase
vi.mock("@/lib/supabaseAdmin", () => ({
  createAdminClient: vi.fn(),
}))

const mockGetAuth = vi.mocked(await import("@clerk/nextjs/server")).getAuth
const mockCreateAdminClient = vi.mocked(await import("@/lib/supabaseAdmin")).createAdminClient

describe("/api/campaigns/[id]/invite", () => {
  let mockSupabase: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      channel: vi.fn().mockReturnThis(),
      send: vi.fn().mockResolvedValue(undefined),
    }

    mockCreateAdminClient.mockReturnValue(mockSupabase)
  })

  it("should successfully invite a new user", async () => {
    // Mock authenticated user
    mockGetAuth.mockReturnValue({
      userId: "dm-user-123",
      sessionId: "session-123",
    })

    // Mock campaign owner check
    mockSupabase.single.mockResolvedValueOnce({
      data: { owner_id: "dm-user-123" },
      error: null,
    })

    // Mock invitee user exists
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: "player-456", name: "Test Player", email: "test@example.com" },
      error: null,
    })

    // Mock successful member insert
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: "member-789", user_id: "player-456", role: "Player" },
      error: null,
    })

    // Mock sessions query
    mockSupabase.select.mockResolvedValueOnce({
      data: [{ id: "session-1", participants: [] }],
      error: null,
    })

    const request = new NextRequest("http://localhost:3000/api/campaigns/campaign-123/invite", {
      method: "POST",
      body: JSON.stringify({ inviteeId: "player-456" }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: "campaign-123" }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.already_member).toBe(false)
    expect(data.member.user_id).toBe("player-456")
  })

  it("should handle duplicate invite gracefully", async () => {
    mockGetAuth.mockReturnValue({
      userId: "dm-user-123",
      sessionId: "session-123",
    })

    // Mock campaign owner check
    mockSupabase.single.mockResolvedValueOnce({
      data: { owner_id: "dm-user-123" },
      error: null,
    })

    // Mock invitee user exists
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: "player-456", name: "Test Player", email: "test@example.com" },
      error: null,
    })

    // Mock unique constraint violation
    mockSupabase.single.mockRejectedValueOnce({
      code: "23505",
      message: "duplicate key value violates unique constraint",
    })

    const request = new NextRequest("http://localhost:3000/api/campaigns/campaign-123/invite", {
      method: "POST",
      body: JSON.stringify({ inviteeId: "player-456" }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: "campaign-123" }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.already_member).toBe(true)
  })

  it("should reject unauthorized requests", async () => {
    mockGetAuth.mockReturnValue({
      userId: null,
      sessionId: null,
    })

    const request = new NextRequest("http://localhost:3000/api/campaigns/campaign-123/invite", {
      method: "POST",
      body: JSON.stringify({ inviteeId: "player-456" }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: "campaign-123" }) })
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe("Unauthorized")
  })

  it("should reject non-owners", async () => {
    mockGetAuth.mockReturnValue({
      userId: "other-user-789",
      sessionId: "session-123",
    })

    // Mock campaign owner check - different owner
    mockSupabase.single.mockResolvedValueOnce({
      data: { owner_id: "dm-user-123" },
      error: null,
    })

    const request = new NextRequest("http://localhost:3000/api/campaigns/campaign-123/invite", {
      method: "POST",
      body: JSON.stringify({ inviteeId: "player-456" }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: "campaign-123" }) })
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toBe("Only campaign owner can invite players")
  })

  it("should handle non-existent user", async () => {
    mockGetAuth.mockReturnValue({
      userId: "dm-user-123",
      sessionId: "session-123",
    })

    // Mock campaign owner check
    mockSupabase.single.mockResolvedValueOnce({
      data: { owner_id: "dm-user-123" },
      error: null,
    })

    // Mock user not found
    mockSupabase.single.mockResolvedValueOnce({
      data: null,
      error: { message: "No rows returned" },
    })

    const request = new NextRequest("http://localhost:3000/api/campaigns/campaign-123/invite", {
      method: "POST",
      body: JSON.stringify({ inviteeId: "nonexistent-user" }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: "campaign-123" }) })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe("User not found")
  })

  it("should validate required fields", async () => {
    mockGetAuth.mockReturnValue({
      userId: "dm-user-123",
      sessionId: "session-123",
    })

    const request = new NextRequest("http://localhost:3000/api/campaigns/campaign-123/invite", {
      method: "POST",
      body: JSON.stringify({}), // Missing inviteeId
    })

    const response = await POST(request, { params: Promise.resolve({ id: "campaign-123" }) })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe("inviteeId required")
  })
})
