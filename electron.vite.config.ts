import { resolve } from 'path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    entry: 'src/main/index.ts',
    build: {
      rollupOptions: {
        external: ['ffmpeg-static']
      }
    }
  },
  preload: {
    input: {
      index: 'src/preload/index.ts'
    },
    build: {
      rollupOptions: {
        output: {
          format: 'cjs',
          entryFileNames: '[name].cjs'
        }
      }
    }
  },
  renderer: {
    root: 'src/renderer',
    publicDir: resolve(__dirname, 'public'),
    plugins: [react()],
    build: {
      rollupOptions: {
        input: 'src/renderer/index.html'
      }
    }
  }
});
