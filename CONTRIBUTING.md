# Contributing to DevMentorAI

Thank you for your interest in contributing to DevMentorAI! 🎉 This guide will help you get started.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Commit Conventions](#commit-conventions)
- [Pull Request Process](#pull-request-process)
- [Reporting Bugs](#reporting-bugs)
- [Requesting Features](#requesting-features)

## Code of Conduct

This project follows a [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold a welcoming and inclusive environment.

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/<your-username>/devmentorai.git
   cd devmentorai
   ```
3. **Add upstream** remote:
   ```bash
   git remote add upstream https://github.com/BOTOOM/devmentorai.git
   ```
4. **Create a branch** for your changes:
   ```bash
   git checkout -b feat/my-feature
   ```

## Development Setup

### Prerequisites

- **Node.js** 20+
- **pnpm** 9+
- **GitHub Copilot CLI** installed and authenticated
- **Chrome/Chromium** browser

### Install & Run

```bash
# Install dependencies
pnpm install

# Start backend (Terminal 1)
pnpm dev:backend

# Start extension with hot reload (Terminal 2)
pnpm dev
```

### Build & Test

```bash
# Build everything
pnpm build

# Run all tests
pnpm test

# Run backend unit tests only
pnpm test:unit

# Run E2E tests
pnpm test:e2e

# Lint
pnpm lint

# Type check
pnpm typecheck
```

## Project Structure

```
devmentorai/
├── apps/
│   ├── extension/     # WXT Chrome Extension (React + Tailwind)
│   └── backend/       # Node.js Backend (Fastify + SQLite)
├── packages/
│   └── shared/        # Shared types & contracts
├── tests/
│   └── e2e/           # Playwright E2E tests
└── docs/              # Architecture documentation
```

For detailed architecture information, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Making Changes

1. **Keep changes focused** — one feature or fix per PR
2. **Write tests** for new functionality when applicable
3. **Update documentation** if your changes affect the public API or behavior
4. **Follow existing code style** — the project uses TypeScript with ESLint
5. **Run checks before pushing:**
   ```bash
   pnpm lint && pnpm typecheck && pnpm test
   ```

## Commit Conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation only changes |
| `style` | Code style changes (formatting, no logic change) |
| `refactor` | Code refactoring (no feature or fix) |
| `test` | Adding or updating tests |
| `chore` | Build process, dependencies, or tooling changes |
| `perf` | Performance improvements |

### Scopes

| Scope | Description |
|-------|-------------|
| `extension` | Chrome extension (WXT) |
| `backend` | Node.js backend |
| `shared` | Shared packages |
| `e2e` | End-to-end tests |
| `docs` | Documentation |

### Examples

```
feat(extension): add dark mode toggle to settings
fix(backend): resolve session timeout on idle connections
docs: update installation guide for Windows
test(backend): add unit tests for retry logic
```

## Pull Request Process

1. **Update your branch** with the latest upstream changes:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```
2. **Push your branch** to your fork:
   ```bash
   git push origin feat/my-feature
   ```
3. **Open a Pull Request** against `main` on the upstream repo
4. **Fill out the PR template** — describe what changed and why
5. **Wait for review** — a maintainer will review your PR
6. **Address feedback** — push additional commits if changes are requested
7. **Merge** — once approved, a maintainer will merge your PR

### PR Checklist

- [ ] Code compiles without errors (`pnpm typecheck`)
- [ ] Linter passes (`pnpm lint`)
- [ ] Tests pass (`pnpm test`)
- [ ] New functionality has tests (if applicable)
- [ ] Documentation is updated (if applicable)

## Reporting Bugs

Use the [Bug Report](https://github.com/BOTOOM/devmentorai/issues/new?template=bug_report.yml) issue template. Please include:

- Steps to reproduce
- Expected vs actual behavior
- Browser and OS version
- Extension version
- Relevant logs or screenshots

## Requesting Features

Use the [Feature Request](https://github.com/BOTOOM/devmentorai/issues/new?template=feature_request.yml) issue template. Please include:

- Description of the feature
- Use case / problem it solves
- Any implementation ideas you have

---

## Questions?

If you have questions that aren't covered here, feel free to [open a discussion](https://github.com/BOTOOM/devmentorai/issues) on the repository.

Thank you for contributing! 💙
