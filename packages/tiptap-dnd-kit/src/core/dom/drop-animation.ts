import type { DropAnimationFunction } from '@dnd-kit/dom'
import { prefersMotion } from '../plugin'

interface DropAnimationParams {
    getTarget(): DOMRect | null
    isEnabled(): boolean
    onFinished(): void
    duration: number
    easing: string
}

async function flyTo(overlay: HTMLElement, to: DOMRect, duration: number, easing: string) {
    const from = overlay.getBoundingClientRect()
    const { translate } = getComputedStyle(overlay)
    const [x = 0, y = 0] = translate === 'none' ? [] : translate.split(' ').map(parseFloat)
    const final = `${x + to.left - from.left}px ${y + to.top - from.top}px`
    // dnd-kit pins `translate` with !important unless data-dnd-dropping is set, and WAAPI cannot override !important.
    overlay.setAttribute('data-dnd-dropping', '')
    await overlay.animate({ translate: [`${x}px ${y}px`, final] }, { duration, easing }).finished
    // Hold the final spot until dnd-kit's cleanup, otherwise the overlay snaps back for a frame.
    overlay.style.setProperty('--dnd-translate', final)
    overlay.removeAttribute('data-dnd-dropping')
}

export function createDropAnimation({
    getTarget,
    isEnabled,
    onFinished,
    duration,
    easing,
}: DropAnimationParams): DropAnimationFunction {
    return async ({ feedbackElement }) => {
        const target = getTarget()
        if (target && feedbackElement instanceof HTMLElement && prefersMotion(isEnabled())) {
            await flyTo(feedbackElement, target, duration, easing)
        }
        onFinished()
    }
}
