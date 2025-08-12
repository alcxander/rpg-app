import { createAdminClient } from "../lib/supabaseAdmin"

async function seedTestData() {
  const supabase = createAdminClient()

  console.log("🌱 Seeding test data...")

  try {
    // Create test users
    const testUsers = [
      {
        id: "test-dm-user",
        clerk_id: "clerk_test_dm",
        name: "Test DM",
        email: "dm@test.com",
        image_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=dm",
      },
      {
        id: "test-player-1",
        clerk_id: "clerk_test_player1",
        name: "Test Player 1",
        email: "player1@test.com",
        image_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=player1",
      },
      {
        id: "test-player-2",
        clerk_id: "clerk_test_player2",
        name: "Test Player 2",
        email: "player2@test.com",
        image_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=player2",
      },
    ]

    // Insert test users
    const { error: usersError } = await supabase.from("users").upsert(testUsers, { onConflict: "id" })

    if (usersError) {
      console.error("Error creating test users:", usersError)
      return
    }

    console.log("✅ Created test users")

    // Create test campaign
    const testCampaign = {
      id: "test-campaign-id",
      name: "Test Campaign",
      description: "A test campaign for development",
      owner_id: "test-dm-user",
      created_at: new Date().toISOString(),
    }

    const { error: campaignError } = await supabase.from("campaigns").upsert([testCampaign], { onConflict: "id" })

    if (campaignError) {
      console.error("Error creating test campaign:", campaignError)
      return
    }

    console.log("✅ Created test campaign")

    // Add DM as campaign member
    const { error: memberError } = await supabase.from("campaign_members").upsert(
      [
        {
          campaign_id: "test-campaign-id",
          user_id: "test-dm-user",
          role: "DM",
          added_by: "test-dm-user",
        },
      ],
      { onConflict: "campaign_id,user_id" },
    )

    if (memberError) {
      console.error("Error adding DM to campaign:", memberError)
      return
    }

    console.log("✅ Added DM to campaign")

    // Create test session
    const testSession = {
      id: "test-session-id",
      campaign_id: "test-campaign-id",
      name: "Test Session",
      active: true,
      participants: ["test-dm-user"],
      created_at: new Date().toISOString(),
    }

    const { error: sessionError } = await supabase.from("sessions").upsert([testSession], { onConflict: "id" })

    if (sessionError) {
      console.error("Error creating test session:", sessionError)
      return
    }

    console.log("✅ Created test session")

    // Add session participant
    const { error: participantError } = await supabase.from("session_participants").upsert(
      [
        {
          session_id: "test-session-id",
          user_id: "test-dm-user",
          role: "DM",
        },
      ],
      { onConflict: "session_id,user_id" },
    )

    if (participantError) {
      console.error("Error adding session participant:", participantError)
      return
    }

    console.log("✅ Added session participant")

    // Initialize gold for test users
    const goldRecords = [
      { player_id: "test-dm-user", campaign_id: "test-campaign-id", gold: 1000 },
      { player_id: "test-player-1", campaign_id: "test-campaign-id", gold: 100 },
      { player_id: "test-player-2", campaign_id: "test-campaign-id", gold: 100 },
    ]

    const { error: goldError } = await supabase
      .from("players_gold")
      .upsert(goldRecords, { onConflict: "player_id,campaign_id" })

    if (goldError) {
      console.error("Error creating gold records:", goldError)
      return
    }

    console.log("✅ Created gold records")

    console.log("🎉 Test data seeded successfully!")
    console.log("\nTest Data Summary:")
    console.log("- Campaign ID: test-campaign-id")
    console.log("- DM User ID: test-dm-user")
    console.log("- Player 1 ID: test-player-1")
    console.log("- Player 2 ID: test-player-2")
    console.log("- Session ID: test-session-id")
    console.log("\nTo test invite flow:")
    console.log("1. Login as test-dm-user")
    console.log("2. Go to /campaigns/test-campaign-id/settings")
    console.log("3. Try inviting test-player-1 or test-player-2")
  } catch (error) {
    console.error("Error seeding test data:", error)
  }
}

// Run if called directly
if (require.main === module) {
  seedTestData()
}

export { seedTestData }
