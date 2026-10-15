import {
    type BeforeDragStartEvent,
    DragDropManager,
    type DragEndEvent,
    Draggable,
    type DragMoveEvent,
    type DragOverEvent,
    type DropAnimationFunction,
    Droppable,
    Feedback,
    PointerActivationConstraints,
    PointerSensor,
    PreventSelection,
} from '@dnd-kit/dom'
import type { Editor } from '@tiptap/core'
import type { EditorState, PluginView, Transaction } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { buildMoveTransaction } from './commit'
import type { ResolvedConfig } from './defaults'
import { createDropAnimation } from './dom/drop-animation'
import { createDropLine, createOverlay, createProxy, placeDropLine, placeProxy } from './dom/elements'
import { blockLineRect, getRangeRect } from './dom/geometry'
import { pressedSource } from './dom/press'
import { renderDefaultPreview } from './dom/preview'
import { type Point, resolveDropPos } from './drop-position'
import { isTransactionLike } from './guards'
import { findBlockAtY, measureLayout } from './layout'
import { asTopLevelBlocks, selectionForClick, sourceForBlock, sourceFromSelection } from './sources'
import { dndKitPluginKey, getDragState, isDragActive, isNoopDrop, withDragMeta } from './state'
import type {
    DndController,
    DndKitOptions,
    DndKitStorage,
    DndState,
    DragSource,
    HoveredBlock,
    PreviewContext,
    PreviewRenderer,
} from './types'

const LANDING_MARGIN = 500

let controllerCount = 0

interface SourceData {
    dndKit: string
    kind: 'handle' | 'content'
}

export interface ControllerStorage extends DndKitStorage {
    notifyController(): void
}

export interface ControllerParams {
    view: EditorView
    editor: Editor
    options: DndKitOptions
    config: ResolvedConfig
    storage: DndKitStorage
}

export class EditorDndController implements DndController, PluginView {
    private readonly prefix = `dnd-kit-${++controllerCount}`
    private readonly editor: Editor
    private readonly options: DndKitOptions
    private readonly config: ResolvedConfig
    private readonly storage: DndKitStorage
    private readonly manager: DragDropManager
    private readonly ownsManager: boolean
    private readonly handleDraggable: Draggable
    private readonly contentDraggable: Draggable
    private readonly zone: Droppable
    private readonly proxy = createProxy()
    private readonly overlay: HTMLElement
    private readonly dropLine: HTMLElement
    private readonly dropAnimation: DropAnimationFunction
    private readonly cleanups: Array<() => void> = []
    private readonly listeners = new Set<(state: DndState) => void>()
    private view: EditorView
    private state: DndState
    private handles: HTMLElement[] = []
    private armedSource: DragSource | null = null
    private manualHover = false
    private destroyed = false
    private landingTimer: ReturnType<typeof setTimeout> | null = null
    private borrowedFeedback: { overlay: Feedback['overlay']; dropAnimation: Feedback['dropAnimation'] } | null = null
    private pressed: DragSource | null = null
    private pendingSource: DragSource | null = null
    private activeSource: DragSource | null = null
    private pendingEnd: { source: DragSource; dropPos: number | null; committed: boolean } | null = null
    private previewRenderer: PreviewRenderer | null = null
    private previewCleanup: (() => void) | null = null
    private idleTasks: Array<() => void> = []
    private idleTimer: ReturnType<typeof setTimeout> | null = null

