import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    cli: 'src/cli.ts',
    server: 'src/server.ts',
  },
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  shims: true,
  sourcemap: true,
  clean: true,
  splitting: true,
  // Bundle @devmentorai/shared and @github/copilot-sdk into the output
  noExternal: ['@devmentorai/shared', '@github/copilot-sdk'],
  // Keep native/binary deps as external — npm installs them with prebuilt binaries
  external: [
    'better-sqlite3',
    'sharp',
  ],
  banner: {
    // Inject a require polyfill for bundled CJS modules that use require('util') etc.
    js: `import { createRequire as __createRequire } from 'module';\nif (typeof require === 'undefined') { globalThis.require = __createRequire(import.meta.url); }`,
  },
  esbuildPlugins: [
    {
      name: 'add-shebang',
      setup(build) {
        build.onEnd((result) => {
          if (!result.outputFiles) return;
          for (const file of result.outputFiles) {
            if (file.path.endsWith('/cli.js') || file.path.endsWith('\\cli.js')) {
              file.contents = new TextEncoder().encode(
                '#!/usr/bin/env node\n' + new TextDecoder().decode(file.contents)
              );
            }
          }
        });
      },
    },
  ],
  // tsup handles shebang natively when we can't use esbuild plugins with write mode
  // So we use onSuccess to prepend it
  onSuccess: `node -e "
    const fs = require('fs');
    const p = './dist/cli.js';
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf8');
      if (!content.startsWith('#!')) {
        fs.writeFileSync(p, '#!/usr/bin/env node\\n' + content);
      }
      fs.chmodSync(p, 0o755);
    }
  "`,
});
