# MJHK TV — Phase 4A CMS Foundation & Wiring Audit

## Goal

Phase 4 introduces the real administrator-facing control plane for MJHK TV.

Before any CMS write path is added, Phase 4A audits the existing admin
architecture and current Supabase TV contract.

No runtime TV behavior is changed in this phase.

## Planned CMS modules

The target CMS surface is:

```text
/admin/
  └── TV
      ├── Dashboard
      ├── Slideshow
      ├── Running Text
      ├── Dedicated Screens
      ├── Theme & Layout
      ├── Prayer Settings
      ├── Devices
      └── Publish & Revision
```

## Design principles

Phase 4 must reuse existing admin authentication and authorization.

It must not introduce a second independent admin login.

The browser CMS must not receive or expose the Supabase service-role secret.

TV player/device authentication remains independent from admin authentication.

Revision publishing remains the only configuration delivery boundary:

```text
CMS draft
→ validate
→ create immutable revision snapshot
→ publish / desired revision
→ existing Gateway
→ existing player revision pipeline
```

The CMS must not directly push configuration into a running TV player.

## Phase breakdown

```text
4A  Foundation & wiring audit
4B  CMS shell + TV dashboard
4C  Slideshow + Running Text editor
4D  Dedicated Screens + Theme/Layout + Prayer settings
4E  Devices + operational commands
4F  Publish/Revision workflow
4G  Final CMS → Revision → Gateway → TV acceptance
```

The exact numbering can be adjusted after the audit if the current admin
architecture suggests a safer integration order.

## Phase 4A actions

Run:

```bash
bash scripts/verify-tv-phase4a-audit-pack.sh
bash scripts/audit-tv-phase4a-cms-foundation.sh
```

Then run in Supabase SQL Editor:

```text
supabase/tv/phase4a-audit/00_cms_schema_contract_audit.sql
supabase/tv/phase4a-audit/01_cms_data_shape_audit.sql
```

## What to return for Phase 4B design

The useful outputs are:

```text
admin tree
auth/session/role findings
current Supabase client pattern
admin navigation/router pattern
TV schema columns
TV policies/RLS
TV RPC list
representative tv_content row
representative tv_config_revisions row
current device row
```

Do not share access tokens, session tokens, service-role keys, or secrets.

## Locked boundaries

Phase 4A must not modify:

```text
TVStateEngine
presentation binding
revision startup
revision ACK
heartbeat
command polling
command dispatcher
runtime recovery
Gateway Worker
database schema
RLS policies
```

It is an audit-only foundation phase.
