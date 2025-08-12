import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { POST } from "@/app/api/campaigns/[campaignId]/invite/route"
import { NextRequest } from "next/server"

// Mock Clerk auth
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}))

// Mock Supabase client
vi.mock("@/lib/supabaseAdmin", () => ({
  createServerClient: vi.fn(),
}))

const mockAuth = vi.mocked(await import("@clerk/nextjs/server")).auth
const mockCreateServerClient = vi.mocked(await import("@/lib/supabaseAdmin")).createServerClient

describe("/api/campaigns/[campaignId]/invite", () => {
  let mockSupabase: any

  beforeEach(() => {
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      channel: vi.fn().mockReturnValue({
        send: vi.fn().mockResolvedValue(undefined),
      }),
    }
    mockCreateServerClient.mockReturnValue(mockSupabase)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("should successfully invite a new user", async () => {
    // Mock authenticated user
    mockAuth.mockResolvedValue({ userId: "dm-user-123" })

    // Mock campaign exists and user is owner
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "campaigns") {
        return {
          ...mockSupabase,
          single: vi.fn().mockResolvedValue({
            data: { owner_id: "dm-user-123" },
            error: null,
          }),
        }
      }
      if (table === "users") {
        return {
          ...mockSupabase,
          single: vi.fn().mockResolvedValue({
            data: { id: "player-123", name: "Test Player" },
            error: null,
          }),
        }
      }
      if (table === "campaign_members") {
        return {
          ...mockSupabase,
          single: vi.fn().mockResolvedValue({
            data: {
              id: "member-123",
              campaign_id: "campaign-123",
              user_id: "player-123",
              role: "Player",
            },
            error: null,
          }),
        }
      }
      if (table === "sessions") {
        return {
          ...mockSupabase,
          eq: vi.fn().mockReturnThis(),
          select: vi.fn().mockResolvedValue({
            data: [{ id: "session-123", participants: [] }],
            error: null,
          }),
        }
      }
      return mockSupabase
    })

    const request = new NextRequest("http://localhost/api/campaigns/campaign-123/invite", {
      method: "POST",
      body: JSON.stringify({ inviteeId: "player-123" }),
    })

    const response = await POST(request, { params: { campaignId: "campaign-123" } })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.already_member).toBe(false)
    expect(data.member).toBeDefined()
  })

  it("should return 401 for unauthenticated requests", async () => {
    mockAuth.mockResolvedValue({ userId: null })

    const request = new NextRequest("http://localhost/api/campaigns/campaign-123/invite", {
      method: "POST",
      body: JSON.stringify({ inviteeId: "player-123" }),
    })

    const response = await POST(request, { params: { campaignId: "campaign-123" } })
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.ok).toBe(false)
    expect(data.error).toBe("Unauthorized")
  })

  it("should return 403 for non-owners", async () => {
    mockAuth.mockResolvedValue({ userId: "other-user-123" })

    // Mock campaign exists but user is not owner
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "campaigns") {
        return {
          ...mockSupabase,
          single: vi.fn().mockResolvedValue({
            data: { owner_id: "dm-user-123" },
            error: null,
          }),
        }
      }
      if (table === "campaign_members") {
        return {
          ...mockSupabase,
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: "PGRST116" },
          }),
        }
      }
      return mockSupabase
    })

    const request = new NextRequest("http://localhost/api/campaigns/campaign-123/invite", {
      method: "POST",
      body: JSON.stringify({ inviteeId: "player-123" }),
    })

    const response = await POST(request, { params: { campaignId: "campaign-123" } })
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.ok).toBe(false)
    expect(data.error).toBe("Only campaign owners and DMs can invite players")
  })

  it("should return 404 for non-existent user", async () => {
    mockAuth.mockResolvedValue({ userId: "dm-user-123" })

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "campaigns") {
        return {
          ...mockSupabase,
          single: vi.fn().mockResolvedValue({
            data: { owner_id: "dm-user-123" },
            error: null,
          }),
        }
      }
      if (table === "users") {
        return {
          ...mockSupabase,
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: "PGRST116" },
          }),
        }
      }
      return mockSupabase
    })

    const request = new NextRequest("http://localhost/api/campaigns/campaign-123/invite", {
      method: "POST",
      body: JSON.stringify({ inviteeId: "nonexistent-user" }),
    })

    const response = await POST(request, { params: { campaignId: "campaign-123" } })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.ok).toBe(false)
    expect(data.error).toBe("User not found")
  })

  it("should handle already existing members", async () => {
    mockAuth.mockResolvedValue({ userId: "dm-user-123" })

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "campaigns") {
        return {
          ...mockSupabase,
          single: vi.fn().mockResolvedValue({
            data: { owner_id: "dm-user-123" },
            error: null,
          }),
        }
      }
      if (table === "users") {
        return {
          ...mockSupabase,
          single: vi.fn().mockResolvedValue({
            data: { id: "player-123", name: "Test Player" },
            error: null,
          }),
        }
      }
      if (table === "campaign_members") {
        const insertCall = mockSupabase.insert.mockResolvedValue({
          data: null,
          error: { code: "23505" }, // unique constraint violation
        })

        // Mock the follow-up select for existing member
        const selectCall = mockSupabase.select.mockReturnValue({
          ...mockSupabase,
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: "existing-member-123",
              campaign_id: "campaign-123",
              user_id: "player-123",
              role: "Player",
            },
            error: null,
          }),
        })

        return { ...mockSupabase, insert: insertCall, select: selectCall }
      }
      return mockSupabase
    })

    const request = new NextRequest("http://localhost/api/campaigns/campaign-123/invite", {
      method: "POST",
      body: JSON.stringify({ inviteeId: "player-123" }),
    })

    const response = await POST(request, { params: { campaignId: "campaign-123" } })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.already_member).toBe(true)
  })
})