    constructor({ view, editor, options, config, storage }: ControllerParams) {
        this.view = view
        this.editor = editor
        this.options = options
        this.config = config
        this.storage = storage
        // PreventSelection clears the DOM selection on every selectionchange while ProseMirror restores it on every drag
        // transaction, which makes the highlight blink.
        this.manager =
            options.manager ??
            new DragDropManager({ plugins: (defaults) => defaults.filter((plugin) => plugin !== PreventSelection) })
        this.ownsManager = !options.manager
        this.overlay = createOverlay(config.classes.preview)
        const renderDropLine = options.renderDropLine
        this.dropLine = createDropLine(
            config.classes.dropLine,
            renderDropLine ? () => this.safe('renderDropLine', document.createElement('div'), renderDropLine) : null,
        )
        document.body.append(this.proxy, this.overlay, this.dropLine)
        this.state = { enabled: this.computeEnabled(view), phase: 'idle', hoveredBlock: null, source: null }

        this.dropAnimation = createDropAnimation({
            getTarget: () => {
                if (this.destroyed) return null
                const { landing } = getDragState(this.view.state)
                return landing ? getRangeRect(this.view, landing) : null
            },
            isEnabled: () => this.config.features.animations,
            onFinished: () => this.finishLanding(),
            duration: options.dropAnimation.duration,
            easing: options.dropAnimation.easing,
        })

        this.handleDraggable = new Draggable(
            {
                id: `${this.prefix}-handle`,
                data: { dndKit: this.prefix, kind: 'handle' } satisfies SourceData,
                disabled: true,
                register: false,
            },
            this.manager,
        )
        this.contentDraggable = new Draggable(
            {
                id: `${this.prefix}-content`,
                register: false,
                element: this.proxy,
                data: { dndKit: this.prefix, kind: 'content' } satisfies SourceData,
                sensors: [
                    PointerSensor.configure({
                        activatorElements: [view.dom],
                        preventActivation: (event) => !this.armContent(event),
                        activationConstraints: [new PointerActivationConstraints.Distance({ value: 5 })],
                    }),
                ],
            },
            this.manager,
        )
        this.zone = new Droppable({ id: `${this.prefix}-zone`, element: view.dom, register: false }, this.manager)
        // dnd-kit's default deferred (microtask) registration would outlive a controller destroyed in the same tick —
        // React StrictMode and Tiptap do exactly that — leaving a dead sensor that captures every pointerdown.
        this.handleDraggable.register()
        this.contentDraggable.register()
        this.zone.register()

        const { monitor } = this.manager
        this.cleanups.push(
            monitor.addEventListener(
                'beforedragstart',
                this.guard('beforedragstart', (event: BeforeDragStartEvent) => this.onBeforeDragStart(event)),
            ),
            monitor.addEventListener(
                'dragstart',
                this.guard('dragstart', (event) => this.onDragStart(event.operation.source)),
            ),
            monitor.addEventListener(
                'dragmove',
                this.guard('dragmove', (event: DragMoveEvent) => this.onDragMove(event)),
            ),
            monitor.addEventListener(
                'dragover',
                this.guard('dragover', (event: DragOverEvent) => this.onDragOver(event)),
            ),
            monitor.addEventListener(
                'dragend',
                this.guard('dragend', (event: DragEndEvent) => this.onDragEnd(event)),
            ),
        )
        this.listen(view.dom.ownerDocument, 'mousemove', this.onPointerMove)
        // Capture on view.dom runs before ProseMirror's own mousedown listener on the same element.
        this.listen(view.dom, 'mousedown', this.onPressDown, true)
        this.listen(view.dom, 'click', this.onPressClick, true)
        storage.controller = this
        // ProseMirror re-creates plugin views (and so this controller) whenever plugins are reconfigured, e.g. by
        // registerPlugin, without emitting a transaction; hooks learn about the new controller only from this.
        ;(storage as ControllerStorage).notifyController?.()
    }

    getState = (): DndState => this.state

    subscribe = (listener: (state: DndState) => void): (() => void) => {
        this.listeners.add(listener)
        return () => {
            this.listeners.delete(listener)
        }
    }

    bindHandle(element: HTMLElement): () => void {
        this.handles.push(element)
        const onMouseDown = (event: MouseEvent) => event.preventDefault()
        element.addEventListener('mousedown', onMouseDown)
        this.syncHandle()
        return () => {
            element.removeEventListener('mousedown', onMouseDown)
            this.handles = this.handles.filter((handle) => handle !== element)
            this.syncHandle()
        }
    }

    setHoveredBlock(pos: number | null): void {
        this.manualHover = true
        if (this.isLocked() || !this.state.enabled) return
        if (pos === null) {
            this.setHovered(null)
            return
        }
        const node = this.view.state.doc.nodeAt(pos)
        const dom = this.view.nodeDOM(pos)
        this.setHovered(node && dom instanceof HTMLElement ? { pos, node, dom } : null)
    }

    setPreviewRenderer(render: PreviewRenderer | null): void {
        this.previewRenderer = render
    }

