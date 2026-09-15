import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  site: 'https://seetapsych.github.io/seetapsych-hertz/',
  base: '/',
  server: {
    host: true,
    port: 4321,
  },
  preview: {
    host: true,
    port: 4321,
  },
});
