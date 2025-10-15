import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'out',
    emptyOutDir: false, // TypeScriptのビルド結果を残すため
    lib: {
      entry: resolve(__dirname, 'src/webview/index.tsx'),
      name: 'webview',
      formats: ['iife'],
      fileName: () => 'webview.js',
    },
    rollupOptions: {
      output: {
        entryFileNames: 'webview.js',
        assetFileNames: 'webview.[ext]',
        inlineDynamicImports: true,
      },
    },
    sourcemap: process.env.NODE_ENV === 'development' ? 'inline' : false,
    minify: process.env.NODE_ENV !== 'development',
    target: 'es2020',
  },
  css: {
    modules: {
      localsConvention: 'camelCaseOnly',
      generateScopedName:
        process.env.NODE_ENV === 'development'
          ? '[name]__[local]___[hash:base64:5]'
          : '[hash:base64:8]',
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(
      process.env.NODE_ENV || 'production',
    ),
  },
});
