import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'DevMentorAI',
    description: 'DevOps mentoring and writing assistant powered by GitHub Copilot',
    version: '0.1.0',
    permissions: [
      'storage',
      'activeTab',
      'contextMenus',
      'sidePanel',
    ],
    host_permissions: [
      'http://localhost:3847/*',
      '<all_urls>',
    ],
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
  },
  runner: {
    startUrls: ['https://github.com'],
  },
});
