import { HeroSection } from '@/components/sections/HeroSection';
import { CodeBlock } from '@/components/ui/CodeBlock';
import { DownloadButtons } from '@/components/ui/DownloadButtons';
import { StepCard } from '@/components/ui/StepCard';
import { getFallbackRelease, getLatestExtensionRelease } from '@/lib/github-releases';
import { Container, KeyRound, LogIn, Package, Terminal } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Installation',
  description:
    'Install DevMentorAI on Windows, macOS, or Linux: the npm backend (global install or npx), the browser extension, optional Native Messaging, and a Docker backend that signs in with a GitHub token or copilot login.',
};

const DOCKER_GUIDE_URL =
  'https://github.com/BOTOOM/devmentorai/blob/master/docs/DOCKER_COPILOT_SETUP.md';

const BACKEND_OPTIONS = [
  {
    icon: Package,
    title: 'Global npm install',
    badge: 'Recommended',
    description:
      'Install once and run devmentorai-server from any terminal. Best for daily use, especially on Windows.',
    href: '#backend',
  },
  {
    icon: Terminal,
    title: 'npx',
    badge: 'Quick try',
    description:
      'Run the latest version without installing it globally. npx may ask to install again whenever a new version is published.',
    href: '#backend',
  },
  {
    icon: Container,
    title: 'Docker',
    badge: 'Fallback',
    description:
      'Run the backend in a container on Windows, macOS, or Linux if the npm install gives you trouble.',
    href: '#docker',
  },
] as const;

