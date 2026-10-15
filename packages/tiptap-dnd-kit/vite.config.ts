import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
    plugins: [react()],
    build: {
        emptyOutDir: true,
        lib: {
            entry: {
                core: fileURLToPath(new URL('src/core/index.ts', import.meta.url)),
                react: fileURLToPath(new URL('src/react/index.ts', import.meta.url)),
            },
            formats: ['es'],
        },
        rolldownOptions: {
            external: [/^@tiptap\//, /^@dnd-kit\//, 'react', 'react-dom', /^react\//],
        },
    },
})
