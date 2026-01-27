# DevMentorAI Architecture

## Overview

DevMentorAI is a Chrome extension that provides AI-powered DevOps mentoring, writing assistance, and development help. It uses GitHub Copilot CLI via the official Copilot SDK for Node.js.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     User's Browser                               │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                 DevMentorAI Extension                      │  │
│  │  ┌─────────────────┐  ┌─────────────────────────────────┐ │  │
│  │  │   Side Panel    │  │      Background Service Worker   │ │  │
│  │  │   (React UI)    │  │  - Context menu management       │ │  │
│  │  │  - Chat view    │  │  - Message routing               │ │  │
│  │  │  - Sessions     │  │  - Side panel control            │ │  │
│  │  │  - Activity     │  │  - Keyboard shortcuts            │ │  │
│  │  └────────┬────────┘  └──────────────────────────────────┘ │  │
│  │           │                                                 │  │
│  │  ┌────────┴────────┐  ┌─────────────────────────────────┐ │  │
│  │  │ Communication   │  │      Content Script              │ │  │
│  │  │ Service         │  │  - Floating bubble UI            │ │  │
│  │  │ - HTTP Adapter  │  │  - Selection toolbar             │ │  │
│  │  │ - Native Msg    │  │  - Text selection detection      │ │  │
│  │  └────────┬────────┘  └─────────────────────────────────┘ │  │
│  └───────────┼───────────────────────────────────────────────┘  │
└──────────────┼──────────────────────────────────────────────────┘
               │ HTTP (localhost:3847) or Native Messaging
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     DevMentorAI Backend                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Fastify Server                          │  │
│  │  ┌───────────┐ ┌──────────┐ ┌─────────┐ ┌───────────────┐ │  │
│  │  │  Health   │ │ Sessions │ │  Chat   │ │    Tools      │ │  │
│  │  │  Route    │ │  Routes  │ │ Routes  │ │    Routes     │ │  │
│  │  └───────────┘ └────┬─────┘ └────┬────┘ └───────┬───────┘ │  │
│  └─────────────────────┼────────────┼──────────────┼─────────┘  │
│                        │            │              │            │
│  ┌─────────────────────┼────────────┼──────────────┼─────────┐  │
│  │                     Services Layer                        │  │
│  │  ┌──────────────────┐ ┌────────────────────────────────┐ │  │
│  │  │  SessionService  │ │       CopilotService           │ │  │
│  │  │ - CRUD ops       │ │ - SDK client wrapper           │ │  │
│  │  │ - Message history│ │ - Tool execution               │ │  │
│  │  │ - Persistence    │ │ - MCP server integration       │ │  │
│  │  └────────┬─────────┘ │ - Retry logic                  │ │  │
│  │           │           └────────────┬───────────────────┘ │  │
│  └───────────┼────────────────────────┼─────────────────────┘  │
│              │                        │                        │
│  ┌───────────┴──────────┐  ┌─────────┴────────────────────┐   │
│  │     SQLite DB        │  │   @github/copilot-sdk        │   │
│  │  ~/.devmentorai/     │  │   - CopilotClient            │   │
│  │  - sessions table    │  │   - createSession()          │   │
│  │  - messages table    │  │   - Custom agents + Tools    │   │
│  └──────────────────────┘  └─────────┬────────────────────┘   │
│                                      │                        │
│  ┌───────────────────────────────────┴────────────────────┐   │
│  │                  DevOps Tools                          │   │
│  │  - read_file: Read local files                         │   │
│  │  - list_directory: Browse file system                  │   │
│  │  - analyze_config: K8s/Docker/Terraform analysis       │   │
│  │  - analyze_error: Error diagnosis                      │   │
│  └────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
               │ JSON-RPC
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     GitHub Copilot CLI                           │
│  - Pre-installed by user                                         │
│  - Authenticated via GitHub                                      │
│  - Handles LLM communication                                     │
│  - Manages tool execution                                        │
└─────────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. WXT Framework for Extension

**Why WXT?**
- Modern TypeScript-first framework for browser extensions
- Hot Module Replacement (HMR) for development
- File-based routing for entrypoints
- Cross-browser support (Chrome, Firefox, etc.)
- Built-in manifest generation

### 2. Side Panel as Primary UI

**Why Side Panel over Popup?**
- Persistent: stays open while navigating
- More screen real estate for chat
- Better UX for extended conversations
- Doesn't block page content

### 3. Communication Abstraction Layer

**Dual-Protocol Support:**
The extension uses a `CommunicationService` that abstracts over:
- **HTTP Adapter** (Default): Simple REST/SSE communication
- **Native Messaging Adapter**: Direct Chrome Native Messaging protocol

```typescript
// Automatically falls back to HTTP if Native Messaging fails
const service = getCommunicationService();
await service.initialize(); // Auto-detects available mode
```

### 4. SQLite for Persistence

**Why SQLite?**
- Zero-configuration, serverless database
- ACID transactions
- Excellent performance for this scale
- Single file storage (~/.devmentorai/devmentorai.db)
- WAL mode for concurrent reads/writes

