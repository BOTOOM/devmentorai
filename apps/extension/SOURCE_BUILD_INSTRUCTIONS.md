# DevMentorAI Firefox Extension - Source Code

Repository: https://github.com/BOTOOM/devmentorai  
Extension path: `apps/extension`  
Shared package path: `packages/shared`

## Environment
- OS: Linux/macOS/Windows
- Node.js: 22.x
- pnpm: 9.x

## Install
```bash
pnpm install --frozen-lockfile
```

## Build steps (exact reproduction)

1. Build shared package:

```bash
pnpm --filter @devmentorai/shared build
```

2. Build extension for Firefox (MV2):

```bash
pnpm --filter @devmentorai/extension build:firefox
```

Build output directory:

`apps/extension/.output/firefox-mv2/`

## Package XPI manually

From the output folder:

```bash
cd apps/extension/.output/firefox-mv2
zip -r ../devmentoraiextension-<version>-firefox.xpi *
```

Generated file:

`apps/extension/.output/devmentoraiextension-<version>-firefox.xpi`

## Notes for reviewers

- Source code is available in:
  - `apps/extension/src`
  - `packages/shared/src`
- Build tooling: WXT + Vite (configured in the extension workspace)
- No pre-built artifacts are required in source submission; they are generated with the commands above.