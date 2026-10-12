import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: 'src',
  entrypointsDir: '../entrypoints',
  manifest: {
    name: 'TableLyft',
    description:
      'Select loaded web tables, preview clean columns, and export locally to CSV, spreadsheets, or Markdown.',
    minimum_chrome_version: '120',
    permissions: ['activeTab', 'scripting', 'storage', 'clipboardWrite'],
    icons: { 16: '/icon-16.png', 32: '/icon-32.png', 48: '/icon-48.png', 128: '/icon-128.png' },
    action: { default_title: 'TableLyft' },
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'none'; base-uri 'none'; connect-src 'none'",
    },
  },
});
