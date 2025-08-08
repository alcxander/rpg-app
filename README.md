# Tabletop RPG Collaboration App

Real-time collaborative RPG app with Supabase Realtime, Clerk authentication, and AI-powered generators.

## What changed (this update)

- Canvas map:
  - Full-height center canvas that fits the viewport; sidebars scroll independently.
  - Smoother pan/zoom (spacebar + drag, middle/right-drag, scroll to zoom).
  - Circular tokens with soft borders (red for enemies, blue for players).
  - Default grid size is 20x20 when not provided.
  - Background image support: uses LLM-generated background if available; otherwise falls back to `/1.jpg`.

- DM Tools moved to a top hover tab in the header.

- Battles switcher:
  - A dropdown above “Current Battle” shows all battles in the session (by timestamp).
  - Selecting a battle loads its previous activity log.

- Chat UX:
  - Timestamps, me-alignment to the right, others to the left, and disabled send button while sending.

- Stability AI integration:
  - New `/api/generate-map` route that generates a bright, vibrant, top-down battle map image.
  - `/api/generate-battle` now calls Stability to set the map `background_image`.

- Database:
  - New migration adding `maps.background_image` (TEXT).

## Setup Steps

1) Clerk + Supabase (from earlier)
- Ensure JWT template and Supabase JWT verification are configured correctly (RS256 via JWKS or HS256 shared secret).
- Use TEXT user IDs and RLS policies with `auth.jwt()->>'sub'` (already in `scripts/init-db.sql`) [^5].

2) Run the new SQL migration
- In Supabase SQL Editor, run:
  - `scripts/v3-add-background.sql`

3) Stability AI
- Create a Stability API key at platform.stability.ai.
- In your environment add:
  - `STABILITY_API_KEY=YOUR_STABILITY_API_KEY`
- The image route is: `POST /api/generate-map` accepting `{ "prompt": "..." }`.
- `/api/generate-battle` automatically calls Stability with a structured prompt to get a vibrant, top-down background image.

4) LLM text generation
- We keep using the AI SDK for structured text generation (OpenAI) for monster/PC stats and initial logs [^6].
- Ensure `OPENAI_API_KEY` is set.

5) Local testing checklist
- Sign out, clear local storage, then sign in.
- Click DM Tools → Generate Battle to create a new map + battle.
- Use the Battles dropdown (right sidebar) to switch between prior battles; activity log updates accordingly.
- Try panning and zooming the map: spacebar or middle/right-drag to pan; scroll to zoom.
- If Stability is not configured, map falls back to `/1.jpg` (add numbered images like `/1.jpg`, `/2.jpg`, … in public).

## Notes

- If you see PostgREST auth errors (e.g., PGRST301), revisit JWT config and ensure the Clerk token matches your Supabase expectations (RS256+JWKS vs HS256) [^5].
- The AI SDK centralizes LLM usage; swapping or tuning models is simple and contained [^6].

[^5]: Setting up SSR clients and server actions with Supabase and migrating from auth-helpers to SSR package.  
[^6]: Vercel AI SDK for standardized LLM usage with `generateText`/`streamText`.
