export const content = `
<h2>First heading</h2>
<p>A regular paragraph. Drag it by the handle on the left — dnd-kit drives the overlay while ProseMirror moves the node with a transaction.</p>
<ul>
  <li><p>The whole list is one top-level block</p></li>
  <li><p>Second item</p></li>
</ul>
<blockquote><p>A quote is a block too.</p></blockquote>
<img src="${import.meta.env.BASE_URL}sample.svg" alt="Sample image">
<p>Another paragraph with <strong>bold</strong> and <em>italic</em> text.</p>
<pre><code>const code = 'a code block'</code></pre>
<h3>Second heading</h3>
<p>Last paragraph.</p>
<hr>
<p>Paragraph after the divider.</p>
`
