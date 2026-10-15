function fixedElement(): HTMLElement {
    const element = document.createElement('div')
    element.setAttribute('aria-hidden', 'true')
    Object.assign(element.style, { position: 'fixed', top: '0', left: '0', pointerEvents: 'none' })
    return element
}

export function createProxy(): HTMLElement {
    const proxy = fixedElement()
    proxy.style.visibility = 'hidden'
    return proxy
}

export function placeProxy(proxy: HTMLElement, rect: DOMRect | null, fallback: { x: number; y: number }): void {
    const box = rect ?? new DOMRect(fallback.x, fallback.y, 1, 1)
    Object.assign(proxy.style, {
        top: `${box.top}px`,
        left: `${box.left}px`,
        width: `${box.width}px`,
        height: `${box.height}px`,
    })
}

export function createOverlay(className: string): HTMLElement {
    const overlay = fixedElement()
    overlay.className = className
    overlay.style.visibility = 'hidden'
    // dnd-kit positions the overlay only while it carries data-dnd-dragging; outside that window (a quick
    // press-release, or the frame between dnd-kit's cleanup and ours) it would sit at 0,0 with the preview in it.
    new MutationObserver(() => {
        overlay.style.visibility = overlay.hasAttribute('data-dnd-dragging') ? '' : 'hidden'
    }).observe(overlay, { attributes: true, attributeFilter: ['data-dnd-dragging'] })
    return overlay
}

export function createDropLine(className: string, render?: (() => HTMLElement) | null): HTMLElement {
    const line = render?.() ?? document.createElement('div')
    line.classList.add(className)
    line.setAttribute('aria-hidden', 'true')
    Object.assign(line.style, { position: 'fixed', pointerEvents: 'none', zIndex: '2147483646' })
    line.hidden = true
    return line
}

export function placeDropLine(line: HTMLElement, rect: { left: number; width: number; y: number } | null): void {
    line.hidden = !rect
    if (!rect) return
    Object.assign(line.style, { top: `${rect.y - 1}px`, left: `${rect.left}px`, width: `${rect.width}px` })
}
