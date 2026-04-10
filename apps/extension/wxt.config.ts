import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    publicDir: resolve('src/public'),
  }),
  hooks: {
    'build:done': (_wxt, output) => {
      const publicDir = resolve('src/public');
      const resolvedOutput = output as { dir?: string; outDir?: string };
      const configuredOutDir = resolvedOutput.dir ?? resolvedOutput.outDir;
      const knownOutputDirs = [
        resolve('.output/chrome-mv3'),
        resolve('.output/chrome-mv3-dev'),
      ].filter((dir) => existsSync(dir));
      const outDirs = Array.from(
        new Set(
          [configuredOutDir ? resolve(configuredOutDir) : null, ...knownOutputDirs].filter(
            (dir): dir is string => dir !== null
          )
        )
      );

      if (outDirs.length === 0) {
        outDirs.push(resolve('.output/chrome-mv3'));
      }

      function copyDir(src: string, dest: string) {
        if (!existsSync(src)) return;
        mkdirSync(dest, { recursive: true });
        const entries = readdirSync(src, { withFileTypes: true });
        for (const entry of entries) {
          const srcPath = join(src, entry.name);
          const destPath = join(dest, entry.name);
          if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
          } else {
            copyFileSync(srcPath, destPath);
          }
        }
      }

      for (const outDir of outDirs) {
        copyDir(publicDir, outDir);
        console.log('[wxt] Copied public files to', outDir);
      }
    },
  },
  manifest: {
    name: 'DevMentorAI',
    description: 'DevOps mentoring and writing assistant powered by GitHub Copilot',
    version: '1.5.0',
    browser_specific_settings: {
      gecko: {
        id: 'devmentorai@devmentorai.com',
        // @ts-ignore - data_collection_permissions is required by Firefox but not yet in WXT types
        data_collection_permissions: {
          required: ['none'],
        },
      },
    },
    permissions: ['storage', 'activeTab', 'contextMenus', 'scripting', 'tabs', 'alarms'],
    host_permissions: ['http://localhost:3847/*', '<all_urls>'],
    default_locale: 'en',
    icons: {
      16: '/icons/icon-16.png',
      32: '/icons/icon-32.png',
      48: '/icons/icon-48.png',
      128: '/icons/icon-128.png',
    },
    side_panel: {
      default_path: 'sidepanel.html',
    },
    action: {
      default_title: 'DevMentorAI',
      default_icon: {
        16: '/icons/icon-16.png',
        32: '/icons/icon-32.png',
        48: '/icons/icon-48.png',
      },
    },
    options_ui: {
      page: 'options.html',
      open_in_tab: true,
    },
  },
  webExt: {
    startUrls: ['https://github.com'],
  },
});
