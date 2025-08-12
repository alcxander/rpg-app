# RPG Collaboration Platform

A real-time tabletop RPG collaboration platform built with Next.js, Supabase, and Clerk.

## Features

- **Campaign Management**: Create and manage RPG campaigns
- **Player Invites**: Invite players to join campaigns with proper membership tracking
- **Character System**: Create and manage characters with stats, inventory, and gold
- **Interactive Maps**: Drag-and-drop token system with ownership permissions
- **Shop System**: DM-controlled shops with purchase transactions
- **Real-time Updates**: Live synchronization across all connected clients

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes, Supabase (PostgreSQL + Realtime)
- **Authentication**: Clerk
- **Testing**: Vitest, Playwright (E2E)

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account
- Clerk account

### Environment Variables

Create a `.env.local` file with:

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

# Optional: AI/Image Generation
OPENAI_API_KEY=your_openai_key
STABILITY_API_KEY=your_stability_key
\`\`\`

### Installation

1. **Clone and install dependencies:**
   \`\`\`bash
   git clone <repository-url>
   cd rpg-app
   npm install
   \`\`\`

2. **Run database migrations:**
   \`\`\`bash
   # Execute each migration file in order in your Supabase SQL editor:
   # scripts/v14-campaign-members.sql
   # scripts/v15-characters.sql  
   # scripts/v16-token-ownership.sql
   # scripts/v17-session-participants.sql
   # scripts/v18-players-gold-unique.sql
   \`\`\`

3. **Seed test data (optional):**
   \`\`\`bash
   npm run seed-test-data
   \`\`\`

4. **Start development server:**
   \`\`\`bash
   npm run dev
   \`\`\`

5. **Open [http://localhost:3000](http://localhost:3000)**

## Testing

### Unit Tests

Run API and component unit tests:

\`\`\`bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
\`\`\`

### Manual Testing - Iteration 1 (Invite Flow)

#### Prerequisites
1. Run database migrations
2. Seed test data: `npm run seed-test-data`
3. Start dev server: `npm run dev`

#### Test Cases

**✅ Successful Invite Flow:**
1. Sign in as DM (dm-user-123)
2. Navigate to `/campaigns/test-campaign-123/settings`
3. Go to "Invite Players" tab
4. Enter user ID: `player-456`
5. Click "Send Invite"
6. **Expected**: Green success toast, user added to members list
7. Check "Members" tab - should show Test Player 1

**✅ Duplicate Invite Handling:**
1. Try inviting `player-456` again
2. **Expected**: "Already a member" toast (not an error)

**✅ Non-existent User:**
1. Try inviting `fake-user-999`
2. **Expected**: Red error toast "User not found"

**✅ Permission Validation:**
1. Sign out and sign in as `player-456`
2. Try accessing `/campaigns/test-campaign-123/settings`
3. **Expected**: Access denied or redirect

**✅ Database Verification:**
Check Supabase tables after successful invite:
- `campaign_members`: New row for player-456
- `players_gold`: Row exists for player-456 + campaign
- `session_participants`: Player added to active sessions

### Edge Cases Discovered & Mitigated

1. **Concurrent Invites**: Using `ON CONFLICT DO NOTHING` prevents duplicate key errors
2. **Orphaned Data**: CASCADE foreign keys clean up related data
3. **Permission Edge Cases**: Dual validation (campaign owner + member role)
4. **Realtime Failures**: Non-blocking realtime events don't fail the request
5. **Legacy Compatibility**: Updates both normalized tables and JSONB fields

### API Testing with curl

\`\`\`bash
# Test invite endpoint (replace with actual auth token)
curl -X POST http://localhost:3000/api/campaigns/test-campaign-123/invite \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -d '{"inviteeId": "player-789"}'

# Test members endpoint  
curl http://localhost:3000/api/campaigns/test-campaign-123/members \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN"
\`\`\`

## Database Schema

### New Tables (Iteration 1)

- **campaign_members**: Explicit campaign membership with roles
- **characters**: Player characters with stats, HP, gold, and inventory
- **character_inventories**: Per-character item storage
- **session_participants**: Normalized session membership
- **Enhanced tokens**: Added ownership and position tracking

### Key Relationships

\`\`\`
campaigns (1) -> (*) campaign_members -> (*) users
campaigns (1) -> (*) characters -> (*) character_inventories  
characters (1) -> (*) tokens (controlled_by_character_id)
sessions (1) -> (*) session_participants -> (*) users
sessions (1) -> (*) tokens
\`\`\`

## Security Model

- **Authentication**: Clerk handles user auth and session management
- **Authorization**: Row Level Security (RLS) policies on all tables
- **Campaign Access**: Only owners and members can access campaign data
- **Token Ownership**: Players can only move their own tokens (DMs can move any)
- **Shop Permissions**: Only DMs can toggle shop visibility and grant gold

## Realtime Events

### Channels
- `campaign:{campaignId}` - Campaign-level events (member added, shop toggled)
- `session:{sessionId}` - Session events (token moved, battle started)
- `user:{userId}` - User-specific events (gold granted)

### Event Types
- `CAMPAIGN_MEMBER_ADDED` - New player joined campaign
- `TOKEN_MOVED` - Token position updated
- `SHOP_PURCHASE` - Item purchased from shop
- `GOLD_UPDATED` - Player gold balance changed

## Next Steps - Iteration 2

- [ ] Character creation and management UI
- [ ] Token spawning from characters  
- [ ] Draggable canvas map with Fabric.js
- [ ] Token ownership and movement permissions
- [ ] Real-time token synchronization

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Run the test suite
5. Submit a pull request

## License

MIT License - see LICENSE file for details