    update(view: EditorView, prevState: EditorState): void {
        if (this.destroyed) return
        this.view = view
        const drag = getDragState(view.state)
        const prev = getDragState(prevState)
        const enabled = this.computeEnabled(view)
        if (enabled !== this.state.enabled) this.applyEnabled(enabled)

        const wasActive = prev.source !== null || prev.landing !== null
        const isActive = drag.source !== null || drag.landing !== null
        if (wasActive && !isActive) this.onSettled(prev.landing)
        else if (view.state.doc !== prevState.doc && !this.isLocked()) this.setHovered(null)

        const phase = drag.source ? 'dragging' : drag.landing ? 'dropping' : 'idle'
        this.patch({ phase, source: phase === 'idle' ? null : this.activeSource })
        this.placeLine()
    }

    destroy(): void {
        this.destroyed = true
        if (!this.manager.dragOperation.status.idle && this.owns(this.manager.dragOperation.source)) {
            this.manager.actions.stop({ canceled: true })
        }
        if (this.idleTimer) clearTimeout(this.idleTimer)
        if (this.landingTimer) clearTimeout(this.landingTimer)
        this.idleTasks = []
        for (const cleanup of this.cleanups) cleanup()
        this.handleDraggable.destroy()
        this.contentDraggable.destroy()
        this.zone.destroy()
        this.clearPreview()
        this.releaseFeedback()
        this.proxy.remove()
        this.overlay.remove()
        this.dropLine.remove()
        if (this.ownsManager) this.manager.destroy()
        this.listeners.clear()
        if (this.storage.controller === this) {
            this.storage.controller = null
            ;(this.storage as ControllerStorage).notifyController?.()
        }
    }

    private listen<K extends keyof DocumentEventMap>(
        target: HTMLElement | Document,
        type: K,
        handler: (event: DocumentEventMap[K]) => void,
        capture = false,
    ) {
        target.addEventListener(type, handler as EventListener, capture)
        this.cleanups.push(() => target.removeEventListener(type, handler as EventListener, capture))
    }

    // Resolved per event: the hover area may only get attached to its final parent after the view is created.
    private hoverArea(): HTMLElement {
        return this.options.hoverArea?.(this.view) ?? this.view.dom.parentElement ?? this.view.dom
    }

    private computeEnabled(view: EditorView): boolean {
        return getDragState(view.state).enabled && view.editable
    }

    private owns(source: { data?: unknown } | null | undefined): boolean {
        return (source?.data as SourceData | undefined)?.dndKit === this.prefix
    }

    private isLocked(): boolean {
        return !this.manager.dragOperation.status.idle || isDragActive(this.view.state)
    }

    // dnd-kit's monitor has no try/catch: a throwing listener aborts stop() and leaves the drag running forever.
    private guard<E extends { operation: { source?: unknown } }>(label: string, listener: (event: E) => void) {
        return (event: E) => {
            try {
                listener(event)
            } catch (error) {
                console.error(`[tiptap-dnd-kit] ${label} failed`, error)
                if (label === 'dragend') this.cancelAfterError()
            }
        }
    }

    private cancelAfterError(): void {
        try {
            const { source } = getDragState(this.view.state)
            if (source)
                this.view.dispatch(
                    withDragMeta(this.view.state.tr, { type: 'end', landing: { from: source.from, to: source.to } }),
                )
        } catch (error) {
            console.error('[tiptap-dnd-kit] could not restore after a failed drop', error)
        }
    }

    private safe<T>(label: string, fallback: T, run: () => T): T {
        try {
            return run()
        } catch (error) {
            console.error(`[tiptap-dnd-kit] ${label} threw`, error)
            return fallback
        }
    }

    private patch(partial: Partial<DndState>): void {
        const next = { ...this.state, ...partial }
        const changed = (Object.keys(next) as Array<keyof DndState>).some((key) => next[key] !== this.state[key])
        if (!changed) return
        this.state = next
        for (const listener of this.listeners) listener(next)
    }

    private setHovered(block: HoveredBlock | null): void {
        const current = this.state.hoveredBlock
        if (current?.pos === block?.pos && current?.dom === block?.dom && current?.node === block?.node) return
        this.patch({ hoveredBlock: block })
        this.syncHandle()
    }

