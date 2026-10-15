class NoopObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
        return []
    }
}

globalThis.ResizeObserver ??= NoopObserver as unknown as typeof ResizeObserver
globalThis.IntersectionObserver ??= NoopObserver as unknown as typeof IntersectionObserver
globalThis.PointerEvent ??= class extends MouseEvent {} as unknown as typeof PointerEvent
