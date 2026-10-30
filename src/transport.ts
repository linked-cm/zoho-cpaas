/**
 * Zoho CPaaS email (formerly ZeptoMail): its settings from the environment and a transport that
 * sends one message through its send API (`POST /v1.1/email`, JSON). The API kept ZeptoMail's
 * host, auth scheme and variable names when the product was renamed.
 *
 * Pure Node (global `fetch`, injectable): no framework imports.
 */

/** The send endpoint in the US data centre; other regions have their own host. */
export const DEFAULT_API_URL = 'https://api.zeptomail.com/v1.1/email';
/** How a Mail Agent's send token is presented. */
export const KEY_PREFIX = 'Zoho-enczapikey ';
/** How long one send may take before it counts as failed. */
export const SEND_TIMEOUT_MS = 10_000;

export interface Sender {
  address: string;
  name?: string;
}

export interface ZohoCpaasSettings {
  /** The send token, without its `Zoho-enczapikey ` prefix. */
  apiKey: string;
  apiUrl: string;
  from: Sender;
}

/** An image the HTML shows as `cid:{cid}`. */
export interface InlineImage {
  cid: string;
  mimeType: string;
  content: Buffer;
}

/** One message as this package sends it. */
export interface OutgoingEmail {
  to: { address: string; name?: string }[];
  subject: string;
  html: string;
  text: string;
  /** Overrides the sender from the settings. */
  from?: Sender;
  bounceAddress?: string;
  inlineImages?: InlineImage[];
}

export interface EmailTransport {
  send(email: OutgoingEmail): Promise<void>;
}

export type Env = Record<string, string | undefined>;

const ADDRESS = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

/**
 * The settings, or `undefined` when `ZEPTOMAIL_API_KEY` is not set (no provider is registered).
 * Throws, naming the variable, for a value that cannot work.
 */
export function settingsFromEnv(env: Env): ZohoCpaasSettings | undefined {
  let apiKey = (env.ZEPTOMAIL_API_KEY ?? '').trim();
  if (!apiKey) return undefined;
  // the Mail Agent shows the token with its scheme; either form is accepted
  apiKey = apiKey.replace(/^zoho-enczapikey(\s+|$)/i, '');
  if (!apiKey || /\s/.test(apiKey)) throw new Error('ZEPTOMAIL_API_KEY is not a Zoho CPaaS send token');

  const apiUrl = (env.ZEPTOMAIL_API_URL ?? '').trim() || DEFAULT_API_URL;
  let url: URL;
  try {
    url = new URL(apiUrl);
  } catch {
    throw new Error(`ZEPTOMAIL_API_URL is not a URL: ${apiUrl}`);
  }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) {
    throw new Error(`ZEPTOMAIL_API_URL must be https (http only on localhost): ${apiUrl}`);
  }

  let address = (env.EMAIL_FROM ?? '').trim();
  if (!address) {
    let host = '';
    try {
      host = new URL(env.SITE_ROOT ?? '').hostname;
    } catch {
      // reported below
    }
    address = host ? `noreply@${host}` : '';
  }
  if (!ADDRESS.test(address)) {
    throw new Error(`EMAIL_FROM must be an address on a sender domain verified in Zoho CPaaS (got "${address}")`);
  }
  const name = (env.EMAIL_FROM_NAME ?? '').trim();
  return { apiKey, apiUrl: url.toString(), from: name ? { address, name } : { address } };
}

/** The API's JSON for one message. Tracking stays off: it would rewrite sign-in links. */
export function requestBody(email: OutgoingEmail, from: Sender): Record<string, unknown> {
  const sender = email.from ?? from;
  return {
    from: sender.name ? { address: sender.address, name: sender.name } : { address: sender.address },
    to: email.to.map(({ address, name }) => ({ email_address: { address, name: name || address } })),
    subject: email.subject,
    htmlbody: email.html,
    textbody: email.text,
    ...(email.bounceAddress ? { bounce_address: email.bounceAddress } : {}),
    ...(email.inlineImages?.length
      ? {
          inline_images: email.inlineImages.map((image) => ({
            cid: image.cid,
            mime_type: image.mimeType,
            content: image.content.toString('base64'),
          })),
        }
      : {}),
    track_clicks: false,
    track_opens: false,
  };
}

/** The API's error codes from a failed answer (`{error: {code, details: [{code}]}}`). */
async function errorCodes(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { code?: unknown; details?: { code?: unknown }[] } };
    const codes = [body.error?.code, ...(body.error?.details ?? []).map((d) => d?.code)].filter(
      (code): code is string => typeof code === 'string' && /^[A-Za-z0-9_]{1,32}$/.test(code)
    );
    return codes.length ? ` (${codes.join(', ')})` : '';
  } catch {
    return '';
  }
}

/**
 * Send through Zoho CPaaS. A failure rejects with the HTTP status and the API's error codes
 * only: never the key, the address, the subject or the body (which may carry links and codes).
 */
export function zohoCpaasTransport({
  settings,
  fetch: fetchImpl = fetch,
  timeoutMs = SEND_TIMEOUT_MS,
}: {
  settings: ZohoCpaasSettings;
  fetch?: typeof fetch;
  timeoutMs?: number;
}): EmailTransport {
  return {
    async send(email) {
      let response: Response;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(new DOMException('timed out', 'TimeoutError')), timeoutMs);
      try {
        response = await fetchImpl(settings.apiUrl, {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            authorization: `${KEY_PREFIX}${settings.apiKey}`,
          },
          body: JSON.stringify(requestBody(email, settings.from)),
          signal: controller.signal,
          redirect: 'error',
        });
      } catch (err) {
        const name = (err as Error)?.name;
        throw new Error(
          name === 'TimeoutError'
            ? `Zoho CPaaS did not answer in ${timeoutMs} ms`
            : `Zoho CPaaS could not be reached (${name ?? 'error'})`
        );
      } finally {
        clearTimeout(timer);
      }
      if (!response.ok) throw new Error(`Zoho CPaaS refused the email: ${response.status}${await errorCodes(response)}`);
      await response.body?.cancel().catch(() => {});
    },
  };
}
