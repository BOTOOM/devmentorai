# Image Handling System

## Overview

DevMentorAI supports image attachments in chat messages, allowing users to:
- Capture screenshots of the visible tab
- Paste images from clipboard
- Drag & drop image files
- View images in chat history with a lightbox

All attached images are sent to the Copilot API as part of the message context.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Extension UI                               │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                     ChatView                                 │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │  ImageAttachmentZone                                  │  │ │
│  │  │  - Drag & drop target                                 │  │ │
│  │  │  - Screenshot button                                  │  │ │
│  │  │  - Image thumbnails (draft)                          │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │  useImageAttachments Hook                            │  │ │
│  │  │  - Draft image state (in memory)                     │  │ │
│  │  │  - Validation (max 5 images, 5MB each)              │  │ │
│  │  │  - Paste/drop handlers                               │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                              │                                    │
│                              │ ImagePayload[] (base64)           │
│                              ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  MessageBubble                                               │ │
│  │  - Display thumbnails from history                          │ │
│  │  - ImageLightbox (click to expand)                          │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
                               │
                               │ POST /api/sessions/:id/chat/stream
                               │ { prompt, images: [...] }
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                        Backend                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  chat.ts route                                               │ │
│  │  - Receives images[] in request body                        │ │
│  │  - Calls ThumbnailService                                   │ │
│  │  - Sends original images to Copilot API                     │ │
│  │  - Returns thumbnailUrl in response                         │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                              │                                    │
│                              ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  ThumbnailService                                            │ │
│  │  - Generates 200x200 JPEG thumbnails (60% quality)          │ │
│  │  - Saves to ~/.devmentorai/images/{sessionId}/{messageId}/  │ │
│  │  - Returns relative paths for DB storage                    │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                              │                                    │
│                              ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  images.ts route                                             │ │
│  │  GET /api/images/{sessionId}/{messageId}/{index}            │ │
│  │  - Serves thumbnails from disk                              │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

## Image Storage Strategy

### Draft Images (Extension)
- Stored in memory as base64 data URLs
- Max 5 images per message
- Max 5MB per image
- Cleared after send or discard

### Persisted Thumbnails (Backend)
- Location: `~/.devmentorai/images/{sessionId}/{messageId}/`
  - Windows: `C:\Users\{user}\.devmentorai\images\...`
  - macOS: `/Users/{user}/.devmentorai\images\...`
  - Linux: `/home/{user}/.devmentorai\images\...`
- Thumbnail filename: `thumb_{index}.jpg`
- Relative paths stored in SQLite for cross-platform portability
- Backend serves thumbnails via: `GET /api/images/{sessionId}/{messageId}/{index}`
- **Original images are NOT persisted** - sent directly to Copilot API

## Data Flow

### Sending a Message with Images

1. **User attaches images** (paste/drag/screenshot)
   - Images stored as base64 in `useImageAttachments` hook state
   - Displayed as thumbnails in `ImageAttachmentZone`

2. **User sends message**
   - `ChatView` calls `onSendMessage(text, useContext, images)`
   - `useChat` hook builds request with images array

3. **Backend receives request**
   - `chat.ts` extracts images from body
   - Calls `processMessageImages()` to generate thumbnails
   - Thumbnails saved to disk
   - Original images sent to Copilot API

4. **Response streamed to client**
   - Includes thumbnail URLs in final message metadata
   - Extension renders thumbnails from backend URLs

5. **Viewing in history**
   - `MessageBubble` renders `<img src={thumbnailUrl}>` 
   - Clicking opens `ImageLightbox`

### Session Cleanup

When a session is deleted:
1. `sessions.ts` route calls `deleteSessionImages(sessionId)`
2. `ThumbnailService` removes `~/.devmentorai/images/{sessionId}/` directory
3. Database cascade deletes message records

## Key Components

### Extension

| Component | Purpose |
|-----------|---------|
| `useImageAttachments` | Hook managing draft images, validation, paste/drop |
| `ImageThumbnail` | Displays single thumbnail with remove button |
| `ImageLightbox` | Full-screen modal for viewing images |
| `ImageAttachmentZone` | Drag & drop area, screenshot button, thumbnails |

### Backend

| Component | Purpose |
|-----------|---------|
| `ThumbnailService` | Sharp-based image processing and storage |
| `paths.ts` | Cross-platform path utilities |
| `images.ts` | Thumbnail serving endpoint |

## Types

```typescript
// Message with images
interface MessageMetadata {
  images?: ImageAttachment[];
}

interface ImageAttachment {
  id: string;
  source: 'screenshot' | 'paste' | 'drop';
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  dimensions: { width: number; height: number };
  fileSize: number;
  timestamp: string;
  thumbnailUrl?: string;  // Backend URL for display
}

// Request payload
interface ImagePayload {
  id: string;
  dataUrl: string;        // Base64 data URL
  mimeType: string;
  source: 'screenshot' | 'paste' | 'drop';
}
```

## User Settings

| Setting | Values | Default | Description |
|---------|--------|---------|-------------|
| `screenshotBehavior` | `disabled`, `ask`, `auto` | `disabled` | When to capture screenshots |
| `imageAttachmentsEnabled` | boolean | `true` | Enable/disable image attachments |

## Limits

| Limit | Value |
|-------|-------|
| Max images per message | 5 |
| Max image size | 5MB |
| Supported formats | PNG, JPEG, WebP |
| Thumbnail dimensions | 200x200px (max) |
| Thumbnail quality | 60% JPEG |

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Image > 5MB | Reject with error message |
| Unsupported format | Reject with error message |
| 6th image attached | Show "max 5 images" warning |
| Paste fails | Silent fail, log to console |
| Screenshot capture fails | Toast notification, continue without image |
| Backend thumbnail fails | Message sent without images, error logged |

## Cross-Platform Considerations

- All paths use `path.join()` - never string concatenation
- Home directory via `os.homedir()` 
- Paths in database stored as relative paths
- URL paths always use forward slashes
- Directory creation uses `{ recursive: true }`

## Testing

### Unit Tests
- `thumbnail-service.test.ts` - Image processing, storage, cleanup

### E2E Tests
- `image-attachments.spec.ts` - Paste, drag & drop, lightbox, limits

## Future Improvements

- [ ] Image compression settings
- [ ] Thumbnail retention/cleanup policy
- [ ] Image search within sessions
- [ ] Copy image from chat history
- [ ] Image annotations
