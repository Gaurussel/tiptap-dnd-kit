import type { DragDropManager } from '@dnd-kit/dom'
import type { Editor } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { Transaction } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'

export type DragKind = 'block' | 'node' | 'blocks' | 'text'

export interface DragRange {
    from: number
    to: number
}

export interface DragSource extends DragRange {
    kind: DragKind
}

export interface BlockLayout {
    top: number
    height: number
}

export interface DragLayout {
    blocks: BlockLayout[]
    end: number
}

export interface HoveredBlock {
    pos: number
    node: PMNode
    dom: HTMLElement
}

export type DndPhase = 'idle' | 'dragging' | 'dropping'

export interface DndState {
    enabled: boolean
    phase: DndPhase
    hoveredBlock: HoveredBlock | null
    source: DragSource | null
}

export interface DndKitFeatures {
    selectionDrag: boolean
    atomDrag: boolean
    nestedDrop: boolean
    smartSpacing: boolean
    animations: boolean
}

export interface DndKitClasses {
    source: string
    sourceInline: string
    landing: string
    landingInline: string
    inlineGap: string
    dropLine: string
    preview: string
}

export interface PreviewContext {
    source: DragSource
    element: HTMLElement | null
}

export type PreviewRenderer = (ctx: PreviewContext, container: HTMLElement) => (() => void) | undefined

export interface DndKitOptions {
    enabled: boolean
    manager: DragDropManager | null
    features: Partial<DndKitFeatures>
    classes: Partial<DndKitClasses>
    renderPreview: ((ctx: PreviewContext) => HTMLElement | null) | null
    renderDropLine: (() => HTMLElement) | null
    dropAnimation: { duration: number; easing: string }
    hoverArea: ((view: EditorView) => HTMLElement) | null
    canDrag: ((ctx: { source: DragSource; editor: Editor }) => boolean) | null
    canDrop: ((ctx: { source: DragSource; dropPos: number; editor: Editor }) => boolean) | null
    onDragStart: ((ctx: { source: DragSource; editor: Editor }) => void) | null
    onDrop:
        | ((ctx: {
              source: DragSource
              dropPos: number
              tr: Transaction
              editor: Editor
          }) => Transaction | false | undefined)
        | null
    onDragEnd:
        | ((ctx: { source: DragSource; dropPos: number | null; committed: boolean; editor: Editor }) => void)
        | null
}

export interface DndController {
    getState(): DndState
    subscribe(listener: (state: DndState) => void): () => void
    bindHandle(element: HTMLElement): () => void
    setHoveredBlock(pos: number | null): void
    setPreviewRenderer(render: PreviewRenderer | null): void
}

export interface DndKitStorage {
    controller: DndController | null
    subscribeController(listener: () => void): () => void
}
