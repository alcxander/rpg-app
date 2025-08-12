import { createAdminClient } from "../lib/supabaseAdmin"

async function seedTestData() {
  const supabase = createAdminClient()

  console.log("🌱 Seeding test data...")

  try {
    // Create test users
    const testUsers = [
      {
        id: "dm-user-123",
        name: "Test DM",
        email: "dm@test.com",
        image_url: null,
      },
      {
        id: "player-456",
        name: "Test Player 1",
        email: "player1@test.com",
        image_url: null,
      },
      {
        id: "player-789",
        name: "Test Player 2",
        email: "player2@test.com",
        image_url: null,
      },
    ]

    console.log("Creating test users...")
    for (const user of testUsers) {
      await supabase.from("users").upsert(user, { onConflict: "id" })
    }

    // Create test campaign
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .upsert(
        {
          id: "test-campaign-123",
          name: "Test Campaign",
          owner_id: "dm-user-123",
          access_enabled: true,
        },
        { onConflict: "id" },
      )
      .select()
      .single()

    if (campaignError) {
      console.error("Error creating campaign:", campaignError)
      return
    }

    console.log("✅ Created test campaign:", campaign?.name)

    // Create test session
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .upsert(
        {
          id: "test-session-123",
          campaign_id: "test-campaign-123",
          participants: ["dm-user-123"],
        },
        { onConflict: "id" },
      )
      .select()
      .single()

    if (sessionError) {
      console.error("Error creating session:", sessionError)
      return
    }

    console.log("✅ Created test session")

    // Add DM as campaign member
    await supabase.from("campaign_members").upsert(
      {
        campaign_id: "test-campaign-123",
        user_id: "dm-user-123",
        role: "DM",
      },
      { onConflict: "campaign_id,user_id" },
    )

    console.log("✅ Added DM to campaign")

    // Initialize gold for all users
    for (const user of testUsers) {
      await supabase.from("players_gold").upsert(
        {
          player_id: user.id,
          campaign_id: "test-campaign-123",
          gold: user.id === "dm-user-123" ? 1000 : 100,
        },
        { onConflict: "player_id,campaign_id" },
      )
    }

    console.log("✅ Initialized player gold")

    console.log("\n🎉 Test data seeded successfully!")
    console.log("\nTest accounts:")
    console.log("- DM: dm-user-123 (Test DM)")
    console.log("- Player 1: player-456 (Test Player 1)")
    console.log("- Player 2: player-789 (Test Player 2)")
    console.log("\nTest campaign: test-campaign-123")
    console.log("Test session: test-session-123")
  } catch (error) {
    console.error("❌ Error seeding test data:", error)
  }
}

// Run if called directly
if (require.main === module) {
  seedTestData()
}

export { seedTestData }
