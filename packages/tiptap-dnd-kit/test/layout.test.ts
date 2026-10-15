import { computeShifts, indexToPos } from '../src/core/layout'
import type { DragLayout } from '../src/core/types'
import { stateFromHTML } from './helpers'

const layout: DragLayout = {
    blocks: [
        { top: 0, height: 20 },
        { top: 30, height: 40 },
        { top: 80, height: 20 },
        { top: 110, height: 20 },
    ],
    end: 140,
}

test('moving a block down shifts the blocks in between up by its stride', () => {
    const shifts = computeShifts(layout, 1, 2, 4)
    expect(shifts.get(2)).toBe(-50)
    expect(shifts.get(3)).toBe(-50)
    expect(shifts.get(1)).toBe(140 - 80)
})

test('moving a block up shifts the blocks in between down by its stride', () => {
    const shifts = computeShifts(layout, 2, 3, 0)
    expect(shifts.get(0)).toBe(30)
    expect(shifts.get(1)).toBe(30)
    expect(shifts.get(2)).toBe(-80)
})

test('a multi-block source moves as one unit', () => {
    const shifts = computeShifts(layout, 0, 2, 4)
    expect(shifts.get(2)).toBe(-80)
    expect(shifts.get(3)).toBe(-80)
    expect(shifts.get(0)).toBe(140 - 80)
    expect(shifts.get(1)).toBe(140 - 80)
})

test('dropping right before or after the source shifts nothing', () => {
    expect(computeShifts(layout, 1, 2, 1).size).toBe(0)
    expect(computeShifts(layout, 1, 2, 2).size).toBe(0)
})

test('indexToPos sums top-level node sizes', () => {
    const state = stateFromHTML('<p>ab</p><p>cd</p><p>ef</p>')
    expect(indexToPos(state.doc, 0)).toBe(0)
    expect(indexToPos(state.doc, 2)).toBe(8)
})
