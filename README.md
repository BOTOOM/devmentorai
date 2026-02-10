# DevMentorAI

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Sponsor](https://img.shields.io/badge/Sponsor-%E2%9D%A4-pink)](https://github.com/sponsors/BOTOOM)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/edwardiazdev)

A Chrome/Chromium browser extension that provides DevOps mentoring, infrastructure guidance, and writing assistance powered by GitHub Copilot CLI via the Copilot SDK for Node.js.

## Features

- 🛠️ **DevOps Mentor** - Expert guidance on AWS, Azure, GCP, Kubernetes, CI/CD, and Infrastructure as Code
- ✍️ **Writing Assistant** - Email composition, rewriting, translation, and grammar fixes
- 💻 **Development Helper** - Code review, debugging, and best practices
- 💬 **Multi-Session Support** - Manage multiple independent conversations
- 🌐 **Context Awareness** - Use selected text and page context in conversations
- 🔄 **Streaming Responses** - Real-time streaming of AI responses
- 🔧 **Custom DevOps Tools** - Config analysis, error diagnosis, file access
- 🎯 **Selection Toolbar** - Quick actions on text selection
- 🫧 **Floating Bubble** - Persistent UI overlay on any webpage
- ⌨️ **Keyboard Shortcuts** - Full keyboard navigation support
- 🌍 **i18n Support** - English and Spanish localization

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

# Terminal 2: Extension (with hot reload)
cd apps/extension && pnpm dev
```

## Project Structure

```
devmentorai/
├── apps/
│   ├── extension/          # WXT Chrome Extension
│   │   ├── src/
│   │   │   ├── entrypoints/ # Background, content, sidepanel, options
│   │   │   ├── components/  # React UI components
│   │   │   ├── hooks/       # React hooks (useKeyboardShortcuts)
│   │   │   └── services/    # Communication adapter (HTTP/Native)
│   │   └── public/
│   │       └── _locales/    # i18n (en, es)
│   │
│   └── backend/            # Node.js Backend
│       ├── src/
│       │   ├── routes/     # API endpoints
│       │   ├── services/   # CopilotService, SessionService
│       │   ├── tools/      # Custom DevOps tools
│       │   ├── native/     # Native Messaging host
│       │   └── db/         # SQLite database
│       └── tests/          # Vitest unit tests (57 tests)
│
├── packages/
│   └── shared/             # Shared types & contracts
│
├── tests/
│   └── e2e/                # Playwright E2E tests
│
└── docs/
    └── ARCHITECTURE.md     # Detailed architecture docs
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Chrome Extension (WXT)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Side Panel │  │  Content    │  │     Background          │  │
│  │  (Chat UI)  │  │  Scripts    │  │   (Service Worker)      │  │
│  │  Activity   │  │  - Bubble   │  │   - Context menus       │  │
│  │  Settings   │  │  - Toolbar  │  │   - Message routing     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                    HTTP/SSE or Native Messaging
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Node.js Backend                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Session   │  │  Copilot    │  │     DevOps Tools        │  │
│  │  Service    │  │  Service    │  │  - analyze_config       │  │
│  │             │  │  - Retry    │  │  - analyze_error        │  │
│  │  SQLite DB  │  │  - MCP      │  │  - read_file            │  │
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
| DevOps | 🔧 | Expert in cloud, Kubernetes, CI/CD, IaC, with custom analysis tools |
| Writing | ✍️ | Email, rewriting, translation, grammar, tone adjustment |
| Development | 💻 | Code review, debugging, best practices |
| General | 💬 | General-purpose assistant |

## Custom DevOps Tools

The backend provides specialized tools for DevOps analysis:

| Tool | Description |
|------|-------------|
| `read_file` | Read local files (sandboxed) |
| `list_directory` | Browse file system |
| `analyze_config` | Analyze K8s/Docker/Terraform/GH Actions configs |
| `analyze_error` | Diagnose errors with solutions |

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
| GET | `/api/models` | List available models |
| GET | `/api/tools` | List available tools |
| POST | `/api/tools/execute` | Execute a tool |
| POST | `/api/tools/analyze-config` | Analyze configuration |
| POST | `/api/tools/analyze-error` | Diagnose error |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+N` | Create new session |
| `Ctrl+K` | Focus chat input |
| `Ctrl+Enter` | Send message |
| `Ctrl+/` | Show shortcuts help |
| `Ctrl+Shift+S` | Open settings |
| `Escape` | Close modal / Cancel |
| `Alt+↑/↓` | Previous/Next session |

## Testing

```bash
# Backend unit tests (57 tests)
cd apps/backend && pnpm vitest run

# Build extension
pnpm build:extension

# All tests
pnpm test
```

## Configuration

The backend stores data in `~/.devmentorai/`:
- `devmentorai.db` - SQLite database with sessions and messages

The extension uses Chrome's `storage.local` for:
- Active session ID
- User preferences (theme, bubble position, toolbar enabled)
- Communication mode (HTTP or Native)

## Native Messaging (Optional)

For enhanced security, you can use Native Messaging instead of HTTP:

```bash
# Get your extension ID from chrome://extensions
cd apps/backend
node src/native/install-native-host.js <extension-id>
```

Then enable "Native Messaging" in DevMentorAI settings.

## Development

### Adding a New Session Type

1. Add the type to `packages/shared/src/types/session.ts`
2. Add the agent config to `packages/shared/src/contracts/session-types.ts`
3. Update the UI in `apps/extension/src/components/NewSessionModal.tsx`

### Adding Custom Tools

Add tools in `apps/backend/src/tools/devops-tools.ts`:

```typescript
export const myTool: Tool = {
  name: 'my_tool',
  description: 'What this tool does',
  parameters: {
    type: 'object',
    properties: {
      param1: { type: 'string', description: 'Parameter description' }
    },
    required: ['param1']
  },
  handler: async (params) => {
    // Implementation
    return result;
  },
};
```

## Implementation Status

- **Phase 1 (MVP)** ✅ Complete
  - Monorepo setup with pnpm
  - WXT extension with React + Tailwind
  - Fastify backend with SQLite
  - Copilot SDK integration
  - Chat UI with streaming
  - DevOps/Writing/Development modes
  - Context menu actions
  - i18n (English/Spanish)
  - 37 unit tests

- **Phase 2 (UX)** ✅ Complete
  - Multi-session UI improvements
  - Floating bubble UI (draggable)
  - Selection toolbar with quick actions
  - Tone adjustment (formal/casual/technical)
  - Settings page
  - Model selection per session
  - Quick prompts for session types

- **Phase 3 (Advanced)** ✅ Complete
  - Native Messaging support
  - Communication adapter abstraction
  - Activity view (tool visibility)
  - Custom DevOps tools (4 tools)
  - Retry logic with exponential backoff
  - MCP server configuration
  - Keyboard shortcuts
  - 57 unit tests total
  - Full documentation

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) before getting started.

## Support

If you find DevMentorAI useful, consider supporting the project:

- [GitHub Sponsors](https://github.com/sponsors/BOTOOM)
- [Buy Me a Coffee](https://buymeacoffee.com/edwardiazdev)
