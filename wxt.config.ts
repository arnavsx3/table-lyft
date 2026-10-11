import { defineConfig } from 'wxt';

// https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Wingman - OmeTV Smart Filter',
    description: 'Auto-filter and skip OmeTV connections based on gender preferences.',
    version: '1.0.0',
    permissions: ['storage'],
    host_permissions: [
      '*://*.ome.tv/*',
      '*://ome.tv/*'
    ],
    action: {
      default_title: 'Wingman Controller'
    }
  }
});
