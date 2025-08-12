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

const mockSupabase = {
  from: vi.fn(() => mockSupabase),
  select: vi.fn(() => mockSupabase),
  eq: vi.fn(() => mockSupabase),
  single: vi.fn(),
  insert: vi.fn(() => mockSupabase),
  upsert: vi.fn(() => mockSupabase),
  update: vi.fn(() => mockSupabase),
  channel: vi.fn(() => ({
    send: vi.fn(),
  })),
}

describe("/api/campaigns/[id]/invite", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default mocks
    const { getAuth } = require("@clerk/nextjs/server")
    const { createAdminClient } = require("@/lib/supabaseAdmin")

    getAuth.mockReturnValue({ userId: "test-user-id", sessionId: "test-session" })
    createAdminClient.mockReturnValue(mockSupabase)
  })

  it("should successfully invite a new user", async () => {
    // Mock successful campaign owner check
    mockSupabase.single.mockResolvedValueOnce({
      data: { owner_id: "test-user-id" },
      error: null,
    })

    // Mock successful user lookup
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: "invitee-id", name: "Test User", email: "test@example.com" },
      error: null,
    })

    // Mock successful member insert
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: "member-id", user_id: "invitee-id", role: "Player" },
      error: null,
    })

    // Mock sessions query
    mockSupabase.select.mockResolvedValueOnce({
      data: [{ id: "session-1", participants: [] }],
      error: null,
    })

    const request = new NextRequest("http://localhost:3000/api/campaigns/test-campaign/invite", {
      method: "POST",
      body: JSON.stringify({ inviteeId: "invitee-id" }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: "test-campaign" }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.already_member).toBe(false)
    expect(data.member).toBeDefined()
  })

  it("should return 401 for unauthenticated requests", async () => {
    const { getAuth } = require("@clerk/nextjs/server")
    getAuth.mockReturnValue({ userId: null, sessionId: null })

    const request = new NextRequest("http://localhost:3000/api/campaigns/test-campaign/invite", {
      method: "POST",
      body: JSON.stringify({ inviteeId: "invitee-id" }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: "test-campaign" }) })
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe("Unauthorized")
  })

  it("should return 403 for non-campaign owners", async () => {
    // Mock campaign with different owner
    mockSupabase.single.mockResolvedValueOnce({
      data: { owner_id: "different-user-id" },
      error: null,
    })

    const request = new NextRequest("http://localhost:3000/api/campaigns/test-campaign/invite", {
      method: "POST",
      body: JSON.stringify({ inviteeId: "invitee-id" }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: "test-campaign" }) })
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toBe("Only campaign owner can invite players")
  })

  it("should return 404 for non-existent users", async () => {
    // Mock successful campaign owner check
    mockSupabase.single.mockResolvedValueOnce({
      data: { owner_id: "test-user-id" },
      error: null,
    })

    // Mock user not found
    mockSupabase.single.mockResolvedValueOnce({
      data: null,
      error: { message: "User not found" },
    })

    const request = new NextRequest("http://localhost:3000/api/campaigns/test-campaign/invite", {
      method: "POST",
      body: JSON.stringify({ inviteeId: "non-existent-user" }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: "test-campaign" }) })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe("User not found")
  })

  it("should handle duplicate invites gracefully", async () => {
    // Mock successful campaign owner check
    mockSupabase.single.mockResolvedValueOnce({
      data: { owner_id: "test-user-id" },
      error: null,
    })

    // Mock successful user lookup
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: "invitee-id", name: "Test User", email: "test@example.com" },
      error: null,
    })

    // Mock unique constraint violation
    mockSupabase.single.mockRejectedValueOnce({
      code: "23505",
      message: "duplicate key value violates unique constraint",
    })

    const request = new NextRequest("http://localhost:3000/api/campaigns/test-campaign/invite", {
      method: "POST",
      body: JSON.stringify({ inviteeId: "invitee-id" }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: "test-campaign" }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.already_member).toBe(true)
  })

  it("should return 400 for missing inviteeId", async () => {
    const request = new NextRequest("http://localhost:3000/api/campaigns/test-campaign/invite", {
      method: "POST",
      body: JSON.stringify({}),
    })

    const response = await POST(request, { params: Promise.resolve({ id: "test-campaign" }) })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe("inviteeId required")
  })
})
