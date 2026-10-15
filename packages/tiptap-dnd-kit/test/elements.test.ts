import { createProxy, placeProxy } from '../src/core/dom/elements'

test('without a measurable range the proxy moves to the fallback point instead of keeping a stale rect', () => {
    const proxy = createProxy()
    placeProxy(proxy, new DOMRect(10, 20, 300, 40), { x: 0, y: 0 })
    placeProxy(proxy, null, { x: 5, y: 6 })
    expect([proxy.style.left, proxy.style.top, proxy.style.width, proxy.style.height]).toEqual([
        '5px',
        '6px',
        '1px',
        '1px',
    ])
})
