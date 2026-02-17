import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'DevMentorAI',
    description: 'DevOps mentoring and writing assistant powered by GitHub Copilot',
    version: '1.1.1',
    browser_specific_settings: {
      gecko: {
        id: 'devmentorai@devmentorai.com',
        // @ts-ignore - data_collection_permissions is required by Firefox but not yet in WXT types
        data_collection_permissions: {
          includes_sensitive_data: false,
          includes_account_credentials: false,
          includes_personal_data: false,
        },
      },
    },
    permissions: [
      'storage',
      'activeTab',
      'contextMenus',
      'scripting',
      'tabs',
      'alarms',
    ],
    optional_permissions: [
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
    options_ui: {
      page: 'options.html',
      open_in_tab: true,
    },
  },
  runner: {
    startUrls: ['https://github.com'],
  },
});
