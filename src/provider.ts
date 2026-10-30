/**
 * The `LinkedEmail` provider: takes the message the app (or `@_linked/auth`) built, adds a plain
 * text part made from its HTML, and sends it through Zoho CPaaS.
 *
 * Only type imports from the framework, so it loads without a server.
 */
import type { EmailOptions, IEmailProvider } from '@_linked/server-utils/utils/LinkedEmail';
import { settingsFromEnv, zohoCpaasTransport, type EmailTransport, type Env, type OutgoingEmail } from './transport.js';

/** A plain text version of an HTML email: links kept as their URLs, tags dropped. */
export function htmlToText(html: string): string {
  const decode = (text: string) =>
    text
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&');
  return decode(
    html
      .replace(/<(style|head)[^>]*>[\s\S]*?<\/\1>/gi, '')
      .replace(/<a\b[^>]*\bhref=(['"])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi, (_m, _q, href: string, label: string) => {
        const text = label.replace(/<[^>]+>/g, '').trim();
        return text && text !== href ? `${text}: ${href}` : href;
      })
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|tr|h[1-6]|li|table)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  )
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** `LinkedEmail`'s options as one outgoing message, with a text part from the HTML. */
export function toOutgoingEmail(options: EmailOptions): OutgoingEmail {
  return {
    to: options.to.map(({ email_address }) => ({ address: email_address.address, name: email_address.name })),
    subject: options.subject,
    html: options.htmlbody,
    text: htmlToText(options.htmlbody),
    ...(options.from ? { from: { address: options.from.address, name: options.from.name } } : {}),
    ...(options.bounce_address ? { bounceAddress: options.bounce_address } : {}),
  };
}

export function zohoCpaasProvider({ transport }: { transport: EmailTransport }): IEmailProvider {
  return {
    send: (options) => transport.send(toOutgoingEmail(options)),
  };
}

/**
 * The provider for this environment, or `undefined` without `ZEPTOMAIL_API_KEY`. Throws when a
 * setting cannot work.
 */
export function emailProviderFromEnv(env: Env, { fetch }: { fetch?: typeof globalThis.fetch } = {}): IEmailProvider | undefined {
  const settings = settingsFromEnv(env);
  if (!settings) return undefined;
  return zohoCpaasProvider({ transport: zohoCpaasTransport({ settings, ...(fetch ? { fetch } : {}) }) });
}
