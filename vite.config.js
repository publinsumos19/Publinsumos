import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build:demo` makes one self-contained HTML file with sample data (dist-demo/index.html).
export default defineConfig(({ mode }) => ({
  plugins: mode === 'demo' ? [react(), viteSingleFile()] : [react()],
  build: mode === 'demo' ? { outDir: 'dist-demo', chunkSizeWarningLimit: 3000 } : { chunkSizeWarningLimit: 1500 },
}));
