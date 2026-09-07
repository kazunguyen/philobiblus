import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '')
    const host = env.VITE_DEV_HOST
    const port = env.VITE_DEV_PORT

    if (!host || !port) {
        throw new Error('VITE_DEV_HOST and VITE_DEV_PORT environment variables are required')
    }

    return {
        plugins: [react(), tailwindcss()],
        resolve: {
            alias: {
                '@': fileURLToPath(new URL('./src', import.meta.url)),
            },
        },
        server: {
            port: Number(port),
            host,
        },
    }
})
