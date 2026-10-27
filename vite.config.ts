import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  build: {
    target: 'esnext'
  },
  ssr: {
    noExternal: ['@awesome.me/webawesome']
  }
});
