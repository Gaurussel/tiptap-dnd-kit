import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const pkg = (path: string) => fileURLToPath(new URL(`../../packages/tiptap-dnd-kit/src/${path}`, import.meta.url))

export default defineConfig({
    plugins: [react()],
    server: { port: 5175, strictPort: true },
    resolve: {
        alias: [
            { find: 'tiptap-dnd-kit/react', replacement: pkg('react/index.ts') },
            { find: /^tiptap-dnd-kit$/, replacement: pkg('core/index.ts') },
        ],
    },
})
