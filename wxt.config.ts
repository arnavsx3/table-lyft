import { defineConfig } from 'wxt';

// https://wxt.dev/api/config.html
export default defineConfig({
  outDir: 'dist',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Wingman - OmeTV Smart Filter',
    description: 'Auto-filter and skip OmeTV connections based on gender preferences.',
    version: '1.0.0',
    permissions: ['storage'],
    host_permissions: [
      '*://*.ome.tv/*',
      '*://ome.tv/*',
      '*://*.minichat.com/*',
      '*://minichat.com/*'
    ],
    action: {
      default_title: 'Wingman Controller',
      default_icon: {
        '16': 'icon-16.png',
        '32': 'icon-32.png',
        '48': 'icon-48.png',
        '128': 'icon-128.png'
      }
    },
    icons: {
      '16': 'icon-16.png',
      '32': 'icon-32.png',
      '48': 'icon-48.png',
      '128': 'icon-128.png'
    },
    web_accessible_resources: [
      {
        resources: ['models/*'],
        matches: ['*://*.ome.tv/*', '*://ome.tv/*', '*://*.minichat.com/*', '*://minichat.com/*']
      }
    ],
    browser_specific_settings: {
      gecko: {
        id: 'wingman-extension@arnavsx3.github.io',
        strict_min_version: '109.0'
      }
    }
  }
});
