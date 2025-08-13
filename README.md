# RPG Collaboration App

A Next.js application for tabletop RPG campaign management with real-time collaboration features.

## Features

- **Campaign Management**: Create and manage RPG campaigns
- **Player Invites**: Invite players to join campaigns with proper permissions
- **Character System**: Create and manage characters with stats and inventory
- **Token Management**: Spawn and move tokens on battle maps with ownership controls
- **Shop System**: DM-controlled shops with purchase functionality
- **Real-time Updates**: Live synchronization across all clients

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Supabase (PostgreSQL + Realtime)
- **Authentication**: Clerk
- **UI Components**: shadcn/ui, Radix UI
- **Testing**: Vitest, React Testing Library

## Getting Started

### Prerequisites

- Node.js 18.18.0 or higher
- npm or yarn
- Supabase account
- Clerk account

### Environment Variables

Create a `.env.local` file with the following variables:

\`\`\`env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/

# Optional: AI Integration
OPENAI_API_KEY=your_openai_api_key
STABILITY_API_KEY=your_stability_api_key
\`\`\`

### Installation

1. Clone the repository
2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

3. Run database migrations:
   \`\`\`bash
   # Execute these SQL files in your Supabase SQL editor in order:
   # scripts/v14-campaign-members.sql
   # scripts/v15-characters.sql
   # scripts/v16-token-ownership.sql
   # scripts/v17-session-participants.sql
   # scripts/v18-players-gold-unique.sql
   \`\`\`

4. Seed test data (optional):
   \`\`\`bash
   npm run seed-test-data
   \`\`\`

5. Start the development server:
   \`\`\`bash
   npm run dev
   \`\`\`

## Testing

### Unit Tests

Run the test suite:
\`\`\`bash
npm test
\`\`\`

Run tests in watch mode:
\`\`\`bash
npm run test:watch
\`\`\`

### Manual Testing

#### Invite Flow Testing

1. **Setup Test Data**:
   \`\`\`bash
   npm run seed-test-data
   \`\`\`

2. **Test Campaign Access**:
   - Login as `test-dm-user` (DM)
   - Navigate to `/campaigns`
   - Verify you can see "Test Campaign"
   - Click on the campaign to enter

3. **Test Invite Flow**:
   - Go to `/campaigns/test-campaign-id/settings`
   - Click "Invite Players" tab
   - Enter `test-player-1` in the user ID field
   - Click "Send Invite"
   - Verify green success toast appears

4. **Verify Database Changes**:
   - Check `campaign_members` table for new record
   - Check `players_gold` table for gold record
   - Check `session_participants` table for session access

5. **Test Player Access**:
   - Logout and login as `test-player-1`
   - Navigate to `/campaigns`
   - Verify you can now see "Test Campaign"
   - Verify you can access campaign pages

#### Edge Cases to Test

- **Duplicate Invite**: Try inviting the same user twice
- **Non-existent User**: Try inviting a user that doesn't exist
- **Permission Check**: Try inviting as a non-owner
- **Invalid Data**: Send malformed requests

### API Testing

Test individual endpoints:

\`\`\`bash
# Test invite endpoint
curl -X POST http://localhost:3000/api/campaigns/test-campaign-id/invite \
  -H "Content-Type: application/json" \
  -d '{"inviteeId": "test-player-1"}'

# Test members endpoint
curl http://localhost:3000/api/campaigns/test-campaign-id/members
\`\`\`

## Database Schema

### Core Tables

- **campaigns**: Campaign information and settings
- **campaign_members**: Explicit campaign membership with roles
- **users**: User profiles and authentication data
- **sessions**: Game sessions within campaigns
- **session_participants**: Normalized session membership
- **characters**: Player characters with stats and gold
- **character_inventories**: Character item storage
- **tokens**: Map tokens with ownership and position
- **players_gold**: Per-campaign gold tracking (legacy)

### Key Relationships

- Campaigns have many members (campaign_members)
- Members can be DM or Player role
- Characters belong to users and optionally campaigns
- Tokens can be controlled by characters
- Sessions belong to campaigns and have participants

## Troubleshooting

### Common Issues

1. **"Clerk can't detect usage of clerkMiddleware()"**
   - Ensure `middleware.ts` is properly configured
   - Check that routes are matched correctly

2. **"Different slug names for the same dynamic path"**
   - Ensure all routes use consistent parameter names (`[id]` not `[campaignId]`)

3. **Invite shows success but player can't see campaign**
   - Check `campaign_members` table for membership record
   - Verify RLS policies allow access
   - Check campaign query includes member filter

4. **Database connection issues**
   - Verify Supabase environment variables
   - Check RLS policies are not blocking access
   - Ensure service role key has proper permissions

### Debug Mode

Enable detailed logging by setting:
\`\`\`env
NODE_ENV=development
\`\`\`

Check browser console and server logs for detailed error information.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

## License

This project is licensed under the MIT License.
\`\`\`

Now let me create a comprehensive test for the complete invite workflow:
