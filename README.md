# Tabletop RPG Collaboration App

Real-time collaborative RPG app with Supabase Realtime, Clerk authentication, and AI-powered generators.

## What's New - Iteration 1: Invite Flow & Campaign Membership

### Features Added
- **Campaign Membership System**: New `campaign_members` table for explicit membership tracking
- **Character System**: Full character creation and management with per-character gold
- **Token Ownership**: Tokens now have owners and permission-based movement
- **Improved Invite Flow**: Bulletproof invite system with proper error handling and realtime updates

### Database Changes
- Added `campaign_members` table with RLS policies
- Added `characters` and `character_inventories` tables
- Enhanced `tokens` table with ownership and position tracking
- Added `session_participants` normalized table
- Added unique constraints for data integrity

### API Endpoints Added
- `POST /api/campaigns/:campaignId/invite` - Invite users to campaigns
- `GET /api/campaigns/:campaignId/members` - List campaign members

### Frontend Components Added
- `InviteUserForm` - Form to invite users with toast notifications
- `CampaignMembersList` - Display campaign members with roles
- Campaign settings page with tabbed interface

## Setup Steps

### 1. Database Setup
Run the new migration files in your Supabase SQL Editor:

\`\`\`sql
-- Run these in order:
scripts/v14-campaign-members.sql
scripts/v15-characters.sql  
scripts/v16-token-ownership.sql
scripts/v17-session-participants.sql
scripts/v18-players-gold-unique.sql
\`\`\`

### 2. Environment Variables
Ensure these are set in your `.env.local`:

\`\`\`bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# AI (for future iterations)
OPENAI_API_KEY=your_openai_api_key
STABILITY_API_KEY=your_stability_api_key
\`\`\`

### 3. Install Dependencies & Run

\`\`\`bash
npm install
npm run dev
\`\`\`

### 4. Seed Test Data (Optional)

\`\`\`bash
npx tsx scripts/seed-test-data.ts
\`\`\`

This creates test users and a campaign for manual testing.

## Testing

### Run Unit Tests

\`\`\`bash
npm test
\`\`\`

### Manual Testing Checklist

#### Invite Flow Testing
1. **Setup**: Use seeded test data or create users manually
2. **DM Invite Success**: 
   - Login as DM (dm-user-123)
   - Go to `/campaigns/test-campaign-123/settings`
   - Invite player-user-456
   - Should see green success toast
   - Check database: `campaign_members` should have new row
3. **Player Access**: 
   - Login as invited player
   - Should see campaign in campaigns list
   - Should be able to access campaign pages
4. **Duplicate Invite**: 
   - Try inviting same user again
   - Should see "Already a member" message
5. **Error Cases**:
   - Try inviting non-existent user → should see error toast
   - Try inviting as non-DM → should see permission error

#### Database Integrity Testing
1. Check `campaign_members` table has proper foreign key constraints
2. Verify RLS policies prevent unauthorized access
3. Test that `players_gold` rows are created automatically on invite

### Edge Cases Discovered

1. **Concurrent Invites**: Multiple DMs inviting same user simultaneously could cause race conditions
   - **Mitigation**: Using `ON CONFLICT DO NOTHING` with proper error handling

2. **Orphaned Sessions**: If campaign is deleted, session participants might remain
   - **Mitigation**: CASCADE deletes in foreign key constraints

3. **Permission Edge Case**: User could be campaign member but not session participant
   - **Mitigation**: Invite flow now adds to both tables

4. **Realtime Event Delivery**: Events might not reach all clients if connection drops
   - **Mitigation**: Client-side refresh mechanisms and optimistic updates

## API Testing with curl

### Test Invite Endpoint

\`\`\`bash
# Success case (replace with real auth token)
curl -X POST http://localhost:3000/api/campaigns/test-campaign-123/invite \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -d '{"inviteeId": "player-user-456"}'

# Expected response:
# {"ok": true, "member": {...}, "already_member": false}
\`\`\`

### Test Members Endpoint

\`\`\`bash
curl -X GET http://localhost:3000/api/campaigns/test-campaign-123/members \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN"

# Expected response:
# {"members": [{"id": "...", "user_id": "...", "role": "Player", ...}]}
\`\`\`

## Next Steps (Iteration 2)

- Character creation and management UI
- Token spawning and ownership system  
- Draggable canvas map with permission enforcement
- Realtime token movement synchronization

## Troubleshooting

### Common Issues

1. **"User not found" errors**: Ensure test users exist in `users` table
2. **Permission denied**: Check RLS policies and user authentication
3. **Realtime not working**: Verify Supabase realtime is enabled for tables
4. **Tests failing**: Run `npm run test:setup` to ensure test environment is configured

### Debug Mode

Set `DEBUG=true` in environment to enable detailed API logging.

---

## Previous Features

- Canvas map with full-height center canvas and smooth pan/zoom
- Circular tokens with soft borders (red for enemies, blue for players)
- DM Tools in hover tab with battle generation
- Battles switcher dropdown with activity log loading
- Chat UX with timestamps and user alignment
- Stability AI integration for map generation
- Database with comprehensive RLS policies
