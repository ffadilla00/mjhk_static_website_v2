# Phase 4D-B1 UI Recovery Decision

Canonical CMS shell source: `admin/tv-dedicated-screens.html`.

Theme & Layout must use:
- `tv-admin.css`;
- `.sidebar`;
- `.brand`;
- `.menu-section-title`;
- `.content`;
- `.topbar`;
- `.top-actions`;
- `../assets/js/supabase-client.js`;
- authenticated session guard before source loading.

Page CSS may style Theme-specific content, but must not redefine the global CMS shell.
