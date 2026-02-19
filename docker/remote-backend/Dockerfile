FROM node:22-bookworm-slim

WORKDIR /workspace

# System deps used by native Node modules and Copilot CLI runtime needs.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    g++ \
    git \
    make \
    python3 \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@9.15.4 --activate

# Copy whole monorepo (filtered by .dockerignore) so workspace build works consistently.
COPY . .

RUN pnpm install --frozen-lockfile \
  && pnpm --filter devmentorai-server build \
  && npm install -g @github/copilot \
  && useradd -m -u 10001 -s /bin/bash devmentor \
  && mkdir -p /home/devmentor/.copilot /home/devmentor/.devmentorai \
  && chown -R devmentor:devmentor /home/devmentor /workspace

COPY docker/remote-backend/entrypoint.sh /usr/local/bin/devmentor-entrypoint
RUN chmod +x /usr/local/bin/devmentor-entrypoint

USER devmentor
ENV HOME=/home/devmentor
ENV DEVMENTORAI_PORT=3847

EXPOSE 3847

ENTRYPOINT ["devmentor-entrypoint"]
