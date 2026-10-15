/* eslint-disable prettier/prettier */
import { resolve } from 'path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';




export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@': resolve(__dirname, './src'),
        '@shadcn-components': resolve(__dirname, 'src/renderer/src/components')
      }
    },
    /* The line `// const productControler = require(__dirname,
    '/../../src/database/controlers/productControler')` is attempting to import a module named
    `productControler` from a specific file path within the project directory structure. */
    plugins: [react()]
  }
});
