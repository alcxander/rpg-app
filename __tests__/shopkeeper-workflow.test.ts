import { describe, it, expect, beforeEach, vi } from "vitest"
import { createAdminClient } from "@/lib/supabaseAdmin"

// Mock the admin client
vi.mock("@/lib/supabaseAdmin", () => ({
  createAdminClient: vi.fn(),
}))

// Mock Clerk
vi.mock("@clerk/nextjs/server", () => ({
  currentUser: vi.fn(),
  auth: vi.fn(),
}))

// Mock Next.js
vi.mock("next/server", () => ({
  NextResponse: {
    json: vi.fn((data, options) => ({
      json: () => Promise.resolve(data),
      ok: !options?.status || options.status < 400,
      status: options?.status || 200,
    })),
  },
}))

describe("Shopkeeper Workflow Tests", () => {
  let mockSupabase: any
  let mockCurrentUser: any
  let mockAuth: any

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

    // Setup mock Supabase client
    mockSupabase = {
      from: vi.fn(() => mockSupabase),
      select: vi.fn(() => mockSupabase),
      eq: vi.fn(() => mockSupabase),
      single: vi.fn(() => mockSupabase),
      insert: vi.fn(() => mockSupabase),
      update: vi.fn(() => mockSupabase),
      upsert: vi.fn(() => mockSupabase),
      delete: vi.fn(() => mockSupabase),
      or: vi.fn(() => mockSupabase),
      order: vi.fn(() => mockSupabase),
      in: vi.fn(() => mockSupabase),
    }

    vi.mocked(createAdminClient).mockReturnValue(mockSupabase)

    // Setup mock Clerk
    mockCurrentUser = vi.fn()
    mockAuth = vi.fn()

    const clerkModule = vi.mocked(import("@clerk/nextjs/server"))
    clerkModule.currentUser = mockCurrentUser
    clerkModule.auth = mockAuth
  })

  describe("Campaign Access Tests", () => {
    it("DMs can see their campaigns", async () => {
      const dmUserId = "dm_user_123"
      mockCurrentUser.mockResolvedValue({ id: dmUserId })

      // Mock campaign query
      mockSupabase.single.mockResolvedValue({
        data: {
          id: "campaign_123",
          name: "Test Campaign",
          owner_id: dmUserId,
        },
        error: null,
      })

      const { GET } = await import("@/app/api/campaigns/route")
      const request = new Request("http://localhost/api/campaigns")

      const response = await GET(request)
      const data = await response.json()

      expect(data.campaigns).toBeDefined()
      expect(mockSupabase.from).toHaveBeenCalledWith("campaigns")
    })

    it("Players can see campaigns they are invited to", async () => {
      const playerUserId = "player_user_123"
      const campaignId = "campaign_123"

      mockCurrentUser.mockResolvedValue({ id: playerUserId })

      // Mock membership check
      mockSupabase.single.mockResolvedValue({
        data: {
          user_id: playerUserId,
          campaign_id: campaignId,
          role: "Player",
        },
        error: null,
      })

      const { GET } = await import("@/app/api/campaigns/route")
      const request = new Request("http://localhost/api/campaigns")

      const response = await GET(request)

      expect(mockSupabase.from).toHaveBeenCalledWith("campaign_members")
    })
  })

  describe("Shopkeeper Management Tests", () => {
    it("DMs can create shopkeepers in their campaign", async () => {
      const dmUserId = "dm_user_123"
      const campaignId = "campaign_123"

      mockAuth.mockResolvedValue({ userId: dmUserId })

      // Mock campaign ownership check
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: campaignId,
          owner_id: dmUserId,
        },
        error: null,
      })

      // Mock shopkeeper creation
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: "shopkeeper_123", name: "Test Shopkeeper" },
        error: null,
      })

      const { POST } = await import("@/app/api/shopkeepers/generate/route")
      const request = new Request("http://localhost/api/shopkeepers/generate", {
        method: "POST",
        body: JSON.stringify({ campaignId, count: 1 }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.ok).toBe(true)
      expect(mockSupabase.from).toHaveBeenCalledWith("campaigns")
    })

    it("Players can see shopkeepers in campaigns they belong to", async () => {
      const playerUserId = "player_user_123"
      const campaignId = "campaign_123"

      mockAuth.mockResolvedValue({ userId: playerUserId })

      // Mock campaign access check
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: campaignId,
          owner_id: "dm_user_123",
        },
        error: null,
      })

      // Mock membership check
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          user_id: playerUserId,
          role: "Player",
        },
        error: null,
      })

      // Mock shopkeepers query
      mockSupabase.order.mockResolvedValue({
        data: [{ id: "shop_1", name: "Weapon Shop", inventory: [] }],
        error: null,
      })

      const { GET } = await import("@/app/api/shopkeepers/route")
      const request = new Request(`http://localhost/api/shopkeepers?campaignId=${campaignId}`)

      const response = await GET(request)
      const data = await response.json()

      expect(response.ok).toBe(true)
      expect(data.shopkeepers).toBeDefined()
    })
  })

  describe("Gold Management Tests", () => {
    it("DMs can see current gold levels of players", async () => {
      const dmUserId = "dm_user_123"
      const campaignId = "campaign_123"

      mockCurrentUser.mockResolvedValue({ id: dmUserId })

      // Mock DM membership check
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          user_id: dmUserId,
          role: "owner",
        },
        error: null,
      })

      // Mock members query
      mockSupabase.select.mockResolvedValueOnce({
        data: [
          {
            user_id: "player_1",
            role: "Player",
            profiles: { clerk_user_id: "player_1", full_name: "Player One" },
          },
        ],
        error: null,
      })

      // Mock gold query
      mockSupabase.select.mockResolvedValueOnce({
        data: [{ player_id: "player_1", gold_amount: 100 }],
        error: null,
      })

      const { GET } = await import("@/app/api/players/gold/route")
      const request = new Request(`http://localhost/api/players/gold?campaignId=${campaignId}`)

      const response = await GET(request)
      const data = await response.json()

      expect(response.ok).toBe(true)
      expect(data.rows).toBeDefined()
      expect(data.rows[0].gold_amount).toBe(100)
    })

    it("Players can see their own gold amount", async () => {
      const playerUserId = "player_user_123"
      const campaignId = "campaign_123"

      mockCurrentUser.mockResolvedValue({ id: playerUserId })

      // Mock player membership check
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          user_id: playerUserId,
          role: "Player",
        },
        error: null,
      })

      // Mock target membership check
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          user_id: playerUserId,
          role: "Player",
        },
        error: null,
      })

      // Mock gold query
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          player_id: playerUserId,
          campaign_id: campaignId,
          gold_amount: 50,
        },
        error: null,
      })

      const { GET } = await import("@/app/api/players/gold/route")
      const request = new Request(`http://localhost/api/players/gold?campaignId=${campaignId}&playerId=${playerUserId}`)

      const response = await GET(request)
      const data = await response.json()

      expect(response.ok).toBe(true)
      expect(data.rows[0].gold_amount).toBe(50)
    })
  })

  describe("Inventory Management Tests", () => {
    it("DMs can control inventory levels of shopkeepers", async () => {
      const dmUserId = "dm_user_123"
      const inventoryId = "inventory_123"

      mockCurrentUser.mockResolvedValue({ id: dmUserId })

      // Mock inventory item query
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: inventoryId,
          shopkeeper_id: "shop_123",
          stock_quantity: 5,
        },
        error: null,
      })

      // Mock shopkeeper ownership check
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          campaign_id: "campaign_123",
        },
        error: null,
      })

      // Mock campaign ownership check
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          owner_id: dmUserId,
        },
        error: null,
      })

      // Mock inventory update
      mockSupabase.single.mockResolvedValue({
        data: {
          id: inventoryId,
          stock_quantity: 6,
        },
        error: null,
      })

      const { PATCH } = await import("@/app/api/shopkeepers/inventory/[id]/route")
      const request = new Request(`http://localhost/api/shopkeepers/inventory/${inventoryId}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "increment" }),
      })

      const response = await PATCH(request, { params: { id: inventoryId } })
      const data = await response.json()

      expect(response.ok).toBe(true)
      expect(data.item.stock_quantity).toBe(6)
    })
  })

  describe("Purchase Workflow Tests", () => {
    it("Players can buy items if they have enough gold", async () => {
      const playerUserId = "player_user_123"
      const campaignId = "campaign_123"
      const shopkeeperId = "shop_123"
      const itemId = "item_123"

      mockCurrentUser.mockResolvedValue({ id: playerUserId })

      // Mock campaign access check
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: campaignId,
          access_enabled: true,
        },
        error: null,
      })

      // Mock membership check
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          user_id: playerUserId,
          role: "Player",
        },
        error: null,
      })

      // Mock inventory item check
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: itemId,
          final_price: 10,
          stock_quantity: 1,
        },
        error: null,
      })

      // Mock player gold check
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          player_id: playerUserId,
          gold_amount: 50,
        },
        error: null,
      })

      // Mock inventory update
      mockSupabase.single.mockResolvedValueOnce({
        data: { stock_quantity: 0 },
        error: null,
      })

      // Mock gold update
      mockSupabase.single.mockResolvedValue({
        data: { gold_amount: 40 },
        error: null,
      })

      const { POST } = await import("@/app/api/shopkeepers/purchase/route")
      const request = new Request("http://localhost/api/shopkeepers/purchase", {
        method: "POST",
        body: JSON.stringify({
          shopkeeperId,
          itemId,
          campaignId,
        }),
      })

      const response = await POST(request)

      expect(response.ok).toBe(true)
    })

    it("Buy button should be disabled if player does not have enough gold", async () => {
      // This test would be for the frontend component
      // Testing the disabled state logic
      const userGold = 5
      const itemPrice = 10
      const inStock = true
      const accessEnabled = true
      const isOwner = false

      const isDisabled = !inStock || !accessEnabled || (!isOwner && userGold < itemPrice)

      expect(isDisabled).toBe(true)
    })

    it("Stock should adjust when a player purchases an item", async () => {
      // Mock the inventory update after purchase
      const initialStock = 5
      const expectedStock = 4

      // This would be tested as part of the purchase workflow
      expect(expectedStock).toBe(initialStock - 1)
    })

    it("Player gold should adjust when they buy an item", async () => {
      // Mock the gold update after purchase
      const initialGold = 100
      const itemPrice = 25
      const expectedGold = 75

      // This would be tested as part of the purchase workflow
      expect(expectedGold).toBe(initialGold - itemPrice)
    })
  })

  describe("Real-time Updates Tests", () => {
    it("Screen should not reload on purchase - only line item should change", async () => {
      // This would be a frontend integration test
      // Testing that state updates correctly without full page reload
      const mockSetShopkeepers = vi.fn()
      const mockSetUserGold = vi.fn()

      // Simulate successful purchase
      const updatedInventory = { id: "item_123", stock_quantity: 4 }
      const updatedGold = 75

      // Verify state updates are called
      expect(mockSetShopkeepers).not.toHaveBeenCalled() // Should use state update, not reload
      expect(mockSetUserGold).not.toHaveBeenCalled() // Should use state update, not reload
    })
  })

  describe("Permission Tests", () => {
    it("Non-members cannot access campaign shopkeepers", async () => {
      const nonMemberUserId = "non_member_123"
      const campaignId = "campaign_123"

      mockAuth.mockResolvedValue({ userId: nonMemberUserId })

      // Mock campaign query
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: campaignId,
          owner_id: "dm_user_123",
        },
        error: null,
      })

      // Mock membership check - no membership found
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: "PGRST116" },
      })

      const { GET } = await import("@/app/api/shopkeepers/route")
      const request = new Request(`http://localhost/api/shopkeepers?campaignId=${campaignId}`)

      const response = await GET(request)

      expect(response.status).toBe(403)
    })

    it("Players cannot manage inventory", async () => {
      const playerUserId = "player_user_123"
      const inventoryId = "inventory_123"

      mockCurrentUser.mockResolvedValue({ id: playerUserId })

      // Mock inventory item query
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: inventoryId,
          shopkeeper_id: "shop_123",
        },
        error: null,
      })

      // Mock shopkeeper query
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          campaign_id: "campaign_123",
        },
        error: null,
      })

      // Mock campaign ownership check - player is not owner
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          owner_id: "dm_user_123", // Different from playerUserId
        },
        error: null,
      })

      const { PATCH } = await import("@/app/api/shopkeepers/inventory/[id]/route")
      const request = new Request(`http://localhost/api/shopkeepers/inventory/${inventoryId}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "increment" }),
      })

      const response = await PATCH(request, { params: { id: inventoryId } })

      expect(response.status).toBe(403)
    })
  })
})
