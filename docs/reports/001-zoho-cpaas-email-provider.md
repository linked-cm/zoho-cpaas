---
summary: >
  The package's first version: webid.email's ZeptoMail transport and LinkedEmail provider lifted
  out as @linked.cm/zoho-cpaas, a BackendProvider that registers with LinkedEmail only when
  ZEPTOMAIL_API_KEY is set; webid.email's env var names kept.
status: Done
---

# 001 — Zoho CPaaS email provider

Step MAIL-1 of create-now plan 311 (decision E15): ZeptoMail is now Zoho CPaaS; brand-specific
providers live in linked-cm.

## What was built

- `src/transport.ts`: settings from the environment and a `fetch` transport (lifted from
  webid.email's `src/email/zeptomail.ts`). Changes: the sender name has no default (it was
  `webid.email`), a message may carry its own `from` and `bounce_address`, errors say "Zoho CPaaS".
- `src/provider.ts`: `htmlToText`, `toOutgoingEmail` (`EmailOptions` → message with a text part),
  `zohoCpaasProvider`, `emailProviderFromEnv` (from webid.email's `provider.ts` and `setup.ts`).
- `src/backend.ts`: the default-exported `BackendProvider`; `setupBeforeControllers()` calls
  `LinkedEmail.setDefaultProvider` only when `ZEPTOMAIL_API_KEY` is set and logs the sender address.
- Not lifted, as decided: webid.email's templates, branding, bounces, monitoring hook, and its
  production check (a production server without a key refuses to start there). Here no key means
  no provider, with no warning (E15: not every app sends email).

**Env var names kept** (`ZEPTOMAIL_API_KEY`, `ZEPTOMAIL_API_URL`, `EMAIL_FROM`, `EMAIL_FROM_NAME`):
the API itself still says ZeptoMail, and webid.email can switch to this package without
changing its deployments.

**Dependencies:** `@_linked/core` and `@_linked/server-utils`, as `@_linked/sentry` does; not
`@_linked/server` (the provider needs only `BackendProvider` and `LinkedEmail`, both in
server-utils). No `linked.provides` (deferred by the owner).

## Phases and validation

| Phase | What | Validation |
|---|---|---|
| 1 | Scaffold from linked-cm/livekit (tsconfigs, changesets, workflows, renovate, `.npmrc`) and `@_linked/sentry` (`linked.kind`, backend export) | `npm install` |
| 2 | Transport, provider, backend, tests | `npm test`: 9/9 pass; `npm run typecheck` clean |
| 3 | Build and pack | `npx linked build`: "Build successful"; `npm pack --dry-run`: `lib/esm/*` (5 modules with maps and types), README, LICENSE, package.json |

## Follow-ups

- The owner creates linked-cm/zoho-cpaas, pushes and publishes 0.1.0 (no changeset: the first
  version is the one in package.json).
- webid.email can replace `zeptomail.ts` with `zohoCpaasTransport` (its templates stay); not
  recorded as a backlog item there, since webid.email is read-only for this step.
- Plan 311's NOTE-3 sends through `LinkedEmail`; CN adds this package to send for real.
