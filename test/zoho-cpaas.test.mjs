import assert from 'node:assert/strict';
import test from 'node:test';
import { LinkedEmail } from '@_linked/server-utils/utils/LinkedEmail';
import { registerFromEnv } from '../lib/esm/backend.js';
import { htmlToText, settingsFromEnv, zohoCpaasTransport, DEFAULT_API_URL } from '../lib/esm/index.js';

/** Tests load the built `lib/` the way an app does: run `npm run build` first. */

const KEY = 'wSsVR61-secret-token';
const ENV = { ZEPTOMAIL_API_KEY: KEY, EMAIL_FROM: 'noreply@example.org', EMAIL_FROM_NAME: 'Example' };

/** A fetch that records each call and answers with `answer`. */
function mockFetch(answer = () => new Response('{"data":[]}', { status: 201 })) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return answer();
  };
  return { fetch, calls };
}

const message = {
  to: [{ email_address: { address: 'ada@example.com', name: 'Ada' } }],
  subject: 'Your sign-in code',
  htmlbody: '<p>Hello&nbsp;Ada,</p><p>Use <b>1234</b> or <a href="https://app.example/s?c=1">sign in</a>.</p>',
};

test('without ZEPTOMAIL_API_KEY nothing is registered', () => {
  const before = LinkedEmail.hasDefaultProvider();
  assert.equal(registerFromEnv({ EMAIL_FROM: 'noreply@example.org' }), false);
  assert.equal(registerFromEnv({ ZEPTOMAIL_API_KEY: '  ' }), false);
  assert.equal(LinkedEmail.hasDefaultProvider(), before);
});

test('with the key, LinkedEmail sends the API payload with the token and a text part', async () => {
  const { fetch, calls } = mockFetch();
  assert.equal(registerFromEnv(ENV, { fetch }), true);
  assert.equal(LinkedEmail.hasDefaultProvider(), true);
  await LinkedEmail.send(message);

  assert.equal(calls.length, 1);
  const [{ url, init, body }] = calls;
  assert.equal(url, DEFAULT_API_URL);
  assert.equal(init.method, 'POST');
  assert.equal(init.headers.authorization, `Zoho-enczapikey ${KEY}`);
  assert.deepEqual(body, {
    from: { address: 'noreply@example.org', name: 'Example' },
    to: [{ email_address: { address: 'ada@example.com', name: 'Ada' } }],
    subject: 'Your sign-in code',
    htmlbody: message.htmlbody,
    textbody: 'Hello Ada,\nUse 1234 or sign in: https://app.example/s?c=1.',
    track_clicks: false,
    track_opens: false,
  });
});

test("the message's own sender and bounce address win; a missing name falls back to the address", async () => {
  const { fetch, calls } = mockFetch();
  registerFromEnv({ ZEPTOMAIL_API_KEY: `Zoho-enczapikey ${KEY}`, SITE_ROOT: 'https://app.example' }, { fetch });
  await LinkedEmail.send({
    ...message,
    to: [{ email_address: { address: 'bob@example.com', name: '' } }],
    from: { address: 'team@app.example', name: 'Team' },
    bounce_address: 'bounce@bounce.app.example',
  });
  const [{ init, body }] = calls;
  assert.equal(init.headers.authorization, `Zoho-enczapikey ${KEY}`, 'the scheme prefix in the env is accepted');
  assert.deepEqual(body.from, { address: 'team@app.example', name: 'Team' });
  assert.equal(body.bounce_address, 'bounce@bounce.app.example');
  assert.deepEqual(body.to, [{ email_address: { address: 'bob@example.com', name: 'bob@example.com' } }]);
});

test('the sender defaults to noreply@ the SITE_ROOT host, without a name', () => {
  const settings = settingsFromEnv({ ZEPTOMAIL_API_KEY: KEY, SITE_ROOT: 'https://app.example' });
  assert.deepEqual(settings.from, { address: 'noreply@app.example' });
});

test('settings that cannot work throw, naming the variable and never the key', () => {
  assert.throws(() => settingsFromEnv({ ZEPTOMAIL_API_KEY: 'two words' }), /^Error: ZEPTOMAIL_API_KEY is not/);
  assert.throws(() => settingsFromEnv({ ...ENV, ZEPTOMAIL_API_URL: 'http://mail.example/v1.1/email' }), /ZEPTOMAIL_API_URL must be https/);
  assert.throws(() => settingsFromEnv({ ZEPTOMAIL_API_KEY: KEY }), /EMAIL_FROM must be/);
  assert.equal(settingsFromEnv({ ...ENV, ZEPTOMAIL_API_URL: 'http://localhost:9000/email' }).apiUrl, 'http://localhost:9000/email');
  for (const env of [{ ZEPTOMAIL_API_KEY: KEY }, { ...ENV, ZEPTOMAIL_API_URL: 'nope' }]) {
    assert.throws(() => settingsFromEnv(env), (err) => !err.message.includes(KEY));
  }
});

test('a refusal says only the status and the error codes', async () => {
  const { fetch } = mockFetch(
    () =>
      new Response(
        JSON.stringify({
          error: {
            code: 'TM_3201',
            message: `Invalid token ${KEY} for ada@example.com`,
            details: [{ code: 'SERR_157', message: 'Invalid API token', target: 'authorization' }, { code: 'bad code!' }],
          },
        }),
        { status: 401 }
      )
  );
  const settings = settingsFromEnv(ENV);
  await assert.rejects(zohoCpaasTransport({ settings, fetch }).send({ to: [{ address: 'ada@example.com' }], subject: 's', html: '<p>1234</p>', text: '1234' }), (err) => {
    assert.equal(err.message, 'Zoho CPaaS refused the email: 401 (TM_3201, SERR_157)');
    return true;
  });
});

test('a refusal without a JSON body, a network error and a timeout are redacted too', async () => {
  const settings = settingsFromEnv(ENV);
  const email = { to: [{ address: 'ada@example.com' }], subject: 's', html: 'h', text: 't' };
  await assert.rejects(
    zohoCpaasTransport({ settings, fetch: async () => new Response(`<html>${KEY}</html>`, { status: 500 }) }).send(email),
    { message: 'Zoho CPaaS refused the email: 500' }
  );
  await assert.rejects(
    zohoCpaasTransport({
      settings,
      fetch: async () => {
        throw new TypeError(`fetch failed for ${KEY}`);
      },
    }).send(email),
    { message: 'Zoho CPaaS could not be reached (TypeError)' }
  );
  const hang = (_url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason)));
  await assert.rejects(zohoCpaasTransport({ settings, fetch: hang, timeoutMs: 20 }).send(email), {
    message: 'Zoho CPaaS did not answer in 20 ms',
  });
});

test('htmlToText keeps link URLs, drops styles and decodes entities', () => {
  assert.equal(
    htmlToText('<head><style>p{color:red}</style></head><h1>Hi</h1><p>a &amp; b<br>c</p><a href="https://x.example">https://x.example</a>'),
    'Hi\na & b\nc\nhttps://x.example'
  );
});

test('the BackendProvider registers nothing when the process has no key', async () => {
  const { default: ZohoCpaasBackendProvider } = await import('../lib/esm/backend.js');
  const saved = process.env.ZEPTOMAIL_API_KEY;
  delete process.env.ZEPTOMAIL_API_KEY;
  try {
    const provider = new ZohoCpaasBackendProvider(undefined, undefined);
    assert.doesNotThrow(() => provider.setupBeforeControllers());
  } finally {
    if (saved !== undefined) process.env.ZEPTOMAIL_API_KEY = saved;
  }
});
