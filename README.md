# FlintRacing.org-
Hands-on STEM program for youth and families. Build Soap Box Derby Vehicles, 3D-Printing, STEAM projects and more! 



Public site for Flint Racing & STEM, Flint, Michigan.

- `index.html` — the whole public site (pages switch by the address `#`, e.g. `#calendar`).
- `img/` — logos, partner logos and photos used by the site.
- `source/` — the editable source (`index.src.html`) and `build.py`, which produces `index.html`.

## Publishing
GitHub Pages serves this repository from the `main` branch, root folder.

## Admin portal (Supabase)
- Go to `#admin` on the live site (or Sign in → Admin).
- Admins can edit any text or photo in place ("Edit the site"), manage calendar events and monthly bulletin notes, and read questionnaire inquiries.
- Data lives in the Supabase project **FlintRacingandSTEM**: tables `site_content`, `events`, `bulletin_notes`, `inquiries`, `admins`, and the `site-images` storage bucket. Row-level security lets the public read site content and send inquiries; only admins can change anything.
- If Supabase can't be reached, the site falls back to the content built into `index.html`.

## Email (added Nov 16, 2026)
- **Admin → Email**: each admin chooses which alerts reach their inbox (new inquiries, profiles, signed registration forms, race-day volunteers, kiosk registrations), edits the pre-approved messages, sends updates to subscribers, sees sent mail, and sets the sender details.
- **Email a reply** on any inquiry, member or registration sends a pre-approved message to the address on that record. Members pick their own emails when they register and on My dashboard; every update carries an unsubscribe link (`#unsubscribe/...`).
- How it works: database triggers put messages in a private queue (`private.email_outbox`); the Supabase edge function `send-email` delivers them through Resend and retries failures. The scripts are in `source/email/` (already applied in Supabase; kept here for reference). They contain no keys.
- One-time setup: add a `RESEND_API_KEY` secret under Supabase → Edge Functions → Secrets, then verify flintracing.org in Resend and save a "from" address in Admin → Email → Setup. Until then nothing is sent; alerts and replies wait in the queue for up to 7 days.

## Coming next
- Portals: Program Dashboard, Teacher planning, Photographer, Race Day, Building Workshop sign-in, and the live race view.
