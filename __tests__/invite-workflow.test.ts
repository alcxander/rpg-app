import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { POST as invitePost } from "@/app/api/campaigns/[id]/invite/route"
import { GET as membersGet } from "@/app/api/campaigns/[id]/members/route"
import { GET as campaignsGet } from "@/app/api/campaigns/route"

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

describe("Complete Invite Workflow", () => {
  let mockSupabase: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockSupabase = {
      from: vi.fn(() => mockSupabase),
      select: vi.fn(() => mockSupabase),
      eq: vi.fn(() => mockSupabase),
      or: vi.fn(() => mockSupabase),
      order: vi.fn(() => mockSupabase),
      single: vi.fn(),
      insert: vi.fn(() => mockSupabase),
      upsert: vi.fn(() => mockSupabase),
      update: vi.fn(() => mockSupabase),
      channel: vi.fn(() => ({
        send: vi.fn().mockResolvedValue(undefined),
      })),
    }

    mockCreateAdminClient.mockReturnValue(mockSupabase)
  })

  it("should complete full invite workflow: invite -> verify membership -> player sees campaign", async () => {
    const campaignId = "test-campaign-123"
    const dmUserId = "dm-user-123"
    const playerUserId = "player-456"

    // Step 1: DM invites player
    mockGetAuth.mockReturnValue({ userId: dmUserId, sessionId: "session-123" })

    // Mock campaign owner check
    mockSupabase.single
      .mockResolvedValueOnce({
        data: {
          owner_id: dmUserId,
          name: "Test Campaign",
          settings: { players: [] },
        },
        error: null,
      })
      // Mock invitee user exists
      .mockResolvedValueOnce({
        data: { id: playerUserId, name: "Test Player", email: "player@test.com" },
        error: null,
      })
      // Mock no existing membership
      .mockResolvedValueOnce({
        data: null,
        error: { code: "PGRST116" }, // No rows returned
      })
      // Mock successful member insert
      .mockResolvedValueOnce({
        data: { id: "member-789", user_id: playerUserId, role: "Player" },
        error: null,
      })

    // Mock sessions query
    mockSupabase.select.mockResolvedValueOnce({
      data: [{ id: "session-1", participants: [] }],
      error: null,
    })

    const inviteRequest = new NextRequest(`http://localhost:3000/api/campaigns/${campaignId}/invite`, {
      method: "POST",
      body: JSON.stringify({ inviteeId: playerUserId }),
    })

    const inviteResponse = await invitePost(inviteRequest, { params: Promise.resolve({ id: campaignId }) })
    const inviteData = await inviteResponse.json()

    expect(inviteResponse.status).toBe(200)
    expect(inviteData.ok).toBe(true)
    expect(inviteData.already_member).toBe(false)
    expect(inviteData.member.user_id).toBe(playerUserId)

    // Step 2: Verify membership was created
    mockGetAuth.mockReturnValue({ userId: dmUserId, sessionId: "session-123" })

    // Mock membership check for DM
    mockSupabase.single
      .mockResolvedValueOnce({
        data: { role: "DM" },
        error: null,
      })
      // Mock campaign owner check
      .mockResolvedValueOnce({
        data: { owner_id: dmUserId },
        error: null,
      })

    // Mock members query
    mockSupabase.select.mockResolvedValueOnce({
      data: [
        {
          id: "member-dm",
          user_id: dmUserId,
          role: "DM",
          joined_at: "2024-01-01T00:00:00Z",
          users: { id: dmUserId, name: "Test DM", email: "dm@test.com" },
        },
        {
          id: "member-player",
          user_id: playerUserId,
          role: "Player",
          joined_at: "2024-01-01T01:00:00Z",
          users: { id: playerUserId, name: "Test Player", email: "player@test.com" },
        },
      ],
      error: null,
    })

    const membersRequest = new NextRequest(`http://localhost:3000/api/campaigns/${campaignId}/members`)
    const membersResponse = await membersGet(membersRequest, { params: Promise.resolve({ id: campaignId }) })
    const membersData = await membersResponse.json()

    expect(membersResponse.status).toBe(200)
    expect(membersData.members).toHaveLength(2)
    expect(membersData.members.find((m: any) => m.user_id === playerUserId)).toBeDefined()

    // Step 3: Player can now see campaign in their list
    mockGetAuth.mockReturnValue({ userId: playerUserId, sessionId: "session-456" })

    // Mock campaigns query for player
    mockSupabase.select.mockResolvedValueOnce({
      data: [
        {
          id: campaignId,
          name: "Test Campaign",
          description: "Test Description",
          owner_id: dmUserId,
          settings: { players: [playerUserId] },
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T01:00:00Z",
          campaign_members: [{ role: "Player", joined_at: "2024-01-01T01:00:00Z" }],
        },
      ],
      error: null,
    })

    const campaignsRequest = new NextRequest("http://localhost:3000/api/campaigns")
    const campaignsResponse = await campaignsGet(campaignsRequest)
    const campaignsData = await campaignsResponse.json()

    expect(campaignsResponse.status).toBe(200)
    expect(campaignsData.campaigns).toHaveLength(1)
    expect(campaignsData.campaigns[0].id).toBe(campaignId)
    expect(campaignsData.campaigns[0].user_role).toBe("Player")
    expect(campaignsData.campaigns[0].is_owner).toBe(false)
  })

  it("should handle duplicate invite gracefully", async () => {
    const campaignId = "test-campaign-123"
    const dmUserId = "dm-user-123"
    const playerUserId = "player-456"

    mockGetAuth.mockReturnValue({ userId: dmUserId, sessionId: "session-123" })

    // Mock campaign owner check
    mockSupabase.single
      .mockResolvedValueOnce({
        data: { owner_id: dmUserId, name: "Test Campaign", settings: {} },
        error: null,
      })
      // Mock invitee user exists
      .mockResolvedValueOnce({
        data: { id: playerUserId, name: "Test Player", email: "player@test.com" },
        error: null,
      })
      // Mock existing membership
      .mockResolvedValueOnce({
        data: { id: "existing-member", role: "Player" },
        error: null,
      })

    const inviteRequest = new NextRequest(`http://localhost:3000/api/campaigns/${campaignId}/invite`, {
      method: "POST",
      body: JSON.stringify({ inviteeId: playerUserId }),
    })

    const inviteResponse = await invitePost(inviteRequest, { params: Promise.resolve({ id: campaignId }) })
    const inviteData = await inviteResponse.json()

    expect(inviteResponse.status).toBe(200)
    expect(inviteData.ok).toBe(true)
    expect(inviteData.already_member).toBe(true)
  })

  it("should reject unauthorized invite attempts", async () => {
    const campaignId = "test-campaign-123"
    const nonOwnerUserId = "other-user-789"
    const playerUserId = "player-456"

    mockGetAuth.mockReturnValue({ userId: nonOwnerUserId, sessionId: "session-123" })

    // Mock campaign with different owner
    mockSupabase.single.mockResolvedValueOnce({
      data: { owner_id: "dm-user-123", name: "Test Campaign", settings: {} },
      error: null,
    })

    const inviteRequest = new NextRequest(`http://localhost:3000/api/campaigns/${campaignId}/invite`, {
      method: "POST",
      body: JSON.stringify({ inviteeId: playerUserId }),
    })

    const inviteResponse = await invitePost(inviteRequest, { params: Promise.resolve({ id: campaignId }) })
    const inviteData = await inviteResponse.json()

    expect(inviteResponse.status).toBe(403)
    expect(inviteData.ok).toBe(false)
    expect(inviteData.error).toBe("Only campaign owner can invite players")
  })
})
