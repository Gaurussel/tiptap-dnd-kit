import type { DndKitClasses, DndKitFeatures, DndKitOptions } from './types'

export const defaultFeatures: DndKitFeatures = {
    selectionDrag: true,
    atomDrag: true,
    nestedDrop: true,
    smartSpacing: true,
    animations: true,
}

export const defaultClasses: DndKitClasses = {
    source: 'dnd-kit-source',
    sourceInline: 'dnd-kit-source-inline',
    landing: 'dnd-kit-landing',
    landingInline: 'dnd-kit-landing-inline',
    inlineGap: 'dnd-kit-inline-gap',
    dropLine: 'dnd-kit-drop-line',
    preview: 'dnd-kit-preview',
}

export interface ResolvedConfig {
    features: DndKitFeatures
    classes: DndKitClasses
}

export function resolveConfig(options: Pick<DndKitOptions, 'features' | 'classes'>): ResolvedConfig {
    return {
        features: { ...defaultFeatures, ...options.features },
        classes: { ...defaultClasses, ...options.classes },
    }
}
