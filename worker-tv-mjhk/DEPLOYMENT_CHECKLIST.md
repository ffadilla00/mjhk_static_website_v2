# Phase 2C Deployment Checklist

1. Extract the pack into repository root.
2. Run:
   ```bash
   bash scripts/verify-tv-phase2c-pack.sh
   ```
3. Enter Worker:
   ```bash
   cd worker-tv-mjhk
   npm install
   npm run check
   ```
4. Add secret:
   ```bash
   npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
   ```
   Paste the secret only into Wrangler's prompt.
5. Deploy:
   ```bash
   npm run deploy
   ```
6. Record the Worker URL.
7. From repository root run:
   ```bash
   bash scripts/smoke-tv-gateway.sh https://<worker>.workers.dev
   ```
8. Add Cloudflare rate limiting before any real pairing.
9. Do not pair the production mosque TV yet.
10. First test one temporary device end-to-end:
    - register
    - pair
    - bootstrap
    - heartbeat
    - publish revision
    - fetch revision
    - ACK revision
    - pull/ACK command
    - upload screenshot
    - revoke device
11. Run existing website regression smoke.
12. Commit and lock Phase 2C only after all tests are clean.
