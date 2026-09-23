# MJHK TV Phase 4D-A2 — Supabase Client Wiring Hotfix

Root cause:

```text
tv-dedicated-screens.js
→ imported ./config.js
→ /admin/config.js 404
→ module boot stopped
```

Existing CMS pages use:

```js
const db = window.mjhkSupabase;
```

This hotfix:
- removes the standalone createClient import;
- removes ./config.js;
- reuses window.mjhkSupabase;
- mirrors the existing bootstrap script chain from tv-running-text.html;
- keeps Dedicated Screens page logic intact.

No Supabase schema change.
No URL/key hardcoding.
No service role.
No revision publish.
