import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { initDatabase } from '../src/db/index.js';

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true }))
  );
});

describe('database migrations', () => {
  it('does not re-import newly created legacy sessions on a later initialization', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'devmentorai-db-'));
    directories.push(directory);
    const databasePath = path.join(directory, 'database.sqlite');
    const first = initDatabase({ path: databasePath });
    first
      .prepare(
        `INSERT INTO sessions (id, name, type, model, agent_id, imported_from)
         VALUES (?, ?, ?, ?, NULL, NULL)`
      )
      .run('new-session', 'New', 'general', '');
    first.close();

    const second = initDatabase({ path: databasePath });
    expect(
      (
        second.prepare('SELECT imported_from FROM sessions WHERE id = ?').get('new-session') as {
          imported_from: string | null;
        }
      ).imported_from
    ).toBeNull();
    second.close();
  });
});