### 5. Custom Agents per Session Type

**Approach:**
- Each session type (DevOps, Writing, Development) has a pre-configured agent
- Agents are defined using the SDK's `customAgents` feature
- System prompts guide the AI's behavior and expertise
- Users can also provide custom system prompts

### 6. Streaming via Server-Sent Events (SSE)

**Why SSE over WebSocket?**
- Simpler protocol for server-to-client streaming
- Built-in browser support
- Automatic reconnection
- Works well with HTTP/2
- One-way (server to client) which is our use case

## Data Flow

### Chat Message Flow

```
1. User types message in Side Panel
                ↓
2. React component calls useChat hook
                ↓
3. CommunicationService routes to appropriate adapter
                ↓
4. POST /api/sessions/:id/chat/stream
                ↓
5. Backend saves user message to SQLite
                ↓
6. CopilotService.streamMessage() called
                ↓
7. SDK emits events (message_delta, tool_start, etc.)
                ↓
8. Events converted to SSE and sent to client
                ↓
9. ActivityView shows tool executions (if any)
                ↓
10. React updates UI with streaming content
                ↓
11. On session.idle, save assistant message to SQLite
                ↓
12. Send [DONE] to close SSE connection
```

### Context Menu Action Flow

```
1. User selects text and right-clicks
                ↓
2. Chrome shows DevMentorAI context menu
                ↓
3. User clicks "Explain this" (or other action)
                ↓
4. Background script captures selection + action
                ↓
5. Stores as pendingAction in chrome.storage.local
                ↓
6. Opens Side Panel
                ↓
7. Side Panel checks for pendingAction on mount
                ↓
8. Constructs prompt with action prefix + selected text
                ↓
9. Sends to backend as normal chat message
```

### Selection Toolbar Flow

```
1. User selects text on any webpage
                ↓
2. Content script detects selection via SelectionToolbar
                ↓
3. Toolbar appears above selection with quick actions
                ↓
4. User clicks action (e.g., "Explain", "Translate")
                ↓
5. Action sent to background script via runtime message
                ↓
6. Background opens Side Panel with pendingText
                ↓
7. Chat auto-sends the action request
```

## Security Considerations

1. **No Credential Storage**
   - Extension never stores GitHub tokens
   - Relies on Copilot CLI's existing authentication

2. **Local-Only Communication**
   - Backend only listens on localhost
   - No external network calls from extension to backend

3. **Input Validation**
   - Zod schemas validate all API inputs
   - Prevent injection attacks

4. **Content Script Isolation**
   - Uses Shadow DOM for floating bubble and toolbar
   - Isolated styles prevent page interference

5. **File System Sandbox**
   - DevOps tools only access allowed directories
   - Prevents unauthorized file system access

## Native Messaging Architecture

```
┌─────────────┐      stdin/stdout      ┌──────────────────┐
│  Extension  │ ←─────────────────────→│  Native Host     │
│             │    JSON messages       │  (Node.js)       │
│  Native     │                        │                  │
│  Messaging  │    4-byte length +     │  - Routes to     │
│  Adapter    │    JSON payload        │    Fastify       │
└─────────────┘                        │  - SSE → chunks  │
                                       └────────┬─────────┘
                                                │
                                       ┌────────┴─────────┐
                                       │  Copilot SDK     │
                                       └──────────────────┘
```

**Installation:**
```bash
cd apps/backend
node src/native/install-native-host.js <extension-id>
```

## Custom DevOps Tools

The backend provides specialized tools for DevOps analysis:

| Tool | Description | Parameters |
|------|-------------|------------|
| `read_file` | Read local file contents | `path`, `maxLines` |
| `list_directory` | List directory contents | `path`, `recursive` |
| `analyze_config` | Analyze IaC configs | `content`, `type` |
| `analyze_error` | Diagnose error messages | `error`, `context` |

**Supported Config Types:**
- Kubernetes manifests
- Docker/Dockerfile
- Terraform (.tf)
- CloudFormation (YAML/JSON)
- GitHub Actions workflows

**Example API Usage:**
```bash
# Analyze a Kubernetes config
curl -X POST http://localhost:3847/api/tools/analyze-config \
  -H "Content-Type: application/json" \
  -d '{"content": "apiVersion: v1...", "type": "kubernetes"}'
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+N` | Create new session |
| `Ctrl+K` | Focus chat input |
| `Ctrl+Enter` | Send message |
| `Ctrl+/` | Show shortcuts help |
| `Ctrl+Shift+S` | Open settings |
| `Escape` | Close modal / Cancel |

## Future Considerations

### MCP Server Integration

```typescript
const session = await client.createSession({
  mcpServers: {
    github: {
      type: "http",
      url: "https://api.githubcopilot.com/mcp/",
    },
    filesystem: {
      type: "stdio",
      command: "npx",
      args: ["@modelcontextprotocol/server-filesystem", "/allowed/path"]
    }
  },
});
```

Enables:
- Repository analysis
- PR review integration
- Issue management
- Extended file system access