    // Feedback re-renders reactively until dnd-kit is idle: swapping the handle's element or the overlay before that
    // makes it use the editor's own block as feedback (placeholder + popover inside the editor) mid-drop.
    private afterIdle(task: () => void): void {
        if (this.destroyed) return
        if (this.manager.dragOperation.status.idle && this.idleTasks.length === 0) {
            task()
            return
        }
        if (!this.idleTasks.includes(task)) this.idleTasks.push(task)
        this.idleTimer ??= setTimeout(this.flushIdleTasks, 16)
    }

    private flushIdleTasks = () => {
        this.idleTimer = null
        if (this.destroyed) return
        if (!this.manager.dragOperation.status.idle) {
            this.idleTimer = setTimeout(this.flushIdleTasks, 16)
            return
        }
        for (const task of this.idleTasks.splice(0)) task()
    }

    private syncHandle(): void {
        this.afterIdle(this.applyHandle)
    }

    private applyHandle = () => {
        const handle = this.handles.at(-1)
        const block = this.state.hoveredBlock
        this.handleDraggable.handle = handle
        // Without a handle dnd-kit's Accessibility plugin would write role/tabindex/aria-* onto the element itself.
        this.handleDraggable.element = handle ? block?.dom : undefined
        this.handleDraggable.disabled = !this.state.enabled || !block || !handle
    }

    private applyEnabled(enabled: boolean): void {
        this.patch({ enabled })
        if (!enabled) {
            if (!this.manager.dragOperation.status.idle && this.owns(this.manager.dragOperation.source)) {
                this.manager.actions.stop({ canceled: true })
            }
            this.patch({ hoveredBlock: null })
        }
        this.syncHandle()
    }

    private onPointerMove = (event: MouseEvent) => {
        if (this.manualHover || !this.state.enabled || this.isLocked()) return
        const target = event.target instanceof Node ? event.target : null
        if (target && this.handles.some((handle) => handle.contains(target))) return
        this.setHovered(target && this.hoverArea().contains(target) ? findBlockAtY(this.view, event.clientY) : null)
    }

    private armContent(event: PointerEvent): boolean {
        const armable = this.state.enabled && !event.shiftKey
        this.armedSource = armable ? pressedSource(this.view, event, this.config.features) : null
        return this.armedSource !== null
    }

    // Every press on draggable content is swallowed, whatever its click count: a press right after a double-click is a
    // triple-click to ProseMirror, and Chrome turns a cancelled native dragstart into a fresh mouse selection.
    private onPressDown = (event: MouseEvent) => {
        this.pressed =
            event.button === 0 && !event.shiftKey && this.state.enabled
                ? pressedSource(this.view, event, this.config.features)
                : null
        if (this.pressed) event.preventDefault()
    }

    private onPressClick = (event: MouseEvent) => {
        const pressed = this.pressed
        this.pressed = null
        if (!pressed) return
        const hit = this.view.posAtCoords({ left: event.clientX, top: event.clientY })
        if (hit)
            this.view.dispatch(
                this.view.state.tr.setSelection(selectionForClick(this.view.state, pressed, hit.pos, event.detail)),
            )
    }

    private onBeforeDragStart(event: BeforeDragStartEvent): void {
        const draggable = event.operation.source
        if (!draggable || !this.owns(draggable)) return
        if (!this.state.enabled) {
            event.preventDefault()
            return
        }
        const { state } = this.view
        let source: DragSource | null = null
        if ((draggable.data as SourceData).kind === 'handle') {
            const block = this.state.hoveredBlock
            source = block ? sourceForBlock(state, block.pos) : null
        } else {
            const pressed = this.armedSource ?? sourceFromSelection(state)
            source = pressed && asTopLevelBlocks(state, pressed)
            if (source) placeProxy(this.proxy, getRangeRect(this.view, source), this.dragPoint(event.nativeEvent))
        }
        const candidate = source
        const allowed =
            candidate !== null &&
            this.safe(
                'canDrag',
                false,
                () => this.options.canDrag?.({ source: candidate, editor: this.editor }) ?? true,
            )
        if (!candidate || !allowed) {
            event.preventDefault()
            return
        }
        source = candidate

        this.pendingSource = source
        // Drop over the whole hover area (editor padding included); positions are clamped into view.dom anyway.
        this.zone.element = this.hoverArea()
        this.claimFeedback()
        this.renderPreview(source)
    }

