import { randomBytes, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { devmentorHome } from './catalog/paths.js';
import { AcpError } from './errors.js';

const EXTENSION_ORIGIN = /^(?:chrome|moz|safari-web)-extension:\/\/[a-z0-9._-]+$/i;

export type PairingRecord = {
  origin: string;
  token: string;
  pairedAt: string;
};

export type PairingStoreOptions = {
  directory?: string;
  file?: string;
};

function isPairingRecord(value: unknown): value is PairingRecord {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.origin === 'string' &&
    typeof record.token === 'string' &&
    typeof record.pairedAt === 'string'
  );
}

function tokensMatch(expected: string, received: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Trust-on-first-use pairing between the local backend and a single browser extension.
 *
 * The extension origin (`chrome-extension://<id>`) is only known once the extension is
 * loaded, so the first extension that asks is paired and gets a bearer token; every later
 * connection has to present both that origin and the token.
 */
export class AcpPairingStore {
  readonly filePath: string;

  constructor(options: PairingStoreOptions = {}) {
    const directory = options.directory ?? devmentorHome();
    this.filePath = options.file ?? path.join(directory, 'pairing.json');
  }

  static isExtensionOrigin(origin: string | undefined): boolean {
    return typeof origin === 'string' && EXTENSION_ORIGIN.test(origin);
  }

  read(): PairingRecord | undefined {
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      return isPairingRecord(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }

  /** Returns the pairing for `origin`, creating it when nothing is paired yet. */
  pair(origin: string): PairingRecord {
    if (!AcpPairingStore.isExtensionOrigin(origin)) {
      throw new AcpError('pairing_rejected', 'Only browser extensions can pair with the backend', {
        origin,
      });
    }
    const current = this.read();
    if (current) {
      if (current.origin !== origin) {
        throw new AcpError(
          'pairing_conflict',
          'The backend is already paired with a different extension',
          { pairedOrigin: current.origin, origin }
        );
      }
      return current;
    }
    const record: PairingRecord = {
      origin,
      token: randomBytes(32).toString('hex'),
      pairedAt: new Date().toISOString(),
    };
    this.write(record);
    return record;
  }

  verify(origin: string | undefined, token: string | undefined): boolean {
    const current = this.read();
    if (!current || !origin || !token) return false;
    return current.origin === origin && tokensMatch(current.token, token);
  }

  reset(): void {
    try {
      fs.rmSync(this.filePath);
    } catch {
      // An absent pairing file is already the reset state.
    }
  }

  private write(record: PairingRecord): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true, mode: 0o700 });
    fs.writeFileSync(this.filePath, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
    fs.chmodSync(this.filePath, 0o600);
  }
}
