import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Database } from 'better-sqlite3';
import type { LLMProvider, ProviderCredentialStatus } from '@devmentorai/shared';

interface DbProviderCredential {
  provider: string;
  encrypted_value: string;
  key_preview: string | null;
  created_at: string;
  updated_at: string;
}

const SUPPORTED_CREDENTIAL_PROVIDERS = new Set<LLMProvider>(['openrouter', 'groq']);
const KEY_DIR = path.join(os.homedir(), '.devmentorai');
const KEY_PATH = path.join(KEY_DIR, 'provider-credentials.key');
const ENCRYPTION_VERSION = 'v1';

export class ProviderCredentialService {
  private readonly encryptionKey: Buffer;

  constructor(private readonly db: Database) {
    this.encryptionKey = this.ensureEncryptionKey();
  }

  getSupportedProviders(): LLMProvider[] {
    return Array.from(SUPPORTED_CREDENTIAL_PROVIDERS);
  }

  requiresCredential(provider: LLMProvider): boolean {
    return SUPPORTED_CREDENTIAL_PROVIDERS.has(provider);
  }

  setCredential(provider: LLMProvider, apiKey: string): ProviderCredentialStatus {
    this.assertSupportedProvider(provider);

    const normalizedApiKey = apiKey.trim();
    if (normalizedApiKey.length === 0) {
      throw new Error(`A non-empty API key is required for provider '${provider}'.`);
    }

    const now = new Date().toISOString();
    const encryptedValue = this.encrypt(normalizedApiKey);
    const keyPreview = this.buildKeyPreview(normalizedApiKey);

    this.db.prepare(`
      INSERT INTO provider_credentials (provider, encrypted_value, key_preview, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(provider) DO UPDATE SET
        encrypted_value = excluded.encrypted_value,
        key_preview = excluded.key_preview,
        updated_at = excluded.updated_at
    `).run(provider, encryptedValue, keyPreview, now, now);

    return this.getCredentialStatus(provider);
  }

  getCredential(provider: LLMProvider): string | null {
    this.assertSupportedProvider(provider);

    const row = this.db.prepare(`
      SELECT encrypted_value
      FROM provider_credentials
      WHERE provider = ?
      LIMIT 1
    `).get(provider) as { encrypted_value: string } | undefined;

    if (!row) {
      return null;
    }

    return this.decrypt(row.encrypted_value);
  }

  deleteCredential(provider: LLMProvider): ProviderCredentialStatus {
    this.assertSupportedProvider(provider);

    this.db.prepare('DELETE FROM provider_credentials WHERE provider = ?').run(provider);
    return this.getCredentialStatus(provider);
  }

  getCredentialStatus(provider: LLMProvider): ProviderCredentialStatus {
    this.assertSupportedProvider(provider);

    const row = this.db.prepare(`
      SELECT provider, encrypted_value, key_preview, created_at, updated_at
      FROM provider_credentials
      WHERE provider = ?
      LIMIT 1
    `).get(provider) as DbProviderCredential | undefined;

    return {
      provider,
      configured: Boolean(row),
      keyPreview: row?.key_preview ?? null,
      updatedAt: row?.updated_at ?? null,
      storage: 'local-backend-encrypted',
    };
  }

  private assertSupportedProvider(provider: LLMProvider): void {
    if (!SUPPORTED_CREDENTIAL_PROVIDERS.has(provider)) {
      throw new Error(`Provider '${provider}' does not support backend-managed API keys.`);
    }
  }

  private ensureEncryptionKey(): Buffer {
    if (!fs.existsSync(KEY_DIR)) {
      fs.mkdirSync(KEY_DIR, { recursive: true, mode: 0o700 });
    }

    if (fs.existsSync(KEY_PATH)) {
      const stored = fs.readFileSync(KEY_PATH, 'utf8').trim();
      return Buffer.from(stored, 'base64');
    }

    const generated = randomBytes(32);
    fs.writeFileSync(KEY_PATH, generated.toString('base64'), { mode: 0o600 });
    return generated;
  }

  private encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [
      ENCRYPTION_VERSION,
      iv.toString('base64'),
      authTag.toString('base64'),
      encrypted.toString('base64'),
    ].join(':');
  }

  private decrypt(payload: string): string {
    const [version, ivValue, authTagValue, encryptedValue] = payload.split(':');
    if (version !== ENCRYPTION_VERSION || !ivValue || !authTagValue || !encryptedValue) {
      throw new Error('Unsupported credential encryption payload.');
    }

    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey,
      Buffer.from(ivValue, 'base64')
    );
    decipher.setAuthTag(Buffer.from(authTagValue, 'base64'));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, 'base64')),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }

  private buildKeyPreview(apiKey: string): string {
    if (apiKey.length <= 8) {
      return `${apiKey.slice(0, 2)}••••`;
    }

    return `${apiKey.slice(0, 4)}••••${apiKey.slice(-4)}`;
  }
}
