(function () {
  "use strict";
  if (window.__digOpen) { window.__digOpen(); return; }

  let root;
  let currentLayout;
  let phaseOffsets = {};

  const ICON_CATALOG = [
    ["openai", "OpenAI", "logos:openai-icon", "10A37F", ["chatgpt"]],
    ["claude", "Claude", "logos:claude-icon", "D97757", ["anthropic"]],
    ["servicenow", "ServiceNow", null, "81B5A1", ["service now"]],
    ["salesforce", "Salesforce", "logos:salesforce", "00A1E0"], ["slack", "Slack", "logos:slack-icon", "4A154B"],
    ["microsoft-teams", "Microsoft Teams", "logos:microsoft-teams", "6264A7", ["teams"]], ["zoom", "Zoom", "logos:zoom-icon", "2D8CFF"],
    ["google-drive", "Google Drive", "logos:google-drive", "4285F4", ["drive"]], ["gmail", "Gmail", "logos:google-gmail", "EA4335"],
    ["google-calendar", "Google Calendar", "logos:google-calendar", "4285F4", ["gcal"]], ["google-sheets", "Google Sheets", "logos:google-sheets", "34A853", ["sheets"]],
    ["google-docs", "Google Docs", "logos:google-docs", "4285F4", ["docs"]], ["google-cloud", "Google Cloud", "logos:google-cloud", "4285F4", ["gcp"]],
    ["azure", "Microsoft Azure", "logos:microsoft-azure", "0078D4"], ["aws", "AWS", "logos:aws", "FF9900", ["amazon web services"]],
    ["github", "GitHub", "logos:github-icon", "181717"], ["gitlab", "GitLab", "logos:gitlab", "FC6D26"], ["jira", "Jira", "logos:jira", "0052CC"],
    ["confluence", "Confluence", "logos:confluence", "172B4D"], ["trello", "Trello", "logos:trello", "0052CC"], ["asana", "Asana", "logos:asana", "F06A6A"],
    ["monday", "monday.com", "logos:monday-icon", "FF3D57", ["monday.com"]], ["notion", "Notion", "logos:notion-icon", "000000"],
    ["airtable", "Airtable", "logos:airtable", "18BFFF"], ["clickup", "ClickUp", "logos:clickup", "7B68EE"], ["hubspot", "HubSpot", "logos:hubspot", "FF7A59"],
    ["zendesk", "Zendesk", "logos:zendesk-icon", "03363D"], ["intercom", "Intercom", "logos:intercom-icon", "286EFA"],
    ["workday", "Workday", "thesvg-color:workday", "F68D2E"], ["okta", "Okta", "logos:okta-icon", "007DC1"], ["stripe", "Stripe", "logos:stripe", "635BFF"],
    ["shopify", "Shopify", "logos:shopify", "7AB55C"], ["docusign", "DocuSign", "thesvg-color:docusign", "FFCC22"], ["dropbox", "Dropbox", "logos:dropbox", "0061FF"],
    ["box", "Box", "logos:box", "0061D5"], ["figma", "Figma", "logos:figma", "F24E1E"], ["canva", "Canva", "logos:canva", "00C4CC"],
    ["miro", "Miro", "logos:miro-icon", "FFD02F"], ["zapier", "Zapier", "logos:zapier-icon", "FF4F00"], ["make", "Make", "logos:make", "6D00CC", ["integromat"]],
    ["snowflake", "Snowflake", "logos:snowflake-icon", "29B5E8"], ["datadog", "Datadog", "logos:datadog", "632CA6"], ["new-relic", "New Relic", "logos:new-relic-icon", "1CE783", ["new relic"]],
    ["sentry", "Sentry", "logos:sentry-icon", "362D59"], ["cloudflare", "Cloudflare", "logos:cloudflare-icon", "F38020"], ["twilio", "Twilio", "logos:twilio-icon", "F22F46"],
    ["sendgrid", "SendGrid", "logos:sendgrid-icon", "1A82E2"], ["mailchimp", "Mailchimp", "logos:mailchimp-freddie", "FFE01B"],
    ["calendly", "Calendly", "logos:calendly", "006BFF"], ["linear", "Linear", "logos:linear-icon", "5E6AD2"],
  ].map(([slug, name, source, color, aliases = []]) => ({ slug, name, source, color, aliases }));

  const normalize = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const iconBySlug = (slug) => ICON_CATALOG.find((icon) => icon.slug === slug);
  function inferIcon(node) {
    if (node.icon && iconBySlug(node.icon)) return node.icon;
    const label = normalize(node.label);
    const match = ICON_CATALOG.find((icon) => [icon.name, icon.slug, ...icon.aliases].some((alias) => {
      const target = normalize(alias);
      return label === target || (target.length > 3 && label.includes(target));
    }));
    return match ? match.slug : null;
  }

  const iconFallbackSvg = (icon) => {
    const letters = icon.name.split(/\s+/).map((word) => word[0]).join("").slice(0, 3).toUpperCase();
    return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="20" fill="#${icon.color}"/><text x="48" y="57" text-anchor="middle" font-family="Arial,sans-serif" font-size="28" font-weight="700" fill="white">${letters}</text></svg>`;
  };
  const dataSvg = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  async function loadIcon(icon) {
    let svg = iconFallbackSvg(icon);
    if (icon.source) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4500);
        const response = await fetch(`https://api.iconify.design/${icon.source}.svg`, { signal: controller.signal });
        clearTimeout(timeout);
        if (response.ok) svg = await response.text();
      } catch (_) {}
    }
    return { name: icon.name, src: dataSvg(svg), size: svg.length };
  }

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
    .sp-icon-row{display:flex;gap:8px;margin-top:10px}.sp-icon-select{min-width:0;flex:1;border:1px solid #cfd6e4;border-radius:9px;padding:8px 10px;background:#fff;color:#344054;font-size:12px}.sp-icon-add{border:0;border-radius:9px;padding:8px 11px;background:#e9edff;color:#3d51b4;font-weight:700;cursor:pointer}
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
    const centerX = node.x + node.width / 2 + (node.icon ? 18 : 0);
    return `<text x="${centerX}" y="${firstY}" text-anchor="middle" dominant-baseline="middle" font-size="15" font-family="Inter,Arial,sans-serif" font-weight="600" fill="${node.style.text}">${lines.map((line, i) => `<tspan x="${centerX}" dy="${i ? 21 : 0}">${esc(line)}</tspan>`).join("")}</text>`;
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
      graph.nodes.forEach((node) => { node.icon = inferIcon(node); });
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
        const icon = node.icon && iconBySlug(node.icon);
        const badge = icon ? `<g><rect x="${node.x + 13}" y="${node.y + node.height / 2 - 21}" width="42" height="42" rx="10" fill="#${icon.color}"/><text x="${node.x + 34}" y="${node.y + node.height / 2 + 5}" text-anchor="middle" font-size="12" font-family="Arial,sans-serif" font-weight="800" fill="white">${esc(icon.name.split(/\s+/).map((word) => word[0]).join("").slice(0, 3).toUpperCase())}</text></g>` : "";
        return `<g fill="${node.style.fill}" stroke="${node.style.stroke}" stroke-width="2">${shape}</g>${badge}${labelSvg(node)}`;
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

  function getEditor() {
    if (window.__digTlEditor) {
      try { if (typeof window.__digTlEditor.createShapes === "function") return window.__digTlEditor; } catch (_) { window.__digTlEditor = null; }
    }
    const container = document.querySelector(".tl-container");
    if (!container) throw new Error("No ClickUp Whiteboard canvas was found. Open a Whiteboard first.");
    const fiberKey = Object.keys(container).find((key) => key.startsWith("__reactFiber"));
    if (!fiberKey) throw new Error("ClickUp's Whiteboard editor could not be accessed.");
    let fiber = container[fiberKey]; let editor = null; let depth = 0;
    while (fiber && depth < 120) {
      let state = fiber.memoizedState;
      while (state) {
        const candidate = state.memoizedState;
        if (candidate && typeof candidate === "object" && typeof candidate.createShapes === "function" && typeof candidate.createBindings === "function") { editor = candidate; break; }
        state = state.next;
      }
      if (editor) break;
      fiber = fiber.return; depth += 1;
    }
    if (!editor) throw new Error("The live tldraw editor was not found. Click once on the Whiteboard canvas and try again.");
    window.__digTlEditor = editor;
    return editor;
  }

  async function inject() {
    if (!currentLayout) return;
    const button = root.querySelector(".sp-primary");
    const error = root.querySelector(".sp-error");
    button.disabled = true; button.textContent = "Injecting…";
    try {
      const editor = getEditor();
      const usedSlugs = Array.from(new Set(Array.from(currentLayout.nodes.values()).map((node) => node.icon).filter(Boolean)));
      const loaded = await Promise.all(usedSlugs.map(async (slug) => [slug, await loadIcon(iconBySlug(slug))]));
      const iconData = Object.fromEntries(loaded);
      const result = window.DigCore.toTldraw(currentLayout, iconData);
      if (result.assets.length && typeof editor.createAssets === "function") editor.createAssets(result.assets);
      const batchSize = 50;
      for (let i = 0; i < result.shapes.length; i += batchSize) editor.createShapes(result.shapes.slice(i, i + batchSize));
      for (let i = 0; i < result.bindings.length; i += batchSize) editor.createBindings(result.bindings.slice(i, i + batchSize));
      try { editor.zoomToFit(); } catch (_) {}
      close();
      const toast = document.createElement("div"); toast.className = "sp-toast";
      toast.textContent = `${result.shapes.length} native ClickUp shapes injected${result.assets.length ? ` with ${result.assets.length} SaaS icon${result.assets.length === 1 ? "" : "s"}` : ""}.`;
      document.body.appendChild(toast); setTimeout(() => toast.remove(), 6500);
    } catch (e) {
      error.textContent = e && e.message ? e.message : String(e);
      error.style.display = "block";
      button.disabled = false; button.textContent = "Inject into Whiteboard";
    }
  }

  function close() { if (root) { root.remove(); root = null; } }
  function open() {
    if (root) return;
    root = document.createElement("div"); root.id = "dig-root";
    const iconOptions = ICON_CATALOG.map((icon) => `<option value="${icon.slug}">${icon.name}</option>`).join("");
    root.innerHTML = `<style>${styles}</style><div class="sp-backdrop"></div><section class="sp-panel" role="dialog" aria-modal="true" aria-label="Dig Mermaid importer">
      <header class="sp-head"><div class="sp-brand"><span class="sp-wave">D</span><span>Dig</span></div><div class="sp-sub">Mermaid → editable ClickUp Whiteboard shapes</div><div class="sp-spacer"></div><button class="sp-close" title="Close" aria-label="Close">×</button></header>
      <main class="sp-main"><section class="sp-input"><div class="sp-label">Mermaid flowchart</div><textarea class="sp-textarea" spellcheck="false" placeholder="flowchart LR\n  A[Discovery call] --> B{Approved?}\n  B -- Yes --> C[Build solution]"></textarea><div class="sp-error"></div><div class="sp-hint">Use <strong>:::icon-openai</strong>, <strong>:::icon-claude</strong>, or any icon from the 50-app catalog. Dig also recognizes app names in labels.</div><div class="sp-icon-row"><select class="sp-icon-select" aria-label="SaaS icon catalog">${iconOptions}</select><button class="sp-icon-add" type="button">Insert icon node</button></div><div class="sp-hint">Supported: phases, steps, decisions, colors, labeled connectors, TB/LR layouts, and draggable phase positioning.</div></section><section class="sp-preview"><div class="sp-stage"><div class="sp-empty"><strong>Loading Dig…</strong>Preparing the diagram engine.</div></div></section></main>
      <footer class="sp-foot"><div class="sp-status sp-count">No diagram yet</div><button class="sp-btn sp-secondary sp-reset">Reset phases</button><button class="sp-btn sp-secondary sp-preview-btn">Preview</button><button class="sp-btn sp-primary" disabled>Inject into Whiteboard</button></footer></section>`;
    document.body.appendChild(root);
    root.querySelector(".sp-close").addEventListener("click", close);
    root.querySelector(".sp-backdrop").addEventListener("click", close);
    root.querySelector(".sp-preview-btn").addEventListener("click", renderPreview);
    root.querySelector(".sp-reset").addEventListener("click", () => { phaseOffsets = {}; renderPreview(); });
    root.querySelector(".sp-primary").addEventListener("click", inject);
    root.querySelector(".sp-icon-add").addEventListener("click", () => {
      const slug = root.querySelector(".sp-icon-select").value;
      const icon = iconBySlug(slug);
      const textarea = root.querySelector(".sp-textarea");
      const prefix = textarea.value.trim() ? "\n  " : "flowchart LR\n  ";
      textarea.value += `${prefix}ICON_${slug.replace(/-/g, "_").toUpperCase()}_${Date.now().toString(36)}[${icon.name}]:::icon-${slug}`;
      textarea.focus(); renderPreview();
    });
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
