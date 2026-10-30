# @linked.cm/zoho-cpaas

An email provider for LINKED apps: it sends `LinkedEmail` messages (`@_linked/server-utils`), such
as `@_linked/auth`'s sign-in codes and verification links, through
[Zoho CPaaS](https://www.zoho.com/zeptomail/) (called ZeptoMail until September 2026). The API
is unchanged: `POST https://api.zeptomail.com/v1.1/email` with `Authorization: Zoho-enczapikey …`.

## Use

```bash
npm install @linked.cm/zoho-cpaas
```

The package's `./backend` is a `BackendProvider`. At boot it registers the provider with
`LinkedEmail` **only when `ZEPTOMAIL_API_KEY` is set**. Without the key nothing is registered:
in development `@_linked/auth` then prints what it would have emailed to the server log.

| Variable | Required | Meaning |
|---|---|---|
| `ZEPTOMAIL_API_KEY` | to send | The Mail Agent's send token, with or without its `Zoho-enczapikey ` prefix. |
| `ZEPTOMAIL_API_URL` | no | The send endpoint of your region. Default `https://api.zeptomail.com/v1.1/email` (US); `https` only, `http` only on localhost. |
| `EMAIL_FROM` | no | The sender address, on a domain verified in the Mail Agent. Default `noreply@` the host of `SITE_ROOT`. |
| `EMAIL_FROM_NAME` | no | The sender's display name. Default none. |

A message's own `from` and `bounce_address` (in `EmailOptions`) win over these. Each email gets a
plain text part made from its HTML; click and open tracking stay off, so links are not
rewritten. A setting that cannot work stops the boot with a message naming the variable.

A failed send rejects with the HTTP status and the API's error codes only, for example
`Zoho CPaaS refused the email: 401 (TM_3201, SERR_157)`: never the key, the address, the subject
or the body.

Without the framework, the root entry exposes the pieces: `emailProviderFromEnv(env)`,
`zohoCpaasProvider({transport})`, `zohoCpaasTransport({settings, fetch?})`, `settingsFromEnv(env)`,
`htmlToText(html)`.

## Develop

`npm install && npm run build && npm test && npm run typecheck`. The tests load the built `lib/`
with a mocked `fetch`; nothing is sent.
