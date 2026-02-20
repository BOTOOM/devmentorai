## [1.4.0](https://github.com/BOTOOM/devmentorai/compare/ext-v1.3.0...ext-v1.4.0) (2026-02-20)

### Features

* **extension:** disable model picker after chat starts and add session recovery retry logic ([c5e7b73](https://github.com/BOTOOM/devmentorai/commit/c5e7b73ffe0eeaedabd7741e85bd02c86b6d37e6))
* **extension:** insert pending text at cursor position instead of replacing draft ([18cc61b](https://github.com/BOTOOM/devmentorai/commit/18cc61b5710417fc49fb3a4aa9c49859d9fe8576))
* **website:** add dynamic OG images and favicon with gradient branding ([ade1cac](https://github.com/BOTOOM/devmentorai/commit/ade1cac575fab1889b1b4a99504dcd7392d1ee18))
* **website:** add FAQ and support pages with YouTube demo embed and responsive improvements ([6f53b6a](https://github.com/BOTOOM/devmentorai/commit/6f53b6a2d9283a1c9101404a6afa494f04e2524c))
* **website:** add static OG image and dynamic metadata with request-based URL resolution ([8fcb7a0](https://github.com/BOTOOM/devmentorai/commit/8fcb7a03c8aefe88a0aeace58712ba64a4d34a6c))

## [1.3.0](https://github.com/BOTOOM/devmentorai/compare/ext-v1.2.0...ext-v1.3.0) (2026-02-19)

### Features

* **docker:** add Docker Compose setup with Copilot CLI integration and persistence ([4e9b245](https://github.com/BOTOOM/devmentorai/commit/4e9b245077da9ca107f3003836bb7f842cc40de4))
* **extension:** add dynamic backend URL configuration from storage ([1f22e19](https://github.com/BOTOOM/devmentorai/commit/1f22e19a91129bba361526ef590e57ed006330e8))

### Refactoring

* **tests:** improve E2E test isolation and add accessibility attributes ([5acaef0](https://github.com/BOTOOM/devmentorai/commit/5acaef0027a18e3f67942065e8a47447e01e785a))

## [1.2.0](https://github.com/BOTOOM/devmentorai/compare/ext-v1.1.5...ext-v1.2.0) (2026-02-19)

### Features

* **extension:** add model search, pricing tiers, and account status display ([4664751](https://github.com/BOTOOM/devmentorai/commit/4664751b3ef14bf55c8903ae874917a9218b6778))
* **extension:** replace auth status badge with user avatar icon and tooltip ([613a357](https://github.com/BOTOOM/devmentorai/commit/613a357115dc18a9beca6622ad513893fe47a3f5))

### Refactoring

* **extension:** add browser compatibility layer for Chrome/Firefox API differences ([c1c60ed](https://github.com/BOTOOM/devmentorai/commit/c1c60ed4cd287719de91ecebf71876c0864fdb6e))
* **extension:** add programmatic side panel opening with fallback for Firefox ([322113a](https://github.com/BOTOOM/devmentorai/commit/322113a9cdc7e5588cb713257d9fce1c304f4100))

## [1.1.5](https://github.com/BOTOOM/devmentorai/compare/ext-v1.1.4...ext-v1.1.5) (2026-02-19)

### Refactoring

* **backend:** add account routes, improve model management, and enhance CLI diagnostics ([18d5845](https://github.com/BOTOOM/devmentorai/commit/18d584516bdb2923d3e64eeda17aac66cb050b6d))
* **backend:** improve error handling, cleanup, and code quality ([005c534](https://github.com/BOTOOM/devmentorai/commit/005c5348bd25a9d6a52f88c6bf17f34fc7771086))
* **shared:** add account endpoints and enhance model/session types ([7b51edb](https://github.com/BOTOOM/devmentorai/commit/7b51edb9e6b748a621d5a2295316d0c53752d0b9))

### Maintenance

* **release:** backend v1.2.3 [skip ci] ([dc3476a](https://github.com/BOTOOM/devmentorai/commit/dc3476a5fdbddbf2c1f95fcd30c3d508aac18550))

## [1.1.4](https://github.com/BOTOOM/devmentorai/compare/ext-v1.1.3...ext-v1.1.4) (2026-02-18)

### Bug Fixes

* **extension:** add Firefox compatibility with browser-specific settings and optional sidePanel permission ([78f680e](https://github.com/BOTOOM/devmentorai/commit/78f680e5e1b8d2b1da661e62711585ce7784bfd0))
* **extension:** add Firefox compatibility with optional chaining for Chrome-specific APIs ([3f4f70c](https://github.com/BOTOOM/devmentorai/commit/3f4f70c4c94ea554a4753bf80ace45d0b017d2e9))
* **extension:** remove Chrome-specific APIs for Firefox compatibility ([442a5cf](https://github.com/BOTOOM/devmentorai/commit/442a5cf3725331e635378ed7e797a6f6916eb3f4))

### Refactoring

* **extension:** improve accessibility and code quality in UI components ([be6af45](https://github.com/BOTOOM/devmentorai/commit/be6af45710f678aa82eb86a07aaf5498a8c81fbb))

### Documentation

* **extension:** add Firefox source build instructions for reviewers ([1d479fc](https://github.com/BOTOOM/devmentorai/commit/1d479fc05b95ee2b5c197ea70420da6008b619fd))

### Maintenance

* **extension:** revert version from 1.1.4 to 1.1.3 ([d321926](https://github.com/BOTOOM/devmentorai/commit/d32192662d84099150fd9c88a8b087ccdb837509))

## [1.1.3](https://github.com/BOTOOM/devmentorai/compare/ext-v1.1.2...ext-v1.1.3) (2026-02-11)

### Bug Fixes

* **extension:** reload sessions when backend reconnects after disconnection ([89307d6](https://github.com/BOTOOM/devmentorai/commit/89307d6cebf1259b01247f5620082336b1edb5d4))

### Maintenance

* **website:** add commit existence validation to Vercel ignore command ([1b1d09b](https://github.com/BOTOOM/devmentorai/commit/1b1d09b6fe06d713732cc321fba40b2168f445b2))

## [1.1.2](https://github.com/BOTOOM/devmentorai/compare/ext-v1.1.1...ext-v1.1.2) (2026-02-11)

### Bug Fixes

* **backend:** centralize version management with dedicated version.ts file ([417716b](https://github.com/BOTOOM/devmentorai/commit/417716b72728906ff4ec0803fd134f254d150e44))
* **backend:** improve update instructions with npx command and explicit latest tag ([60ab512](https://github.com/BOTOOM/devmentorai/commit/60ab51260d8426c0d45b00ffa27d75799f197140))
* **extension:** update backend update command and use dynamic extension version ([464888a](https://github.com/BOTOOM/devmentorai/commit/464888a105ec625268721226084850fb47970d07))

### Maintenance

* **extension:** disable GitHub issue comments in release configuration ([63f7401](https://github.com/BOTOOM/devmentorai/commit/63f74015446025ae91581ccd509bfbc82487624b))
* **release:** backend v1.2.1 [skip ci] ([886c3ea](https://github.com/BOTOOM/devmentorai/commit/886c3eabec0de24905695ebcc345f6acdd217792))
* **release:** backend v1.2.2 [skip ci] ([41f02ae](https://github.com/BOTOOM/devmentorai/commit/41f02ae569246b61315caa7b8f00bbfe8e0a25b8))

## [1.1.1](https://github.com/BOTOOM/devmentorai/compare/ext-v1.1.0...ext-v1.1.1) (2026-02-11)

### Bug Fixes

* **extension:** centralize version management with auto-sync during release ([96cac69](https://github.com/BOTOOM/devmentorai/commit/96cac6957f2aadf69c19a5b8f8ff8905f0195224))

### Maintenance

* automate version synchronization in backend and extension release workflows ([6ad7420](https://github.com/BOTOOM/devmentorai/commit/6ad7420586474774ddd16655182ddb20d1eec6e8))
* **website:** update domain from devmentorai.dev to devmentorai.edwardiaz.dev ([66232a3](https://github.com/BOTOOM/devmentorai/commit/66232a34db3ad0d03c568845b3d7fa102ee1a21a))

## [1.1.0](https://github.com/BOTOOM/devmentorai/compare/ext-v1.0.0...ext-v1.1.0) (2026-02-10)

### Features

* add ErrorBoundary component and GitHub issue reporting links ([42b636e](https://github.com/BOTOOM/devmentorai/commit/42b636e1f2f149708af383c2634aaf681cbe4b9e))
* add website app with Next.js landing page and documentation ([359b9d3](https://github.com/BOTOOM/devmentorai/commit/359b9d39eaef9850881f4ba25407acfb2454537f))

### Documentation

* **backend:** add support section to README ([5ee11cc](https://github.com/BOTOOM/devmentorai/commit/5ee11cc66ae2d7e6b22f095fc50b8f4f140f3681))

### Maintenance

* **backend:** bump version to 1.1.0 ([af58fc6](https://github.com/BOTOOM/devmentorai/commit/af58fc6de1e475c9e7d8b66a1daa1c84463c44c2))
* **release:** backend v1.2.0 [skip ci] ([3a6cfdf](https://github.com/BOTOOM/devmentorai/commit/3a6cfdf292c089c21d8b73a2edbfce3895a29231))
* remove temporary issues tracking file ([1a36678](https://github.com/BOTOOM/devmentorai/commit/1a366782191a4370586b4dd011f54ceae452e3e6))
* update dependencies and add website app with Next.js 16 ([5985c02](https://github.com/BOTOOM/devmentorai/commit/5985c02ad4d3d023992b8283afbb7372ca308f59))
* **website:** add initial deployment check to Vercel ignore command ([5cbd220](https://github.com/BOTOOM/devmentorai/commit/5cbd220f18b6641d4f00950e7afeced3926d3882))
* **website:** add Vercel deployment configuration ([41d74d7](https://github.com/BOTOOM/devmentorai/commit/41d74d77fcf623494c9783304fb186af5d7db6d5))
* **website:** remove redundant rootDirectory from Vercel config ([bfc4040](https://github.com/BOTOOM/devmentorai/commit/bfc4040fc18343c905576e777de080f622359b11))

## 1.0.0 (2026-02-10)

### Features

* add ActivityView component for displaying Copilot activity states and tool executions ([99a6f2d](https://github.com/BOTOOM/devmentorai/commit/99a6f2d6ac40d4a4e1ba1e14d788074b41d12670))
* add build and typecheck steps for shared package in backend and extension workflows ([5151fe2](https://github.com/BOTOOM/devmentorai/commit/5151fe2597670b197e5b08b06ebaf393709fb08d))
* Add context-aware types and utilities for DevMentorAI ([e099d55](https://github.com/BOTOOM/devmentorai/commit/e099d5565c9927b7660c4a04c2aab4a1f6aa70cc))
* add GitHub Actions workflow for extension release with testing and semantic release ([8ae85a4](https://github.com/BOTOOM/devmentorai/commit/8ae85a49f0626df9fd83085938482622492ccc63))
* add image handling and selection context types ([a6b1920](https://github.com/BOTOOM/devmentorai/commit/a6b19209bb42ad81de30a69f484242a5aa313003))
* Add logging and dynamic translation language support in SidePanel for pending actions ([ce4a55c](https://github.com/BOTOOM/devmentorai/commit/ce4a55cd7709e43be48609a143d8f63228fada2c))
* add models API routes and localization for extension ([e8bd159](https://github.com/BOTOOM/devmentorai/commit/e8bd159179ed234ff6f493f31dc0a082081bdbdc))
* add Playwright E2E testing setup for extension ([a448331](https://github.com/BOTOOM/devmentorai/commit/a4483317c71bf20a3564fa237d561530d5a001bf))
* Enhance chat and server functionality with improved event handling and logging ([26f9b19](https://github.com/BOTOOM/devmentorai/commit/26f9b19ad24320ebb415e6f8490e40b78b96b7df))
* enhance image handling and screenshot functionality in ChatView and SidePanel ([163668c](https://github.com/BOTOOM/devmentorai/commit/163668cff4710c3d061f6fb550d886f8e0824126))
* Enhance MessageBubble with copy and replace functionality ([f25d74a](https://github.com/BOTOOM/devmentorai/commit/f25d74aaf1c0490cb1fdb933cad69df9c60618e3))
* **extension:** add text replacement in editable fields and smart translation ([fd1033e](https://github.com/BOTOOM/devmentorai/commit/fd1033ee66ec70575d40f54bd2048ddef396003f))
* fix image URL generation and add full image serving support for lightbox ([f8f5001](https://github.com/BOTOOM/devmentorai/commit/f8f50015c2d7f8b0234977a0b4598f0b6876053d))
* implement automatic session recovery with fallback to session recreation ([0e7ec96](https://github.com/BOTOOM/devmentorai/commit/0e7ec962109b5e00ecaae3df55a53a0d9b0186f5))
* implement full image storage and Copilot SDK attachment support for image handling ([26372ce](https://github.com/BOTOOM/devmentorai/commit/26372cebeaf1f05ce4a126fc98a8bbc506bc1fd7))
* implement image handling system for chat messages ([b1a44bc](https://github.com/BOTOOM/devmentorai/commit/b1a44bcc5d92e0be8fc98d218195056e5489d975))
* implement proper session cleanup with file deletion and improve path handling ([397ccaa](https://github.com/BOTOOM/devmentorai/commit/397ccaa5f970053225a015ebd936b1be9a49d39d))
* implement update check functionality in backend CLI and health routes; add updates API endpoint ([ed18a9b](https://github.com/BOTOOM/devmentorai/commit/ed18a9b70bd40d847d31c3d8751fa6b830b63bd6))
* implement update checker functionality; add update notifications and version management ([9e1d406](https://github.com/BOTOOM/devmentorai/commit/9e1d406894ef0d5bf2ccce2e47639fab46811dbb))
* Refactor content script and add floating bubble and selection toolbar ([8b98e92](https://github.com/BOTOOM/devmentorai/commit/8b98e9259a30c8046d0b981e89b39e308e5085b5))

### Bug Fixes

* add workflow_dispatch input to skip tests for emergency releases ([ce08dc2](https://github.com/BOTOOM/devmentorai/commit/ce08dc29e9c8a59a30f52a18da3063852b0df2f5))
* remove pnpm version specification in backend release workflow ([89b4bbe](https://github.com/BOTOOM/devmentorai/commit/89b4bbef77de1b3f86f34157c85cb87e596cc843))
* Send empty body in deleteSession request to satisfy Content-Type header ([02bee38](https://github.com/BOTOOM/devmentorai/commit/02bee38028ddad07df081ae758dcd21952a07d19))
* **toolbar:** fix tone submenu not staying open ([a23f1c5](https://github.com/BOTOOM/devmentorai/commit/a23f1c54977a8791fd894fe6f6c9e4a2afe749b5))
* **toolbar:** keep tone submenu open and position dynamically ([65fbdf1](https://github.com/BOTOOM/devmentorai/commit/65fbdf1459f8194fb5724bcb8f0ccfcebbb2fa6a))
* update backend server command in Playwright config ([be53a24](https://github.com/BOTOOM/devmentorai/commit/be53a246a171b05031ffb2e1ba0b8242c4f0cbd6))
* update branch name from main to master in workflow and release config ([099efb4](https://github.com/BOTOOM/devmentorai/commit/099efb430449685fc9fca153f9f495a5e98e4327))
* update import paths from .ts to .js for consistency across the project ([80d0a3c](https://github.com/BOTOOM/devmentorai/commit/80d0a3cf72013e0d309d2aa157ca96fef3cbd241))
* update Node.js version from 20 to 22 in backend release workflow ([006acf7](https://github.com/BOTOOM/devmentorai/commit/006acf78444e47dd7445d5b7c54a13299a8bde1b))
* update Playwright config to support ES modules and resolve paths ([84a6aff](https://github.com/BOTOOM/devmentorai/commit/84a6aff138a0ade06f94a38789c69260b5f414ca))
* update version to 1.0.0 in package.json, cli.ts, and health.ts; re-enable backend tests in workflow ([6748660](https://github.com/BOTOOM/devmentorai/commit/6748660c33e056cc3b021b2fec5d964b2a3d471a))

### Refactoring

* Refactor and clean up code across multiple files ([035f256](https://github.com/BOTOOM/devmentorai/commit/035f2565d02a30674abb17d3d1b9742a2979b413))

### Documentation

* add community health files ([df90d2e](https://github.com/BOTOOM/devmentorai/commit/df90d2e0a68e970f18c1150f10aeeacd9ac31f47))

### Maintenance

* **release:** backend v1.0.0 [skip ci] ([4332aa1](https://github.com/BOTOOM/devmentorai/commit/4332aa1ec2ea9ede75dcc053be64ea46ab9e0d1a))
* **release:** backend v1.1.0 [skip ci] ([25aa43d](https://github.com/BOTOOM/devmentorai/commit/25aa43dd970db307543a938e2031c6e0401d7523))
