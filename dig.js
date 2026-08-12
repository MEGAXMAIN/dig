(function () {
  "use strict";
  if (window.__digOpen) { window.__digOpen(); return; }

  let root;
  let currentLayout;
  let phaseOffsets = {};

  const styles = `
    #dig-root{all:initial;position:fixed;inset:0;z-index:2147483647;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#172b4d}
    #dig-root *{box-sizing:border-box}
    .sp-backdrop{position:absolute;inset:0;background:rgba(9,20,43,.52);backdrop-filter:blur(3px)}
    .sp-panel{position:absolute;inset:28px;display:grid;grid-template-rows:auto 1fr auto;max-width:1500px;margin:auto;background:#fff;border-radius:18px;box-shadow:0 30px 90px rgba(0,0,0,.32);overflow:hidden}
    .sp-head{display:flex;align-items:center;gap:14px;padding:18px 22px;border-bottom:1px solid #e5e9f0}
    .sp-brand{display:flex;align-items:center;gap:10px;font-size:20px;font-weight:750}.sp-wave{display:grid;place-items:center;width:38px;height:38px;border-radius:12px;background:#4f6bed;color:#fff;font-size:21px}
    .sp-sub{font-size:13px;color:#667085}.sp-spacer{flex:1}
    .sp-close{border:0;background:#f2f4f7;border-radius:10px;width:38px;height:38px;font-size:22px;cursor:pointer;color:#344054}
    .sp-main{display:grid;grid-template-columns:minmax(320px,38%) 1fr;min-height:0}
    .sp-input{display:flex;flex-direction:column;padding:20px;border-right:1px solid #e5e9f0;min-height:0;background:#fbfcfe}
    .sp-label{font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#667085;margin-bottom:9px}
    .sp-textarea{width:100%;flex:1;resize:none;border:1px solid #cfd6e4;border-radius:12px;padding:14px;font:13px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;color:#182230;background:#fff;outline:none;min-height:230px}
    .sp-textarea:focus{border-color:#4f6bed;box-shadow:0 0 0 3px rgba(79,107,237,.12)}
    .sp-hint{font-size:12px;line-height:1.45;color:#667085;margin-top:10px}
    .sp-preview{position:relative;overflow:auto;background-color:#f7f8fb;background-image:radial-gradient(#d8dee9 1px,transparent 1px);background-size:20px 20px}
    .sp-stage{min-width:100%;min-height:100%;padding:36px;display:grid;place-items:center}.sp-stage svg{filter:drop-shadow(0 8px 20px rgba(42,53,78,.08))}
    .sp-empty{max-width:420px;text-align:center;color:#667085;line-height:1.55}.sp-empty strong{display:block;font-size:18px;color:#344054;margin-bottom:6px}
    .sp-error{margin-top:10px;padding:10px 12px;border-radius:9px;background:#fff1f3;color:#9f1239;font-size:12px;display:none}
    .sp-foot{display:flex;gap:10px;align-items:center;padding:14px 20px;border-top:1px solid #e5e9f0;background:#fff}
    .sp-status{font-size:12px;color:#667085;flex:1}.sp-count{font-variant-numeric:tabular-nums}
    .sp-btn{appearance:none;border:0;border-radius:10px;padding:11px 16px;font-weight:700;font-size:13px;cursor:pointer}.sp-btn:disabled{opacity:.45;cursor:not-allowed}
    .sp-secondary{background:#eef1f6;color:#344054}.sp-primary{background:#4f6bed;color:#fff;box-shadow:0 4px 12px rgba(79,107,237,.25)}
    .sp-toast{position:fixed;left:50%;bottom:34px;transform:translateX(-50%);background:#12233f;color:#fff;padding:12px 18px;border-radius:10px;font:600 13px Inter,sans-serif;z-index:2147483647;box-shadow:0 10px 30px rgba(0,0,0,.3)}
    .sp-phase{cursor:grab}.sp-phase:active{cursor:grabbing}
    @media(max-width:800px){.sp-panel{inset:10px}.sp-main{grid-template-columns:1fr;grid-template-rows:42% 1fr}.sp-input{border-right:0;border-bottom:1px solid #e5e9f0}.sp-sub{display:none}}
  `;

  const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const linePath = (points) => points.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");
  const labelSvg = (node) => {
    const lines = node.label.split("\n");
    const firstY = node.y + node.height / 2 - ((lines.length - 1) * 10.5);
    return `<text x="${node.x + node.width / 2}" y="${firstY}" text-anchor="middle" dominant-baseline="middle" font-size="15" font-family="Inter,Arial,sans-serif" font-weight="600" fill="${node.style.text}">${lines.map((line, i) => `<tspan x="${node.x + node.width / 2}" dy="${i ? 21 : 0}">${esc(line)}</tspan>`).join("")}</text>`;
  };

  function renderPreview() {
    const source = root.querySelector(".sp-textarea").value.trim();
    const stage = root.querySelector(".sp-stage");
    const error = root.querySelector(".sp-error");
    if (!source) {
      stage.innerHTML = `<div class="sp-empty"><strong>Paste a Mermaid flowchart</strong>Dig will lay it out as editable Whiteboard shapes. Phases can be dragged before injection.</div>`;
      root.querySelector(".sp-primary").disabled = true;
      root.querySelector(".sp-count").textContent = "No diagram yet";
      error.style.display = "none";
      currentLayout = null; return;
    }
    try {
      const graph = window.DigCore.parseMermaid(source);
      if (!graph.nodes.size) throw new Error("No flowchart nodes were found. Start with flowchart TB or graph LR.");
      currentLayout = window.DigCore.layoutGraph(graph, null, phaseOffsets);
      const padding = 34;
      const phases = Array.from(currentLayout.phases.values()).map((phase) => `
        <g class="sp-phase" data-phase="${esc(phase.id)}">
          <rect x="${phase.x}" y="${phase.y}" width="${phase.width}" height="${phase.height}" rx="18" fill="#f8fafd" stroke="#b7c2d4" stroke-width="1.5"/>
          <text x="${phase.x + 22}" y="${phase.y + 34}" font-family="Inter,Arial,sans-serif" font-size="17" font-weight="750" fill="#344054">${esc(phase.label)}</text>
        </g>`).join("");
      const edges = currentLayout.edges.map((edge) => {
        const points = window.DigCore.edgePoints(edge, currentLayout);
        if (!points.length) return "";
        const middle = points[Math.floor(points.length / 2)];
        return `<g><path d="${linePath(points)}" fill="none" stroke="#667085" stroke-width="2" ${edge.style === "dashed" ? 'stroke-dasharray="7 6"' : ""} marker-end="url(#sp-arrow)"/>${edge.label ? `<text x="${middle.x}" y="${middle.y - 9}" text-anchor="middle" font-size="12" font-family="Inter,Arial,sans-serif" fill="#475467" paint-order="stroke" stroke="#fff" stroke-width="5">${esc(edge.label)}</text>` : ""}</g>`;
      }).join("");
      const nodes = Array.from(currentLayout.nodes.values()).map((node) => {
        let shape;
        if (node.shape === "decision") {
          shape = `<path d="M${node.x + node.width / 2},${node.y} L${node.x + node.width},${node.y + node.height / 2} L${node.x + node.width / 2},${node.y + node.height} L${node.x},${node.y + node.height / 2} Z"/>`;
        } else if (node.shape === "circle") {
          shape = `<ellipse cx="${node.x + node.width / 2}" cy="${node.y + node.height / 2}" rx="${node.width / 2}" ry="${node.height / 2}"/>`;
        } else {
          shape = `<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="${node.shape === "stadium" ? node.height / 2 : 12}"/>`;
        }
        return `<g fill="${node.style.fill}" stroke="${node.style.stroke}" stroke-width="2">${shape}</g>${labelSvg(node)}`;
      }).join("");
      const allX = [...Array.from(currentLayout.phases.values()).map((p) => p.x), ...Array.from(currentLayout.nodes.values()).map((n) => n.x)];
      const allY = [...Array.from(currentLayout.phases.values()).map((p) => p.y), ...Array.from(currentLayout.nodes.values()).map((n) => n.y)];
      const allR = [...Array.from(currentLayout.phases.values()).map((p) => p.x + p.width), ...Array.from(currentLayout.nodes.values()).map((n) => n.x + n.width)];
      const allB = [...Array.from(currentLayout.phases.values()).map((p) => p.y + p.height), ...Array.from(currentLayout.nodes.values()).map((n) => n.y + n.height)];
      const minX = Math.min(...allX) - padding, minY = Math.min(...allY) - padding;
      const width = Math.max(...allR) - minX + padding, height = Math.max(...allB) - minY + padding;
      stage.innerHTML = `<svg width="${width}" height="${height}" viewBox="${minX} ${minY} ${width} ${height}" xmlns="http://www.w3.org/2000/svg"><defs><marker id="sp-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#667085"/></marker></defs>${phases}${edges}${nodes}</svg>`;
      wirePhaseDragging(stage.querySelector("svg"));
      root.querySelector(".sp-count").textContent = `${graph.nodes.size} shapes · ${graph.edges.length} connectors · ${graph.phases.size} phases`;
      root.querySelector(".sp-primary").disabled = false;
      error.style.display = "none";
    } catch (e) {
      error.textContent = e && e.message ? e.message : String(e);
      error.style.display = "block";
      root.querySelector(".sp-primary").disabled = true;
      currentLayout = null;
    }
  }

  function wirePhaseDragging(svg) {
    let drag = null;
    svg.querySelectorAll(".sp-phase").forEach((phase) => {
      phase.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        const id = phase.dataset.phase;
        drag = { id, x: event.clientX, y: event.clientY, origin: phaseOffsets[id] || { x: 0, y: 0 } };
        phase.setPointerCapture(event.pointerId);
      });
      phase.addEventListener("pointermove", (event) => {
        if (!drag || drag.id !== phase.dataset.phase) return;
        phaseOffsets[drag.id] = { x: drag.origin.x + event.clientX - drag.x, y: drag.origin.y + event.clientY - drag.y };
      });
      phase.addEventListener("pointerup", () => { if (drag) { drag = null; renderPreview(); } });
    });
  }

  async function inject() {
    if (!currentLayout) return;
    const payload = JSON.stringify(window.DigCore.toExcalidraw(currentLayout));
    try { await navigator.clipboard.writeText(payload); }
    catch (_) {
      const temp = document.createElement("textarea"); temp.value = payload; document.body.appendChild(temp); temp.select(); document.execCommand("copy"); temp.remove();
    }
    close();
    const toast = document.createElement("div"); toast.className = "sp-toast";
    toast.textContent = "Diagram copied — click the Whiteboard and press ⌘V / Ctrl+V to add it safely.";
    document.body.appendChild(toast); setTimeout(() => toast.remove(), 8000);
  }

  function close() { if (root) { root.remove(); root = null; } }
  function open() {
    if (root) return;
    root = document.createElement("div"); root.id = "dig-root";
    root.innerHTML = `<style>${styles}</style><div class="sp-backdrop"></div><section class="sp-panel" role="dialog" aria-modal="true" aria-label="Dig Mermaid importer">
      <header class="sp-head"><div class="sp-brand"><span class="sp-wave">D</span><span>Dig</span></div><div class="sp-sub">Mermaid → editable ClickUp Whiteboard shapes</div><div class="sp-spacer"></div><button class="sp-close" title="Close" aria-label="Close">×</button></header>
      <main class="sp-main"><section class="sp-input"><div class="sp-label">Mermaid flowchart</div><textarea class="sp-textarea" spellcheck="false" placeholder="flowchart LR\n  A[Discovery call] --> B{Approved?}\n  B -- Yes --> C[Build solution]"></textarea><div class="sp-error"></div><div class="sp-hint">Supported: flowchart/graph, subgraph phases, steps, decisions, class colors, labeled connectors, and TB/LR layouts. Drag a phase header in the preview to reposition it.</div></section><section class="sp-preview"><div class="sp-stage"><div class="sp-empty"><strong>Loading Dig…</strong>Preparing the diagram engine.</div></div></section></main>
      <footer class="sp-foot"><div class="sp-status sp-count">No diagram yet</div><button class="sp-btn sp-secondary sp-reset">Reset phases</button><button class="sp-btn sp-secondary sp-preview-btn">Preview</button><button class="sp-btn sp-primary" disabled>Copy editable shapes</button></footer></section>`;
    document.body.appendChild(root);
    root.querySelector(".sp-close").addEventListener("click", close);
    root.querySelector(".sp-backdrop").addEventListener("click", close);
    root.querySelector(".sp-preview-btn").addEventListener("click", renderPreview);
    root.querySelector(".sp-reset").addEventListener("click", () => { phaseOffsets = {}; renderPreview(); });
    root.querySelector(".sp-primary").addEventListener("click", inject);
    root.querySelector(".sp-textarea").addEventListener("keydown", (event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") renderPreview(); });
    document.addEventListener("keydown", function escape(event) { if (event.key === "Escape" && root) { close(); document.removeEventListener("keydown", escape); } });
    renderPreview();
  }

  window.__digOpen = open;
  try {
    if (!window.DigCore) throw new Error("The self-contained Dig bundle is incomplete. Reinstall the bookmark and try again.");
    open();
  } catch (error) {
    alert(`Dig could not start: ${error.message}`);
  }
})();
