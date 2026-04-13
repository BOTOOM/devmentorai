export type ChangelogTrack = 'extension' | 'backend';

export interface ChangelogEntry {
  track: ChangelogTrack;
  version: string;
  tag: string;
  releasedAt: string;
  headline: string;
  summary: string;
  highlights: string[];
  fixes?: string[];
  releaseUrl: string;
}

export const CHANGELOG_DATA: Record<ChangelogTrack, ChangelogEntry[]> = {
  extension: [
    {
      track: 'extension',
      version: '1.6.0',
      tag: 'ext-v1.6.0',
      releasedAt: '2026-04-13',
      headline: 'You can now fine-tune Copilot responses from the browser',
      summary:
        'This release makes the extension feel much more flexible and polished by adding easier model controls, optional reasoning depth, and a long list of stability improvements.',
      highlights: [
        'A new model switch flow makes it easier to change how the assistant responds without leaving the browser workflow.',
        'Supported models can now use reasoning effort controls, so you can choose between faster answers and deeper thinking.',
        'The extension became more reliable overall thanks to fixes across hooks, components, utilities, and entry points.',
      ],
      fixes: [
        'Accessibility, build-output, and type-safety fixes made everyday use feel more stable and predictable.',
      ],
      releaseUrl: 'https://github.com/BOTOOM/devmentorai/releases/tag/ext-v1.6.0',
    },
    {
      track: 'extension',
      version: '1.5.0',
      tag: 'ext-v1.5.0',
      releasedAt: '2026-02-27',
      headline: 'Images are now first-class in chat',
      summary:
        'This release made image-based conversations much smoother, from upload flow to screenshot quality and clearer error feedback.',
      highlights: [
        'Chat now handles image attachments more smoothly, including the pre-upload flow behind the scenes.',
        'The side panel and chat experience now explain image-related issues more clearly when something goes wrong.',
        'Screenshot quality was improved so visual context is more useful when you ask for help.',
      ],
      fixes: ['Small screenshot-handling fixes improved reliability during capture and upload.'],
      releaseUrl: 'https://github.com/BOTOOM/devmentorai/releases/tag/ext-v1.5.0',
    },
    {
      track: 'extension',
      version: '1.4.0',
      tag: 'ext-v1.4.0',
      releasedAt: '2026-02-20',
      headline: 'Ongoing chats became safer and less disruptive',
      summary:
        'This update focused on reducing accidental friction mid-conversation and making generated text behave more naturally in your editor.',
      highlights: [
        'Suggested text can now be inserted at the cursor instead of overwriting the whole draft.',
        'Session recovery became more resilient when the backend temporarily loses track of an active chat.',
        'The chat flow was guarded against accidental model mismatches once a conversation had already started.',
      ],
      releaseUrl: 'https://github.com/BOTOOM/devmentorai/releases/tag/ext-v1.4.0',
    },
    {
      track: 'extension',
      version: '1.3.0',
      tag: 'ext-v1.3.0',
      releasedAt: '2026-02-19',
      headline: 'You can now point the extension to your own backend URL',
      summary:
        'This made it easier to use DevMentorAI with custom local setups instead of being locked to a single default backend address.',
      highlights: [
        'A configurable backend URL made it easier to connect the extension to custom or relocated backend instances.',
        'The release also helped more advanced users work with flexible local setups such as Docker-based backend environments.',
      ],
      releaseUrl: 'https://github.com/BOTOOM/devmentorai/releases/tag/ext-v1.3.0',
    },
    {
      track: 'extension',
      version: '1.2.0',
      tag: 'ext-v1.2.0',
      releasedAt: '2026-02-19',
      headline: 'Choosing the right model became much easier',
      summary:
        'The extension started giving you more context when picking models and made account visibility clearer at a glance.',
      highlights: [
        'Model search and pricing tiers made it faster to compare options before starting a session.',
        'Account status became easier to understand from the extension UI.',
        'Firefox behavior became smoother with better browser compatibility and side panel handling.',
      ],
      releaseUrl: 'https://github.com/BOTOOM/devmentorai/releases/tag/ext-v1.2.0',
    },
    {
      track: 'extension',
      version: '1.1.5',
      tag: 'ext-v1.1.5',
      releasedAt: '2026-02-19',
      headline: 'Foundation update for the next extension improvements',
      summary:
        'The published notes for this version were mostly about groundwork rather than a big user-facing feature drop.',
      highlights: [
        'This release mainly prepared the platform for upcoming account, model, and session improvements.',
        'No major new extension workflow was highlighted in the published release notes.',
      ],
      releaseUrl: 'https://github.com/BOTOOM/devmentorai/releases/tag/ext-v1.1.5',
    },
  ],
  backend: [
    {
      track: 'backend',
      version: '1.6.0',
      tag: 'backend-v1.6.0',
      releasedAt: '2026-04-13',
      headline: 'Smarter sessions and better backend reliability',
      summary:
        'This backend release helps the browser assistant stay more dependable while adding better support for model changes and reasoning-aware Copilot sessions.',
      highlights: [
        'Session handling was improved so model switches and reasoning settings behave more smoothly behind the scenes.',
        'Compatibility work keeps the backend aligned with newer GitHub Copilot protocol and runtime expectations.',
        'CLI and service updates make the local engine that powers the browser experience more stable day to day.',
      ],
      fixes: [
        'Node and SDK compatibility improvements reduced setup friction and made local startup more dependable.',
      ],
      releaseUrl: 'https://github.com/BOTOOM/devmentorai/releases/tag/backend-v1.6.0',
    },
    {
      track: 'backend',
      version: '1.5.0',
      tag: 'backend-v1.5.0',
      releasedAt: '2026-03-18',
      headline: 'Better compatibility with newer Copilot sessions',
      summary:
        'This release focused on keeping the local backend aligned with newer GitHub Copilot protocol changes so chats and tools stay reliable.',
      highlights: [
        'The Copilot SDK was updated to support protocol version 3.',
        'Runtime compatibility was improved so backend sessions behave more reliably in newer environments.',
      ],
      releaseUrl: 'https://github.com/BOTOOM/devmentorai/releases/tag/backend-v1.5.0',
    },
    {
      track: 'backend',
      version: '1.4.1',
      tag: 'backend-v1.4.1',
      releasedAt: '2026-03-17',
      headline: 'More reliable startup on newer Node versions',
      summary:
        'This patch focused on backend startup stability for users running modern local Node environments.',
      highlights: [
        'The backend bundled the Copilot SDK to avoid strict ESM module resolution problems in Node 20+.',
        'That reduced setup friction and made local startup more dependable.',
      ],
      releaseUrl: 'https://github.com/BOTOOM/devmentorai/releases/tag/backend-v1.4.1',
    },
    {
      track: 'backend',
      version: '1.4.0',
      tag: 'backend-v1.4.0',
      releasedAt: '2026-03-06',
      headline: 'A quieter backend release focused on stability',
      summary:
        'The published notes for this backend version did not call out major new user-facing backend workflows. It mostly sat inside a broader stabilization cycle.',
      highlights: [
        'No major end-user backend feature was highlighted in the published release notes for this version.',
        'This release mainly coincided with platform stabilization while newer capabilities rolled out across the product.',
      ],
      releaseUrl: 'https://github.com/BOTOOM/devmentorai/releases/tag/backend-v1.4.0',
    },
    {
      track: 'backend',
      version: '1.3.0',
      tag: 'backend-v1.3.0',
      releasedAt: '2026-02-27',
      headline: 'The backend learned new web and image workflows',
      summary:
        'This release expanded what the local backend could handle for richer chat requests and smoother self-hosted setups.',
      highlights: [
        'Support was added for reading public web content during assisted workflows.',
        'Image pre-upload support was added for richer chat requests.',
        'Permission handling was updated for newer Copilot SDK behavior.',
        'Docker Compose support made local backend setup easier for users who prefer containerized workflows.',
      ],
      fixes: ['Image processing and compression were optimized to make uploads more efficient.'],
      releaseUrl: 'https://github.com/BOTOOM/devmentorai/releases/tag/backend-v1.3.0',
    },
    {
      track: 'backend',
      version: '1.2.3',
      tag: 'backend-v1.2.3',
      releasedAt: '2026-02-19',
      headline: 'Diagnostics and account handling got sturdier',
      summary:
        'This version focused on making the backend easier to operate and troubleshoot locally.',
      highlights: [
        'Account routes and model-management capabilities were expanded.',
        'CLI diagnostics and backend error handling were improved so problems are easier to understand.',
      ],
      releaseUrl: 'https://github.com/BOTOOM/devmentorai/releases/tag/backend-v1.2.3',
    },
  ],
};

export function getChangelogEntries(track: ChangelogTrack): ChangelogEntry[] {
  return CHANGELOG_DATA[track];
}

export function getLatestChangelogEntries(): Record<ChangelogTrack, ChangelogEntry> {
  return {
    extension: CHANGELOG_DATA.extension[0],
    backend: CHANGELOG_DATA.backend[0],
  };
}

export function formatChangelogDate(date: string): string {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}
