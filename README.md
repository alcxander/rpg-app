# RPG Collaboration Platform

A real-time tabletop RPG collaboration platform built with Next.js, Supabase, and Clerk.

## Features

- **Campaign Management**: Create and manage RPG campaigns
- **Real-time Sessions**: Live collaboration with maps, tokens, and chat
- **Character System**: Create and manage characters with stats and inventory
- **Shop System**: In-game shops with inventory management
- **Battle System**: Initiative tracking and combat management
- **Invite System**: Invite players to campaigns with proper permissions

## Getting Started

### Prerequisites

- Node.js 18+ 
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

# OpenAI (for AI features)
OPENAI_API_KEY=your_openai_api_key

# Stability AI (for image generation)
STABILITY_API_KEY=your_stability_api_key
\`\`\`

### Database Setup

1. Run the database migrations in order:

\`\`\`bash
# Run migrations in your Supabase SQL editor
# Execute each file in order:
scripts/init-db.sql
scripts/v2-add-messages.sql
scripts/v3-add-background.sql
scripts/v4-battles-name.sql
scripts/v5-battles-background.sql
scripts/v6-battles-update.sql
scripts/v7-battles-initiative.sql
scripts/v8-sessions-uuid.sql
scripts/v9-shopkeepers.sql
scripts/v10-shopkeepers-removed.sql
scripts/v11-add-image-url.sql
scripts/v12-fix-shopkeeper-tables.sql
scripts/v13-add-quantity-and-rls.sql

# New migrations for invite system:
scripts/v14-campaign-members.sql
scripts/v15-characters.sql
scripts/v16-token-ownership.sql
scripts/v17-session-participants.sql
scripts/v18-players-gold-unique.sql
\`\`\`

2. Seed test data (optional):

\`\`\`bash
npm run seed-test-data
\`\`\`

### Installation

1. Clone the repository
2. Install dependencies:

\`\`\`bash
npm install
\`\`\`

3. Run the development server:

\`\`\`bash
npm run dev
\`\`\`

4. Open [http://localhost:3000](http://localhost:3000) in your browser

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

### Manual Testing - Invite Flow

1. **Setup Test Data**:
   \`\`\`bash
   npm run seed-test-data
   \`\`\`

2. **Test Successful Invite**:
   - Login as DM (test-dm-user)
   - Navigate to `/campaigns/test-campaign-id/settings`
   - Go to "Invite Players" tab
   - Enter `test-player-1` in the user ID field
   - Click "Send Invite"
   - Should see green success toast
   - Check "Members" tab to see the new member

3. **Test Duplicate Invite**:
   - Try inviting `test-player-1` again
   - Should see "Already a member" message

4. **Test Invalid User**:
   - Try inviting `non-existent-user`
   - Should see red error toast "User not found"

5. **Test Permission Validation**:
   - Login as a regular player
   - Try to access campaign settings
   - Should be denied access

### Manual Testing Checklist

- [ ] DM can invite players successfully
- [ ] Duplicate invites show appropriate message
- [ ] Invalid user IDs show error
- [ ] Non-owners cannot invite players
- [ ] Invited players appear in members list
- [ ] Real-time updates work (test with multiple browser tabs)
- [ ] Database integrity maintained (check campaign_members table)
- [ ] Session participants updated correctly
- [ ] Gold records created for new members

## API Endpoints

### Campaign Management

- `POST /api/campaigns/:id/invite` - Invite user to campaign
- `GET /api/campaigns/:id/members` - Get campaign members

### Characters (Coming in Iteration 2)

- `POST /api/characters` - Create character
- `GET /api/users/:userId/characters` - Get user's characters
- `POST /api/sessions/:sessionId/characters/:characterId/spawn` - Spawn character token

### Tokens (Coming in Iteration 2)

- `POST /api/sessions/:sessionId/tokens/:tokenId/move` - Move token
- `DELETE /api/sessions/:sessionId/tokens/:tokenId` - Remove token

### Shops (Coming in Iteration 3)

- `POST /api/campaigns/:id/shop-toggle` - Toggle shop visibility
- `POST /api/shops/:shopId/buy` - Purchase item
- `POST /api/campaigns/:id/give-gold` - DM give gold to player

## Architecture

### Database Schema

- **campaigns**: Campaign information
- **campaign_members**: Explicit campaign membership
- **users**: User profiles
- **sessions**: Game sessions
- **session_participants**: Session membership
- **characters**: Player characters
- **character_inventories**: Character items
- **tokens**: Map tokens with ownership
- **players_gold**: Gold tracking per player/campaign

### Real-time Events

- **campaign:{campaignId}**: Campaign-level events (member added, shop toggled)
- **session:{sessionId}**: Session-level events (token moved, battle started)
- **user:{userId}**: User-specific events (gold granted)

## Development

### Code Structure

- `/app` - Next.js App Router pages and API routes
- `/components` - Reusable React components
- `/lib` - Utility functions and configurations
- `/hooks` - Custom React hooks
- `/scripts` - Database migrations and seed scripts
- `/types` - TypeScript type definitions

### Testing Strategy

- **Unit Tests**: API endpoints and utility functions
- **Integration Tests**: Database operations and real-time events
- **Manual QA**: User flows and edge cases
- **E2E Tests**: Complete user journeys (Iteration 3)

## Deployment

1. Deploy to Vercel or similar platform
2. Set environment variables in deployment platform
3. Run database migrations in production Supabase
4. Configure Clerk production settings
5. Test invite flow in production environment

## Contributing

1. Create feature branch from main
2. Implement changes with tests
3. Run test suite and manual QA
4. Submit PR with migration files and documentation
5. Deploy after review and approval

## Troubleshooting

### Common Issues

1. **"Clerk can't detect usage of clerkMiddleware()"**
   - Ensure middleware.ts is properly configured
   - Check that API routes use correct auth imports

2. **"Different slug names for the same dynamic path"**
   - Ensure consistent route naming ([id] vs [campaignId])
   - Check for conflicting route files

3. **Database connection errors**
   - Verify Supabase environment variables
   - Check RLS policies are properly configured

4. **Real-time events not working**
   - Verify Supabase real-time is enabled
   - Check channel subscriptions and event names

### Debug Mode

Enable debug logging by setting:

\`\`\`env
NODE_ENV=development
\`\`\`

This will show detailed API request/response logs in the console.
