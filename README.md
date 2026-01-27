# DevMentorAI

A Chrome/Chromium browser extension that provides DevOps mentoring, infrastructure guidance, and writing assistance powered by GitHub Copilot CLI via the Copilot SDK for Node.js.

## Features

- 🛠️ **DevOps Mentor** - Expert guidance on AWS, Azure, GCP, Kubernetes, CI/CD, and Infrastructure as Code
- ✍️ **Writing Assistant** - Email composition, rewriting, translation, and grammar fixes
- 💻 **Development Helper** - Code review, debugging, and best practices
- 💬 **Multi-Session Support** - Manage multiple independent conversations
- 🌐 **Context Awareness** - Use selected text and page context in conversations
- 🔄 **Streaming Responses** - Real-time streaming of AI responses

## Prerequisites

- **Node.js** 20+ 
- **pnpm** 9+
- **GitHub Copilot CLI** installed and authenticated ([Installation Guide](https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-cli))
- **Chrome/Chromium** browser

## Quick Start

### 1. Install Dependencies

```bash
cd devmentorai
pnpm install
```

### 2. Start the Backend

```bash
pnpm dev:backend
```

The backend will start on `http://localhost:3847`.

### 3. Build & Load the Extension

```bash
pnpm build:extension
```

Then load the extension in Chrome:
1. Go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `apps/extension/.output/chrome-mv3` folder

### 4. Development Mode

For development with hot reload:

```bash
# Terminal 1: Backend
pnpm dev:backend

# Terminal 2: Extension
pnpm dev
```

## Project Structure

```
devmentorai/
├── apps/
│   ├── extension/          # WXT Chrome Extension
│   │   ├── src/
│   │   │   ├── entrypoints/ # Background, content, sidepanel
│   │   │   ├── components/  # React UI components
│   │   │   ├── hooks/       # React hooks
│   │   │   └── services/    # API client
│   │   └── public/
│   │       └── _locales/    # i18n (en, es)
│   │
│   └── backend/            # Node.js Backend
│       ├── src/
│       │   ├── routes/     # API endpoints
│       │   ├── services/   # CopilotService, SessionService
│       │   └── db/         # SQLite database
│       └── tests/          # Vitest unit tests
│
├── packages/
│   └── shared/             # Shared types & contracts
│
└── tests/
    └── e2e/                # Playwright E2E tests
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Chrome Extension (WXT)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Side Panel │  │  Content    │  │     Background          │  │
│  │   (Chat UI) │  │  Scripts    │  │   (Service Worker)      │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                         HTTP / SSE
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Node.js Backend                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Session   │  │  Copilot    │  │     SQLite DB           │  │
│  │  Service    │  │  Service    │  │                         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                         JSON-RPC
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     GitHub Copilot CLI                           │
│              (pre-installed & authenticated)                     │
└─────────────────────────────────────────────────────────────────┘
```

## Session Types

| Type | Icon | Description |
|------|------|-------------|
| DevOps | 🛠️ | Expert in cloud, Kubernetes, CI/CD, IaC |
| Writing | ✍️ | Email, rewriting, translation, grammar |
| Development | 💻 | Code review, debugging, best practices |
| General | 💬 | General-purpose assistant |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/sessions` | List sessions |
| POST | `/api/sessions` | Create session |
| GET | `/api/sessions/:id` | Get session |
| PATCH | `/api/sessions/:id` | Update session |
| DELETE | `/api/sessions/:id` | Delete session |
| POST | `/api/sessions/:id/resume` | Resume session |
| POST | `/api/sessions/:id/abort` | Abort request |
| GET | `/api/sessions/:id/messages` | Get messages |
| POST | `/api/sessions/:id/chat` | Send message |
| POST | `/api/sessions/:id/chat/stream` | Stream message (SSE) |

## Testing

```bash
# Unit tests
pnpm test:unit

# E2E tests
pnpm test:e2e

# All tests
pnpm test
```

## Configuration

The backend stores data in `~/.devmentorai/`:
- `devmentorai.db` - SQLite database with sessions and messages

The extension uses Chrome's `storage.local` for:
- Active session ID
- User preferences

## Development

### Adding a New Session Type

1. Add the type to `packages/shared/src/types/session.ts`
2. Add the agent config to `packages/shared/src/contracts/session-types.ts`
3. Update the UI in `apps/extension/src/components/NewSessionModal.tsx`

### Adding Custom Tools (Phase 3)

Custom tools can be added in `apps/backend/src/services/copilot.service.ts`:

```typescript
import { defineTool } from '@github/copilot-sdk';

const myTool = defineTool('my_tool', {
  description: 'What this tool does',
  parameters: { /* ... */ },
  handler: async (args) => { /* ... */ },
});
```

## Roadmap

- **Phase 1 (MVP)** ✅
  - Monorepo setup
  - WXT extension with React
  - Fastify backend with SQLite
  - Copilot SDK integration
  - Basic chat UI
  - DevOps/Writing/Development modes
  - Context menu actions
  - i18n (English/Spanish)

- **Phase 2**
  - Multi-session UI improvements
  - Floating bubble UI
  - Email writing assistant
  - Session history display

- **Phase 3**
  - Native Messaging support
  - Activity/transparency view
  - Custom DevOps tools
  - GitHub MCP Server integration

## License

MIT

## Contributing

Contributions are welcome! Please read the [Contributing Guide](docs/CONTRIBUTING.md) first.
