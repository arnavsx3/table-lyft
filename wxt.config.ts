import { defineConfig } from 'wxt';
import { SITE_MATCHES } from './modules/ometv/constants';

// https://wxt.dev/api/config.html
export default defineConfig({
  outDir: 'dist',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Wingman - OmeTV Smart Filter',
    description: 'On-device OmeTV connection filtering with confidence controls and cancellable auto-skip.',
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
    web_accessible_resources: [
      {
        resources: ['models/*'],
        matches: SITE_MATCHES
      }
    ],
    browser_specific_settings: {
      gecko: {
        id: 'wingman-extension@arnavsx3.github.io',
        strict_min_version: '109.0',
        data_collection_permissions: { required: ['none'] }
      }
    }
  }
});