    private onDragStart(draggable: { data?: unknown } | null | undefined): void {
        if (!this.owns(draggable)) return
        const source = this.pendingSource
        this.pendingSource = null
        if (!source) return
        this.activeSource = source
        const layout = source.kind === 'block' ? measureLayout(this.view) : null
        const gapWidth = source.kind === 'text' ? this.proxy.getBoundingClientRect().width : null
        this.view.dispatch(withDragMeta(this.view.state.tr, { type: 'start', source, layout, gapWidth }))
        this.safe('onDragStart', undefined, () => this.options.onDragStart?.({ source, editor: this.editor }))
    }

    private onDragMove(event: DragMoveEvent): void {
        if (!this.owns(event.operation.source)) return
        const { source } = getDragState(this.view.state)
        if (!source) return
        const over = event.operation.target?.id === this.zone.id
        this.setDropPos(over ? this.resolve(source, this.dragPoint(event.nativeEvent)) : null)
    }

    private onDragOver(event: DragOverEvent): void {
        if (this.owns(event.operation.source) && event.operation.target?.id !== this.zone.id) this.setDropPos(null)
    }

    private onDragEnd(event: DragEndEvent): void {
        if (!this.owns(event.operation.source)) return
        this.armedSource = null
        const { source } = getDragState(this.view.state)
        const commit = !event.canceled && event.operation.target?.id === this.zone.id && this.state.enabled
        // The last pointermove may not have produced a dragmove before pointerup, so resolve from the final event.
        if (commit && source) this.setDropPos(this.resolve(source, this.dragPoint(event.nativeEvent)))
        const { dropPos } = getDragState(this.view.state)
        // The landed content stays invisible until the drop animation reports back; never leave it hidden.
        if (this.landingTimer) clearTimeout(this.landingTimer)
        this.landingTimer = setTimeout(() => this.finishLanding(), this.options.dropAnimation.duration + LANDING_MARGIN)
        // Set before committing: a commit without a landing range settles synchronously inside its own dispatch.
        this.pendingEnd = source ? { source, dropPos, committed: false } : null
        const committed = commit && source !== null && dropPos !== null && this.commit(source, dropPos)
        if (!committed) {
            this.view.dispatch(
                withDragMeta(this.view.state.tr, {
                    type: 'end',
                    landing: source && { from: source.from, to: source.to },
                }),
            )
        }
    }

    private commit(source: DragSource, dropPos: number): boolean {
        const result = buildMoveTransaction(this.view.state, source, dropPos, {
            smartSpacing: this.config.features.smartSpacing,
        })
        if (!result) return false
        const ownSteps = result.tr.steps.length
        const replaced = this.safe<Transaction | false | undefined>('onDrop', false, () =>
            this.options.onDrop?.({ source, dropPos, tr: result.tr, editor: this.editor }),
        )
        if (replaced === false) return false
        const tr = isTransactionLike(replaced) ? replaced : result.tr
        if (tr.before !== this.view.state.doc)
            throw new Error('onDrop changed the document without returning its transaction')
        const extra = tr.mapping.slice(ownSteps)
        const landing =
            tr === result.tr ? { from: extra.map(result.landing.from, 1), to: extra.map(result.landing.to, -1) } : null
        if (this.pendingEnd) this.pendingEnd.committed = true
        this.view.dispatch(tr.setMeta(dndKitPluginKey, { type: 'end', landing }).scrollIntoView())
        this.view.focus()
        return true
    }

    private finishLanding(): void {
        if (this.destroyed || this.view.isDestroyed) return
        const { source, landing } = getDragState(this.view.state)
        if (source || !landing) return
        this.view.dispatch(withDragMeta(this.view.state.tr, { type: 'landed', landing }))
    }

