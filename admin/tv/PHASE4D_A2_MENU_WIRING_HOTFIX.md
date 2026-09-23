# MJHK TV Phase 4D-A2 — Menu Wiring Hotfix

## Root cause

Existing MJHK TV CMS pages use:

```html
<button type="button" class="menu-link disabled" disabled>
  Dedicated Screens <small>Phase 4D</small>
</button>
```

The original A2 apply script expected older `<span>` / disabled-link shapes.

## Hotfix

Only the Dedicated Screens menu item is changed to:

```html
<a class="menu-link" href="tv-dedicated-screens.html">Dedicated Screens</a>
```

on:

```text
admin/tv.html
admin/tv-content.html
admin/tv-running-text.html
```

The following remain disabled:

```text
Theme & Layout
Prayer Settings
Devices
Publish & Revision
```

No Supabase, player, or revision changes are included.
