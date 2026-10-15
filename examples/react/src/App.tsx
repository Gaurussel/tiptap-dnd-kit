import { DemoEditor } from './DemoEditor'

const editorIds = new URLSearchParams(location.search).get('editors') === '2' ? ['editor-1', 'editor-2'] : ['editor-1']

export function App() {
    return (
        <main className="page">
            <h1 className="page-title">tiptap-dnd-kit</h1>
            <p className="page-hint">
                Drag blocks by the handle on the left; selections and images drag right in the text. Esc or a drop
                outside the editor cancels.
            </p>
            {editorIds.map((id) => (
                <DemoEditor key={id} testId={id} />
            ))}
        </main>
    )
}
