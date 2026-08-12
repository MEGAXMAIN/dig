# Dig

Dig converts Mermaid flowcharts into editable ClickUp Whiteboard shapes. It supports steps, decisions, labeled connectors, class-based colors, phase containers (`subgraph`), Dagre auto-layout, and manual phase positioning before injection.

## Install

Dig is a static site. Host this folder on an HTTPS origin (GitHub Pages, Cloudflare Pages, Netlify, or an internal static host), open `index.html`, and drag the **Dig** button to the browser bookmarks bar.

Do not install from a `file://` URL. Browsers block HTTPS pages such as ClickUp from loading bookmarklet code from local files.

## Use

1. Open a ClickUp Whiteboard.
2. Click the Dig bookmark.
3. Paste Mermaid flowchart syntax.
4. Select **Preview** (or press Cmd/Ctrl+Enter).
5. Drag phase headers if needed.
6. Select **Inject editable shapes**.
7. If the browser blocks automatic injection, click the Whiteboard canvas and press Cmd+V or Ctrl+V. Dig has already copied the editable-shape payload.

## Source workflows

- For long transcripts, place the text in a public ClickUp Doc before asking an agent to generate Mermaid.
- Gong links may not be readable outside Gong; copy the transcript into a ClickUp Doc first.
- A structured workflow summary usually produces cleaner Mermaid than a raw transcript.

## Supported Mermaid subset

- `flowchart` and `graph`
- `TB`, `TD`, `BT`, `LR`, and `RL`
- rectangle, rounded, stadium, circle, and decision nodes
- `subgraph` phase containers
- solid and dotted connectors, including labels
- `classDef`, `class`, and `:::class` color styling
- semantic classes containing `agent`, `integration`, or `dashboard`

Sequence, class, state, ER, Gantt, and mind-map diagrams are not currently supported.

## How ClickUp injection works

ClickUp does not publish a Whiteboard-shape creation API. Dig generates an Excalidraw-compatible clipboard payload, copies it, and attempts to dispatch it to the visible Whiteboard canvas. ClickUp users have documented that copying Excalidraw content into a Whiteboard preserves shapes, arrows, and text. When a browser rejects a synthetic paste, manual Cmd/Ctrl+V uses the same payload.

This is an unofficial compatibility bridge and may require maintenance when ClickUp changes Whiteboard internals.

## Files

- `index.html` — bookmarklet install page and quick guide
- `dig.js` — ClickUp overlay, preview, phase dragging, and injection
- `dig-core.js` — Mermaid parsing, Dagre layout, and editable-shape serialization
- `tests/core.test.js` — parser and serialization smoke tests
