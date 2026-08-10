import { Readable, Writable } from 'node:stream';
import * as acp from '@agentclientprotocol/sdk';
import { OpenAICompatibleAgent } from './openai-compatible-agent.js';

const agent = new OpenAICompatibleAgent({
  baseUrl: process.env.OPENAI_COMPATIBLE_BASE_URL ?? 'http://127.0.0.1:1234',
  model: process.env.OPENAI_COMPATIBLE_MODEL ?? 'default',
  apiKey: process.env.OPENAI_COMPATIBLE_API_KEY,
  supportsImage: process.env.OPENAI_COMPATIBLE_SUPPORTS_IMAGE === 'true',
});

const app = acp
  .agent({ name: 'devmentorai-openai-compatible' })
  .onRequest('initialize', () => agent.initialize())
  .onRequest('authenticate', (context) => agent.authenticate(context.params))
  .onRequest('session/new', (context) => agent.newSession(context.params))
  .onRequest('session/prompt', (context) => agent.prompt(context.params, context.client))
  .onRequest('session/set_config_option', (context) => agent.setConfigOption(context.params))
  .onNotification('session/cancel', (context) => agent.cancel(context.params));

const stream = acp.ndJsonStream(
  Writable.toWeb(process.stdout) as WritableStream<Uint8Array>,
  Readable.toWeb(process.stdin) as ReadableStream<Uint8Array>
);
app.connect(stream);
