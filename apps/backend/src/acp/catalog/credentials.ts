import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { AcpError } from '../errors.js';
import { devmentorHome } from './paths.js';

const VERSION = 'v1';

export type CredentialStoreOptions = {
  directory?: string;
  credentialsPath?: string;
  keyPath?: string;
};

type StoredCredentials = Record<string, string>;

export class CredentialStore {
  private readonly credentialsPath: string;
  private readonly keyPath: string;
  private readonly key: Buffer;

  constructor(options: CredentialStoreOptions = {}) {
    const directory = options.directory ?? devmentorHome();
    this.credentialsPath = options.credentialsPath ?? path.join(directory, 'credentials');
    this.keyPath = options.keyPath ?? path.join(directory, 'credentials.key');
    fs.mkdirSync(path.dirname(this.credentialsPath), { recursive: true, mode: 0o700 });
    this.key = this.loadOrCreateKey();
  }

  set(id: string, value: string): void {
    if (!id || !value)
      throw new AcpError('agent_launch_failed', 'Credential id and value are required');
    const credentials = this.read();
    credentials[id] = value;
    this.write(credentials);
  }

  get(id: string): string | undefined {
    return this.read()[id];
  }

  delete(id: string): void {
    const credentials = this.read();
    delete credentials[id];
    this.write(credentials);
  }

  resolveReference(reference: string): string | undefined {
    const match =
      /^credential:(?:\/\/)?(.+)$/.exec(reference) ?? /^\$\{credential:([^}]+)\}$/.exec(reference);
    return match ? this.get(match[1]) : undefined;
  }

  resolveEnvironment(environment: Record<string, string>): Record<string, string> {
    return Object.fromEntries(
      Object.entries(environment).flatMap(([key, value]) => {
        const resolved = this.resolveReference(value);
        const isReference = /^(?:credential:|credential:\/\/)|^\$\{credential:/.test(value);
        if (isReference && resolved === undefined) {
          throw new AcpError(
            'agent_launch_failed',
            `Credential reference is not configured for environment variable ${key}`
          );
        }
        return resolved === undefined ? [[key, value]] : [[key, resolved]];
      })
    );
  }

  private loadOrCreateKey(): Buffer {
    // The adjacent 0600 key protects against accidental disclosure, not local-account takeover.
    if (fs.existsSync(this.keyPath)) {
      return Buffer.from(fs.readFileSync(this.keyPath, 'utf8').trim(), 'base64');
    }
    const key = randomBytes(32);
    fs.writeFileSync(this.keyPath, key.toString('base64'), { mode: 0o600 });
    fs.chmodSync(this.keyPath, 0o600);
    return key;
  }

  private read(): StoredCredentials {
    if (!fs.existsSync(this.credentialsPath)) return {};
    const [version, ivValue, tagValue, payload] = fs
      .readFileSync(this.credentialsPath, 'utf8')
      .trim()
      .split(':');
    if (version !== VERSION || !ivValue || !tagValue || !payload) {
      throw new Error('Unsupported credential storage');
    }
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivValue, 'base64'));
    decipher.setAuthTag(Buffer.from(tagValue, 'base64'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(payload, 'base64')),
      decipher.final(),
    ]).toString('utf8');
    const parsed: unknown = JSON.parse(plaintext);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Invalid credential storage');
    }
    return parsed as StoredCredentials;
  }

  private write(credentials: StoredCredentials): void {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const payload = Buffer.concat([
      cipher.update(JSON.stringify(credentials), 'utf8'),
      cipher.final(),
    ]);
    const encoded = [
      VERSION,
      iv.toString('base64'),
      cipher.getAuthTag().toString('base64'),
      payload.toString('base64'),
    ].join(':');
    fs.writeFileSync(this.credentialsPath, encoded, { mode: 0o600 });
    fs.chmodSync(this.credentialsPath, 0o600);
  }
}
