# Context-Aware Mentor Mode

DevMentorAI's Context-Aware Mentor Mode allows the AI assistant to understand what you're currently viewing in your browser. This feature is especially useful when debugging errors, understanding cloud consoles, or getting help with complex UIs.

## How It Works

When enabled, Context-Aware Mode:

1. **Extracts page context** - URL, title, visible text, headings, and structure
2. **Detects the platform** - Recognizes Azure, AWS, GCP, GitHub, GitLab, Kubernetes dashboards, and more
3. **Identifies errors** - Finds error messages, alerts, and warnings on the page
4. **Provides factual context** - Sends page data to the AI so it can understand your situation
5. **Agent autonomy** - The AI decides what's relevant and how to help (no hard-coded rules)

### Phase 3: Autonomous Agent Design

**Important:** DevMentorAI does NOT try to guess what you want. Instead:

- We provide **factual context** (what's on the page)
- The AI **decides** what you need based on your message
- Works in **any language** - no keyword matching
- The AI interprets your intent, not our code

This design ensures the AI can help with anything you ask, in any language, without being limited by hard-coded patterns.

## Supported Platforms

| Platform | Detection Confidence | Specific Products |
|----------|---------------------|-------------------|
| Azure | High | Portal, DevOps, Virtual Machines |
| AWS | High | Console, EC2, S3, CloudFormation |
| GCP | High | Cloud Console, GKE, Cloud Run |
| GitHub | High | Repos, Actions, Issues, PRs |
| GitLab | High | Projects, Pipelines, MRs |
| Kubernetes | Medium | Dashboard, Lens |
| Datadog | Medium | Dashboards, Monitors |
| Grafana | Medium | Dashboards, Alerts |
| Jenkins | Medium | Jobs, Pipelines |

## Using Context-Aware Mode

### Enable Context Mode

1. Open the DevMentorAI side panel
2. Click the **Sparkles (✨) button** next to the message input
3. The button will highlight when context mode is active
4. Type your question and send

### What You'll See

When context mode is enabled:
- A context preview bar appears showing the detected platform
- Confidence score for platform detection
- Count of errors/warnings detected on the page
- You can expand the preview to see more details

### Best Use Cases

**Debugging Errors:**
```
"Why is this deployment failing?"
"What's causing this 504 error?"
"Help me understand this Kubernetes crash loop"
```

**Learning & Mentoring:**
```
"Teach me what this configuration does"
"What are the best practices for this setup?"
"Is this IAM policy secure?"
```

**Understanding Complex UIs:**
```
"What does this dashboard show?"
"Explain these metrics"
"What should I check first here?"
```

## Privacy & Security

Context-Aware Mode is designed with privacy in mind:

### What We Extract
- Page URL and title
- Visible text content (truncated to 5000 chars)
- Headings (H1-H3)
- Error messages and alerts
- User-selected text

### What We DON'T Extract
- **Passwords** - Password fields are detected and redacted
- **API Keys/Tokens** - Values matching key patterns are redacted
- **Form inputs** - Sensitive form data is excluded
- **Full DOM** - Only relevant sections, not the complete page

### Automatic Redaction

The extension automatically redacts:
- Bearer tokens (`Authorization: Bearer xxx`)
- API keys (`api_key=xxx`, `apiKey=xxx`)
- URL parameters like `token`, `key`, `secret`, `password`
- Any content in `type="password"` fields

### No Data Storage

- Context is extracted on-demand, never stored
- Screenshots (Phase 3) will require explicit consent
- No credentials are ever transmitted or logged

## Technical Details

### Context Payload Schema

```typescript
interface ContextPayload {
  metadata: {
    version: string;
    extractedAt: string;
    extractionTimeMs: number;
  };
  page: {
    url: string;
    hostname: string;
    title: string;
    platform: {
      type: 'azure' | 'aws' | 'gcp' | 'github' | ...;
      confidence: number; // 0-1
      specificProduct?: string;
    };
  };
  text: {
    selectedText?: string;
    visibleText: string;
    headings: Array<{ level: number; text: string }>;
    errors: Array<{
      message: string;
      type: 'error' | 'warning' | 'info';
      severity: 'critical' | 'high' | 'medium' | 'low';
      source?: string;
    }>;
  };
  session: {
    sessionId: string;
    intent: {
      primary: 'debug' | 'mentor' | 'understand' | 'help' | 'explain' | 'guide';
      confidence: number;
    };
  };
}
```

### Intent-Based Prompting

The backend uses different system prompts based on detected intent:

| Intent | Behavior |
|--------|----------|
| **debug** | Root cause analysis, actionable fixes, error explanation |
| **mentor** | Teaching mode, best practices, underlying concepts |
| **understand** | Clear explanations, UI element breakdown |
| **help** | Step-by-step guidance, pitfall warnings |
| **explain** | Educational deep-dives, examples |
| **guide** | Process walkthroughs, UI references |

### Performance

- Context extraction: < 200ms typical
- Platform detection: Instant (pattern matching)
- Total overhead: < 500ms added to request

## Roadmap

### Phase 1 ✅ COMPLETE
- Basic context extraction
- Platform detection (10+ platforms)
- Error detection
- Intent-based prompting
- Privacy redaction

### Phase 2 ✅ COMPLETE
- **Console log capture** - Captures browser console errors and warnings
- **Network error detection** - Detects failed fetch/XHR requests
- **Code block extraction** - Finds code snippets with language detection
- **Table extraction** - Extracts data tables with structure info
- **Form context** - Summarizes form fields (values redacted for sensitive fields)
- **Modal detection** - Captures active modal/dialog content
- **Platform-specific extractors** - Azure, AWS, GCP, GitHub specific context

### Phase 3 (Future)
- Optional screenshot capture
- Vision model integration
- Proactive suggestions
- Context caching for performance

## Phase 2 Features in Detail

### Console Log Capture

The extension can capture JavaScript console errors and warnings that occur while you're viewing the page. This is especially useful for debugging:

```
🔴 ERROR: Uncaught TypeError: Cannot read property 'map' of undefined
   Stack: at Component.render (app.js:123)

🟡 WARN: Deprecation warning: This API will be removed in v3.0
```

To enable console log capture, the content script monitors console.error and console.warn calls.

### Network Error Detection

Failed API requests are automatically detected and reported:

```
🌐 2 failed request(s):
- GET https://api.example.com/users → HTTP 404
- POST https://api.example.com/data → HTTP 500
```

Both fetch() and XMLHttpRequest errors are captured.

### Code Block Extraction

Code snippets found on the page are extracted with automatic language detection:

- Detects language from CSS classes (e.g., `language-javascript`, `hljs-python`)
- Infers language from content patterns (YAML, JSON, bash scripts)
- Shows up to 3 code blocks in the context

### Platform-Specific Context

When you're on recognized platforms, extra context is extracted:

**Azure:**
- Subscription ID
- Resource group
- Blade name
- Activity log entry count

**AWS:**
- Service name
- Region
- Active alarms count
- Error banners

**GCP:**
- Project ID
- Service name

**GitHub:**
- Repository info (owner/repo)
- Section (Actions, PR, Issues)
- Failed jobs count
- Merge conflict status

## Troubleshooting

### Context Not Extracting

1. **Check permissions** - Ensure DevMentorAI has access to the current site
2. **Refresh the page** - Dynamic content may need a reload
3. **Check console** - Look for extraction errors in the browser console

### Platform Not Detected

If your platform isn't recognized:
- The system will fall back to "generic" mode
- You can still use context mode, just with less platform-specific guidance
- Consider filing a feature request for your platform

### Errors Not Found

Some pages use custom error styling that may not be detected. The system looks for:
- `[role="alert"]` ARIA elements
- `.error`, `.alert`, `.warning` CSS classes
- Red text styling

## Contributing

Want to add support for a new platform? The detection logic is in:
- `apps/extension/src/lib/context-extractor.ts` - Platform detection
- `apps/backend/src/services/context-prompt-builder.ts` - Platform-specific prompts

Each platform needs:
1. Hostname patterns
2. URL patterns
3. DOM indicators (optional)
4. Platform-specific system prompt additions
