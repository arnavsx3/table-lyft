import { defineConfig } from 'wxt';
import { SITE_MATCHES } from './modules/ometv/constants';

// https://wxt.dev/api/config.html
export default defineConfig({
  outDir: 'dist',
  modules: ['@wxt-dev/module-react'],
  hooks: {
    'build:publicAssets': (_wxt, files) => {
      for (let index = files.length - 1; index >= 0; index--) {
        if (files[index]?.relativeDest.startsWith('models/')) files.splice(index, 1);
      }
    },
  },
  zip: { excludeSources: ['test-results/**', 'playwright-report/**'] },
  manifest: {
    name: 'Wingman - OmeTV Session Controls',
    description: 'Manual OmeTV session controls with live connection tracking and persistent counters.',
    permissions: ['storage'],
    host_permissions: SITE_MATCHES,
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
    browser_specific_settings: {
      gecko: {
        id: 'wingman-extension@arnavsx3.github.io',
        strict_min_version: '109.0',
        data_collection_permissions: { required: ['none'] }
      }
    }
  }
});
