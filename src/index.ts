// Registers the package with @_linked/core whichever entry a consumer imports.
import './package.js';
// The root entry: the transport, the settings and the provider, with no server dependency.
// `./backend` is the BackendProvider an app loads to register the provider with LinkedEmail.
export {
  DEFAULT_API_URL,
  KEY_PREFIX,
  SEND_TIMEOUT_MS,
  requestBody,
  settingsFromEnv,
  zohoCpaasTransport,
  type EmailTransport,
  type InlineImage,
  type OutgoingEmail,
  type Sender,
  type ZohoCpaasSettings,
} from './transport.js';
export { emailProviderFromEnv, htmlToText, toOutgoingEmail, zohoCpaasProvider } from './provider.js';
