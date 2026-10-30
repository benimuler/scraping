# Packaging prep — דו קרב תמונות - ידע כללי (local only, NOT pushed)

Benny picked the title (WhatsApp Oct 25, 15:17): **דו קרב תמונות - ידע כללי** (24 chars, fits Play's 30).

## Files
- `manifest.webmanifest` -> deploy to `public/manifest.webmanifest`; add `<link rel="manifest" href="/manifest.webmanifest">` to the three HTML pages (index/player/board).
- `icons/` -> deploy to `public/icons/` (192, 512, maskable 512). Neutral arena-grid icon, no הזירה wordmark — survives any name.
- `assetlinks.TEMPLATE.json` -> deploy to `public/.well-known/assetlinks.json` ONLY after the signing key exists:
  - package_name: chosen once, permanent for the Play app entry. Suggestion: `com.benimuler.picduel` (consistent with com.benimuler.blockblast).
  - sha256 fingerprint: from Benny's upload keystore (or Play App Signing cert once the app exists in Play Console).

## Remaining user-owned gates before any push/publish
1. Push to repo auto-deploys to the live site -> Benny's explicit go.
2. Play app entry creation fixes package name forever.
3. Store listing text, content rating, data-safety, privacy policy URL — user-reviewed declarations, not invented.
4. Account-deletion: code ready locally (DELETE /api/me + UI), ships in same push; Play declaration points at the game's account screen URL.
5. Render cold start (~20s) — Benny decides hosting tier before production; fine for closed test.