export default async function InstallationPage() {
  const release = (await getLatestExtensionRelease()) ?? getFallbackRelease();

  return (
    <>
      <HeroSection
        title={
          <>
            Get started in <span className="text-primary">a few minutes.</span>
          </>
        }
        subtitle="Run the local backend, add the browser extension, and connect them. Works natively on Windows (PowerShell or CMD, no WSL needed), macOS, and Linux."
      />

      <section className="mx-auto max-w-[800px] px-4 pb-12 sm:px-6">
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--section-alt)] p-5 sm:p-6">
          <h2 className="text-lg font-bold sm:text-xl">What you need</h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[var(--muted)] sm:text-base">
            <li>
              A GitHub account with{' '}
              <a
                href="https://github.com/features/copilot"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary hover:underline"
              >
                GitHub Copilot
              </a>{' '}
              access.
            </li>
            <li>
              For the npm backend:{' '}
              <a
                href="https://nodejs.org"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary hover:underline"
              >
                Node.js 22.12+
              </a>{' '}
              and the Copilot CLI, logged in.
            </li>
            <li>
              For the Docker backend: Docker Desktop on Windows or macOS, or Docker Engine with
              Compose v2 on Linux, plus Git.
            </li>
            <li>Chrome, Chromium, or Firefox for the extension.</li>
          </ul>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {BACKEND_OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <a
                key={option.title}
                href={option.href}
                className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4 transition-colors hover:border-primary/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <Icon className="h-5 w-5 text-primary" />
                  <span className="rounded-full bg-primary-light px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                    {option.badge}
                  </span>
                </div>
                <p className="mt-3 text-sm font-bold">{option.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
                  {option.description}
                </p>
              </a>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-[800px] px-4 pb-20 sm:px-6 md:pb-24">
        <div className="space-y-12">
          {/* Step 1: Copilot CLI */}
          <StepCard
            step={1}
            title="Install and log in to Copilot CLI"
            description="The npm backend uses your Copilot CLI login. Using Docker instead? Skip to the Docker section; the container has its own login."
          >
            <CodeBlock code="npm install -g @github/copilot" language="bash" />
            <p className="mt-4 text-sm text-[var(--muted)]">
              Then run <InlineCode>copilot</InlineCode> and type <InlineCode>/login</InlineCode> in
              the prompt.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Link
                href="/docs/get-started/copilot-cli"
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
              >
                Copilot CLI guide
              </Link>
              <a
                href="https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-cli"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-4 py-2.5 text-sm font-semibold text-[var(--muted)] transition-colors hover:text-primary"
              >
                Official Copilot CLI docs
              </a>
            </div>
          </StepCard>

          {/* Step 2: Backend */}
          <div id="backend" className="scroll-mt-24">
            <StepCard
              step={2}
              title="Install and start the backend"
              description="Installing globally is the most reliable option on every OS. The same commands work in PowerShell, CMD, and macOS/Linux terminals."
            >
              <CodeBlock
                code={'npm install -g devmentorai-server@latest\ndevmentorai-server'}
                language="terminal"
              />
              <p className="mt-4 text-sm text-[var(--muted)]">
                Prefer not to install it? Run it with npx instead:
              </p>
              <div className="mt-3">
                <CodeBlock code="npx devmentorai-server" language="bash" />
              </div>

              <Callout title="Windows tips">
                <ul className="list-disc space-y-2 pl-5">
                  <li>
                    WSL is not needed, and paths with spaces such as{' '}
                    <InlineCode>C:\Users\Jane Doe</InlineCode> are supported.
                  </li>
                  <li>
                    <InlineCode>npm warn cleanup ... EPERM</InlineCode> messages are harmless: npm
                    could not delete temporary npx cache files that are still in use.
                  </li>
                  <li>
                    If npx keeps asking to install, switch to the global install. Stop the npx copy
                    first with <InlineCode>npx devmentorai-server stop</InlineCode>.
                  </li>
                </ul>
              </Callout>

              <h4 className="mt-8 text-base font-bold">Check, update, and troubleshoot</h4>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Check the installed version, or update to the latest one:
              </p>
              <div className="mt-3 space-y-3">
                <CodeBlock code="devmentorai-server --version" language="bash" />
                <CodeBlock
                  code={
                    'devmentorai-server stop\nnpm install -g devmentorai-server@latest\ndevmentorai-server'
                  }
                  language="update"
                />
              </div>
              <p className="mt-4 text-sm text-[var(--muted)]">
                Other useful commands: <InlineCode>devmentorai-server status</InlineCode>,{' '}
                <InlineCode>devmentorai-server logs</InlineCode>,{' '}
                <InlineCode>devmentorai-server doctor</InlineCode> (checks Node.js and Copilot CLI),
                and <InlineCode>devmentorai-server start --foreground</InlineCode> to see the logs
                live. The server listens on <InlineCode>http://localhost:3847</InlineCode>. Package
                on{' '}
                <a
                  href="https://www.npmjs.com/package/devmentorai-server"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  npm
                </a>
                .
              </p>
            </StepCard>
          </div>

          {/* Step 3: Extension */}
          <StepCard
            step={3}
            title="Add the browser extension"
            description="Download the DevMentorAI extension for your browser."
          >
            <DownloadButtons release={release} />
            <p className="mt-4 text-sm text-[var(--muted)]">
              For Chrome: unzip and load it via <InlineCode>chrome://extensions</InlineCode> →
              Enable Developer mode → Load unpacked.
            </p>
          </StepCard>

          {/* Step 4: Connect */}
          <StepCard
            step={4}
            title="Connect and chat"
            description="Click the DevMentorAI icon in your toolbar and open a session. By default the extension talks to the backend over HTTP."
            isLast
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4">
                <p className="text-sm font-bold">HTTP (default)</p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                  Works with the npm backend and Docker. The backend URL is{' '}
                  <InlineCode>http://localhost:3847</InlineCode>; change it in Settings → Backend
                  Connection if you use another host or port.
                </p>
              </div>
              <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4">
                <p className="text-sm font-bold">Native Messaging (optional, Chrome)</p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                  Chrome launches the backend for you, with no local port to keep open. Requires the
                  global npm install; it does not apply to Docker.
                </p>
              </div>
            </div>

            <p className="mt-6 text-sm text-[var(--muted)]">
              To enable Native Messaging, copy the extension ID from{' '}
              <InlineCode>chrome://extensions</InlineCode> and register the native host. PowerShell:
            </p>
            <div className="mt-3">
              <CodeBlock
                code={
                  'node "$(npm root -g)/devmentorai-server/dist/install-native-host.js" <extension-id>'
                }
                language="powershell"
              />
            </div>
            <p className="mt-4 text-sm text-[var(--muted)]">macOS/Linux:</p>
            <div className="mt-3">
              <CodeBlock
                code={
                  'node "$(npm root -g)/devmentorai-server/dist/install-native-host.js" <extension-id>'
                }
                language="bash"
              />
            </div>
            <p className="mt-4 text-sm text-[var(--muted)]">
              On Windows this also registers the host for Chrome and Chromium. Reload the extension,
              then choose <strong>Native Messaging</strong> in Settings → Advanced → Communication
              Mode. Run the same command with <InlineCode>--uninstall</InlineCode> instead of the ID
              to remove it.
            </p>
          </StepCard>
        </div>
      </section>

      {/* Docker */}
      <section
        id="docker"
        className="scroll-mt-24 border-t border-[var(--card-border)] bg-[var(--section-alt)] py-20"
      >
        <div className="mx-auto max-w-[800px] px-4 sm:px-6">
          <div className="mb-10">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-light text-primary">
              <Container className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-black tracking-tight sm:text-3xl">
              Alternative: run the backend in Docker
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--muted)] sm:text-base">
              If the npm install fails on your machine, run the backend in a container instead. It
              works the same on Windows, macOS, and Linux, includes its own Copilot CLI, and serves
              the backend on <InlineCode>http://localhost:3847</InlineCode>. You do not need Node.js
              or the Copilot CLI on your computer.
            </p>
          </div>

          <div className="space-y-12">
            <StepCard
              step={1}
              title="Get the project"
              description="Clone the repository and create your local .env file. The .env file is ignored by Git; never commit it."
            >
              <p className="mb-3 text-sm text-[var(--muted)]">PowerShell:</p>
              <CodeBlock
                code={
                  'git clone https://github.com/BOTOOM/devmentorai.git\nSet-Location devmentorai\nCopy-Item .env.example .env'
                }
                language="powershell"
              />
              <p className="mb-3 mt-4 text-sm text-[var(--muted)]">macOS/Linux:</p>
              <CodeBlock
                code={
                  'git clone https://github.com/BOTOOM/devmentorai.git\ncd devmentorai\ncp .env.example .env'
                }
                language="bash"
              />
            </StepCard>

            <StepCard
              step={2}
              title="Start the container"
              description="If the npm backend is running, stop it first with devmentorai-server stop so port 3847 is free."
            >
              <CodeBlock
                code={'docker compose up -d --build backend\ndocker compose logs backend'}
                language="terminal"
              />
              <p className="mt-4 text-sm text-[var(--muted)]">
                The logs tell you which sign-in method is active. They name the token variable in
                use but never print its value.
              </p>
            </StepCard>

            <StepCard
              step={3}
              title="Sign in to Copilot (pick one)"
              description="The container needs its own GitHub Copilot login. Choose the option that suits you."
            >
              <div className="space-y-6">
                <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-5 w-5 text-primary" />
                    <p className="font-bold">Option A: GitHub token</p>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                    Good for automated or headless setups. Create a{' '}
                    <a
                      href="https://github.com/settings/personal-access-tokens/new"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary hover:underline"
                    >
                      fine-grained personal access token
                    </a>{' '}
                    with the <strong>Copilot Requests</strong> permission and paste it into your{' '}
                    <InlineCode>.env</InlineCode> file:
                  </p>
                  <div className="mt-3">
                    <CodeBlock code="COPILOT_GITHUB_TOKEN=github_pat_your_token" language=".env" />
                  </div>
                  <p className="mt-3 text-sm text-[var(--muted)]">Then apply it:</p>
                  <div className="mt-3">
                    <CodeBlock code="docker compose up -d backend" language="terminal" />
                  </div>
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-relaxed text-[var(--muted)]">
                    <li>
                      Classic <InlineCode>ghp_</InlineCode> tokens do not work with Copilot.
                    </li>
                    <li>
                      <InlineCode>GH_TOKEN</InlineCode>, <InlineCode>GITHUB_TOKEN</InlineCode>, and{' '}
                      <InlineCode>COPILOT_TOKEN</InlineCode> are also accepted;{' '}
                      <InlineCode>COPILOT_GITHUB_TOKEN</InlineCode> wins if several are set.
                    </li>
                    <li>Keep the token only in .env; never share it or commit it.</li>
                  </ul>
                </div>

                <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5">
                  <div className="flex items-center gap-2">
                    <LogIn className="h-5 w-5 text-primary" />
                    <p className="font-bold">Option B: copilot login inside the container</p>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                    No token to create. Leave <InlineCode>COPILOT_GITHUB_TOKEN</InlineCode> empty,
                    start the container, and log in with a device code:
                  </p>
                  <div className="mt-3">
                    <CodeBlock
                      code="docker compose exec backend copilot login --device-code"
                      language="terminal"
                    />
                  </div>
                  <Callout title="Browser login note">
                    Without <InlineCode>--device-code</InlineCode>, Copilot may choose the browser
                    flow and redirect to{' '}
                    <InlineCode>http://127.0.0.1:&lt;port&gt;/callback</InlineCode>, which cannot
                    reach the container; press <InlineCode>Ctrl+C</InlineCode> and rerun with{' '}
                    <InlineCode>--device-code</InlineCode>.
                  </Callout>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
                    Open{' '}
                    <a
                      href="https://github.com/login/device"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary hover:underline"
                    >
                      github.com/login/device
                    </a>
                    , enter the code shown in the terminal, and approve access. Then restart the
                    backend so it picks up the login:
                  </p>
                  <div className="mt-3">
                    <CodeBlock code="docker compose restart backend" language="terminal" />
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
                    The login is saved in the <InlineCode>devmentorai-copilot</InlineCode> volume,
                    so it survives restarts, rebuilds, and updates.
                  </p>
                </div>
              </div>
            </StepCard>

            <StepCard
              step={4}
              title="Verify and connect the extension"
              description="Check that the backend is healthy and that Copilot is authenticated."
            >
              <p className="mb-3 text-sm text-[var(--muted)]">PowerShell:</p>
              <CodeBlock
                code={
                  "Invoke-RestMethod -Uri 'http://127.0.0.1:3847/api/health' | ConvertTo-Json -Depth 5\nInvoke-RestMethod -Uri 'http://127.0.0.1:3847/api/account/auth' | ConvertTo-Json -Depth 5"
                }
                language="powershell"
              />
              <p className="mb-3 mt-4 text-sm text-[var(--muted)]">macOS/Linux:</p>
              <CodeBlock
                code={
                  'curl -fsS http://127.0.0.1:3847/api/health\ncurl -fsS http://127.0.0.1:3847/api/account/auth'
                }
                language="bash"
              />
              <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
                In the extension, keep <strong>HTTP Server</strong> as the communication mode and
                use <InlineCode>http://localhost:3847</InlineCode>. Native Messaging only works with
                a backend installed on your computer, not with Docker.
              </p>
            </StepCard>

            <StepCard
              step={5}
              title="Update, reset, and stay safe"
              description="Your sessions and your Copilot login live in Docker volumes, so updates keep them."
              isLast
            >
              <p className="mb-3 text-sm text-[var(--muted)]">Update to the latest version:</p>
              <CodeBlock
                code={'git pull\ndocker compose up -d --build backend'}
                language="update"
              />
              <p className="mb-3 mt-4 text-sm text-[var(--muted)]">
                Sign out or switch accounts by removing only the login volume (your chat data in{' '}
                <InlineCode>devmentorai-data</InlineCode> stays):
              </p>
              <CodeBlock
                code={
                  'docker compose down\ndocker volume rm devmentorai-copilot\ndocker compose up -d backend'
                }
                language="reset login"
              />
              <Callout title="Keep it local">
                The port is published only on <InlineCode>127.0.0.1</InlineCode> by default. Setting{' '}
                <InlineCode>BACKEND_BIND_ADDRESS=0.0.0.0</InlineCode> exposes an unauthenticated API
                that can spend your Copilot quota, so only do it on a trusted network. The full{' '}
                <a
                  href={DOCKER_GUIDE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  Docker guide
                </a>{' '}
                covers remote access, tunnels, custom ports, and troubleshooting.
              </Callout>
            </StepCard>
          </div>
        </div>
      </section>

      {/* Help footer */}
      <section className="mx-auto max-w-[800px] px-4 py-20 sm:px-6">
        <div className="border-t border-[var(--card-border)] pt-12 text-center">
          <div className="mb-5 flex flex-wrap items-center justify-center gap-2">
            <a
              href="/faq"
              className="rounded-full border border-[var(--card-border)] bg-[var(--card)] px-3 py-1.5 text-xs font-semibold text-[var(--muted)] transition-colors hover:text-primary"
            >
              Read FAQ
            </a>
            <a
              href="/changelog"
              className="rounded-full border border-[var(--card-border)] bg-[var(--card)] px-3 py-1.5 text-xs font-semibold text-[var(--muted)] transition-colors hover:text-primary"
            >
              What&apos;s new
            </a>
            <a
              href="/support"
              className="rounded-full border border-[var(--card-border)] bg-[var(--card)] px-3 py-1.5 text-xs font-semibold text-[var(--muted)] transition-colors hover:text-primary"
            >
              Help & Feature Requests
            </a>
          </div>
          <p className="text-sm text-[var(--muted)]">
            Need help?{' '}
            <a
              href="https://github.com/BOTOOM/devmentorai/blob/master/README.md"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary hover:underline"
            >
              Read the full documentation
            </a>{' '}
            or{' '}
            <a
              href="https://github.com/BOTOOM/devmentorai/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary hover:underline"
            >
              open an issue on GitHub
            </a>
            .
          </p>
        </div>
      </section>
    </>
  );
}

function InlineCode({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <code className="rounded bg-[var(--section-alt)] px-1.5 py-0.5 font-mono text-xs">
      {children}
    </code>
  );
}

function Callout({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <div className="mt-6 rounded-xl border border-amber-300/40 bg-amber-100/40 p-4 sm:p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
        {title}
      </p>
      <div className="mt-2 text-sm leading-relaxed text-[var(--foreground)]">{children}</div>
    </div>
  );
}
