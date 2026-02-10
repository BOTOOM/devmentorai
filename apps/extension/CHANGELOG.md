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
