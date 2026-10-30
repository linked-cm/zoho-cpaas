import { BackendProvider } from '@_linked/server-utils/utils/BackendProvider';
import { LinkedEmail } from '@_linked/server-utils/utils/LinkedEmail';
import { zohoCpaasProvider } from './provider.js';
import './package.js';
import { settingsFromEnv, zohoCpaasTransport } from './transport.js';

/**
 * Registers Zoho CPaaS as `LinkedEmail`'s provider when `ZEPTOMAIL_API_KEY` is set. Without it
 * nothing is registered, so in development `@_linked/auth` prints what it would have emailed.
 * A setting that cannot work stops the boot with a message naming the variable.
 */
export default class ZohoCpaasBackendProvider extends BackendProvider {
  setupBeforeControllers() {
    registerFromEnv(process.env);
  }
}

/** What `setupBeforeControllers` does, for an environment; returns whether it registered. */
export function registerFromEnv(
  env: Record<string, string | undefined>,
  options: { fetch?: typeof globalThis.fetch } = {}
): boolean {
  const settings = settingsFromEnv(env);
  if (!settings) return false;
  const transport = zohoCpaasTransport({ settings, ...(options.fetch ? { fetch: options.fetch } : {}) });
  LinkedEmail.setDefaultProvider(zohoCpaasProvider({ transport }));
  console.log(`[zoho-cpaas] email is sent through Zoho CPaaS from ${settings.from.address}`);
  return true;
}
