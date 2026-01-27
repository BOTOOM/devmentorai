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
│  │  │  - History      │  │                                  │ │  │
│  │  └────────┬────────┘  └──────────────────────────────────┘ │  │
│  │           │                                                 │  │
│  │  ┌────────┴────────┐  ┌─────────────────────────────────┐ │  │
│  │  │   API Client    │  │      Content Script              │ │  │
│  │  │  - HTTP/SSE     │  │  - Text selection detection      │ │  │
│  │  │  - Streaming    │  │  - Page context capture          │ │  │
│  │  └────────┬────────┘  └─────────────────────────────────┘ │  │
│  └───────────┼───────────────────────────────────────────────┘  │
└──────────────┼──────────────────────────────────────────────────┘
               │ HTTP (localhost:3847)
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     DevMentorAI Backend                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Fastify Server                          │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │  │
│  │  │   Health    │  │  Sessions   │  │        Chat         │ │  │
│  │  │   Route     │  │   Routes    │  │       Routes        │ │  │
│  │  └─────────────┘  └──────┬──────┘  └──────────┬──────────┘ │  │
│  └──────────────────────────┼────────────────────┼────────────┘  │
│                             │                    │               │
│  ┌──────────────────────────┼────────────────────┼────────────┐  │
│  │                     Services Layer                         │  │
│  │  ┌─────────────────────┐  ┌─────────────────────────────┐ │  │
│  │  │   SessionService    │  │      CopilotService         │ │  │
│  │  │  - CRUD operations  │  │  - SDK client wrapper       │ │  │
│  │  │  - Message history  │  │  - Session management       │ │  │
│  │  │  - Persistence      │  │  - Streaming responses      │ │  │
│  │  └──────────┬──────────┘  └──────────┬──────────────────┘ │  │
│  └─────────────┼─────────────────────────┼────────────────────┘  │
│                │                         │                       │
│  ┌─────────────┴─────────────┐  ┌───────┴─────────────────────┐  │
│  │        SQLite DB          │  │    @github/copilot-sdk      │  │
│  │  ~/.devmentorai/          │  │  - CopilotClient            │  │
│  │  - sessions table         │  │  - createSession()          │  │
│  │  - messages table         │  │  - resumeSession()          │  │
│  └───────────────────────────┘  │  - Custom agents            │  │
│                                 └───────────┬─────────────────┘  │
└─────────────────────────────────────────────┼────────────────────┘
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

### 3. Local HTTP Server vs Native Messaging

**MVP: HTTP Server**
- Simpler to implement and debug
- Works across all browsers
- Easy to test with curl/Postman
- No special permissions needed

**Future: Native Messaging (Phase 3)**
- More secure (no exposed ports)
- Better for enterprise environments
- Scaffolded and documented for future implementation

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
3. ApiClient.streamChat() initiates SSE connection
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
9. React updates UI with streaming content
                ↓
10. On session.idle, save assistant message to SQLite
                ↓
11. Send [DONE] to close SSE connection
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
   - Content script has minimal functionality
   - Uses Shadow DOM for any injected UI (Phase 2)

## Future Considerations

### Native Messaging (Phase 3)

```
Extension ←→ Native Host (Node.js) ←→ Copilot CLI
           stdin/stdout JSON
```

Benefits:
- No exposed HTTP ports
- Better process lifecycle management
- More secure for enterprise environments

### MCP Server Integration (Phase 3)

```typescript
const session = await client.createSession({
  mcpServers: {
    github: {
      type: "http",
      url: "https://api.githubcopilot.com/mcp/",
    },
  },
});
```

Enables:
- Repository analysis
- PR review integration
- Issue management

### Custom Tools (Phase 3)

```typescript
const analyzeConfig = defineTool("analyze_config", {
  description: "Analyze infrastructure configuration",
  handler: async ({ content, type }) => {
    // Parse Terraform/Kubernetes/Docker configs
    // Return best practice violations
  },
});
```
