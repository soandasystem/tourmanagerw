import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vite.dev/config/
/*
export default defineConfig({
  plugins: [svelte()],
  server: {
    proxy: {
      '/proxy-api': {
        target: 'https://stingray-app-trnzb.ondigitalocean.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy-api/, '/api')
      }
    }
  }
})
/*/
export default defineConfig({
  plugins: [svelte()],
  server: {
    proxy: {
      '/proxy-api': {
        target: 'https://tourmanager-bnd.onrender.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy-api/, '/api')
      }
    }
  }
})