    private onSettled(landing: { from: number; to: number } | null): void {
        const node = landing ? this.view.state.doc.nodeAt(landing.from) : null
        const dom = landing ? this.view.nodeDOM(landing.from) : null
        // Keep the handle on the landed block: dnd-kit restores keyboard focus to it after the drop.
        const landedTopLevel = landing && node && dom instanceof HTMLElement && dom.parentElement === this.view.dom
        this.patch({ hoveredBlock: landedTopLevel ? { pos: landing.from, node, dom } : null })
        this.syncHandle()
        this.afterIdle(this.clearPreview)
        this.afterIdle(this.releaseFeedback)
        this.activeSource = null
        const ended = this.pendingEnd
        this.pendingEnd = null
        if (ended) this.safe('onDragEnd', undefined, () => this.options.onDragEnd?.({ ...ended, editor: this.editor }))
    }

    private setDropPos(pos: number | null): void {
        if (getDragState(this.view.state).dropPos === pos) return
        this.view.dispatch(withDragMeta(this.view.state.tr, { type: 'over', pos }))
    }

    private resolve(source: DragSource, point: Point): number | null {
        const drag = getDragState(this.view.state)
        const pos = resolveDropPos(this.view, source, point, {
            layout: drag.layout,
            nestedDrop: this.config.features.nestedDrop,
            inlineGapClass: this.config.classes.inlineGap,
            currentDropPos: drag.dropPos,
        })
        if (pos === null) return null
        const allowed = this.safe(
            'canDrop',
            false,
            () => this.options.canDrop?.({ source, dropPos: pos, editor: this.editor }) ?? true,
        )
        return allowed ? pos : null
    }

    // Keyboard drags move the overlay while the "pointer" stays pinned to the activator, so follow the overlay center.
    private dragPoint(nativeEvent: Event | undefined): Point {
        const { dragOperation } = this.manager
        if (nativeEvent instanceof PointerEvent) return { x: nativeEvent.clientX, y: nativeEvent.clientY }
        if (dragOperation.activatorEvent instanceof KeyboardEvent && dragOperation.shape)
            return dragOperation.shape.current.center
        return dragOperation.position.current
    }

    private placeLine(): void {
        const { source, dropPos, layout } = getDragState(this.view.state)
        const $drop = dropPos === null ? null : this.view.state.doc.resolve(dropPos)
        const shownByShift = source?.kind === 'block' && layout !== null && $drop?.depth === 0
        const visible =
            source && $drop && !isNoopDrop(source, $drop.pos) && !$drop.parent.inlineContent && !shownByShift
        placeDropLine(this.dropLine, visible ? blockLineRect(this.view, $drop.pos) : null)
    }

    private renderPreview(source: DragSource): void {
        this.clearPreview()
        const node = this.view.state.doc.nodeAt(source.from)
        const dom = this.view.nodeDOM(source.from)
        const element = node && node.nodeSize === source.to - source.from && dom instanceof HTMLElement ? dom : null
        const ctx: PreviewContext = { source, element }
        if (this.previewRenderer) {
            const render = this.previewRenderer
            const cleanup = this.safe('previewRenderer', undefined, () => render(ctx, this.overlay))
            this.previewCleanup = typeof cleanup === 'function' ? cleanup : null
            return
        }
        const renderPreview = this.options.renderPreview
        const custom = renderPreview ? this.safe('renderPreview', null, () => renderPreview(ctx)) : null
        if (custom) this.overlay.replaceChildren(custom)
        else renderDefaultPreview(this.view, source, element, this.overlay)
    }

    private clearPreview = (): void => {
        this.previewCleanup?.()
        this.previewCleanup = null
        this.overlay.replaceChildren()
    }

    // Feedback is shared by every draggable of a shared manager: borrow it for this drag, then give the app its values back.
    private claimFeedback(): void {
        const feedback = this.manager.registry.plugins.get(Feedback)
        if (!feedback || feedback.overlay === this.overlay) return
        this.borrowedFeedback = { overlay: feedback.overlay, dropAnimation: feedback.dropAnimation }
        feedback.overlay = this.overlay
        feedback.dropAnimation = this.dropAnimation
    }

    private releaseFeedback = (): void => {
        const feedback = this.manager.registry.plugins.get(Feedback)
        if (feedback?.overlay === this.overlay) {
            feedback.overlay = this.borrowedFeedback?.overlay
            feedback.dropAnimation = this.borrowedFeedback?.dropAnimation
        }
        this.borrowedFeedback = null
    }
}
