import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function seedTestData() {
  console.log("🌱 Seeding test data...")

  try {
    // Create test users
    const testUsers = [
      { id: "dm-user-123", clerk_id: "user_dm123", name: "Test DM" },
      { id: "player-user-456", clerk_id: "user_player456", name: "Test Player 1" },
      { id: "player-user-789", clerk_id: "user_player789", name: "Test Player 2" },
    ]

    for (const user of testUsers) {
      const { error } = await supabase.from("users").upsert(user, { onConflict: "id" })

      if (error) {
        console.error(`Error creating user ${user.name}:`, error)
      } else {
        console.log(`✅ Created user: ${user.name}`)
      }
    }

    // Create test campaign
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .upsert(
        {
          id: "test-campaign-123",
          name: "Test Campaign",
          owner_id: "dm-user-123",
          settings: {},
        },
        { onConflict: "id" },
      )
      .select()
      .single()

    if (campaignError) {
      console.error("Error creating campaign:", campaignError)
      return
    }

    console.log("✅ Created test campaign")

    // Create test session
    const { error: sessionError } = await supabase.from("sessions").upsert(
      {
        id: "test-session-123",
        campaign_id: "test-campaign-123",
        active: true,
        participants: [{ userId: "dm-user-123", role: "DM" }],
      },
      { onConflict: "id" },
    )

    if (sessionError) {
      console.error("Error creating session:", sessionError)
      return
    }

    console.log("✅ Created test session")

    // Add DM as campaign member
    const { error: memberError } = await supabase.from("campaign_members").upsert(
      {
        campaign_id: "test-campaign-123",
        user_id: "dm-user-123",
        role: "DM",
      },
      { onConflict: "campaign_id,user_id" },
    )

    if (memberError) {
      console.error("Error adding DM as member:", memberError)
      return
    }

    console.log("✅ Added DM as campaign member")

    console.log("🎉 Test data seeded successfully!")
    console.log("\nTest credentials:")
    console.log("DM User ID: dm-user-123")
    console.log("Player User IDs: player-user-456, player-user-789")
    console.log("Campaign ID: test-campaign-123")
    console.log("Session ID: test-session-123")
  } catch (error) {
    console.error("❌ Error seeding test data:", error)
  }
}

// Run if called directly
if (require.main === module) {
  seedTestData()
}

export { seedTestData }
