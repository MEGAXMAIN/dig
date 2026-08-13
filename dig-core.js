(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DigCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const PALETTE = {
    step: { fill: "#EEF4FF", stroke: "#4F6BED", text: "#172B4D" },
    decision: { fill: "#F4ECFF", stroke: "#8B5CF6", text: "#35265A" },
    agent: { fill: "#E8F8F1", stroke: "#2AA876", text: "#153F31" },
    integration: { fill: "#FFF2DF", stroke: "#F59E42", text: "#593818" },
    dashboard: { fill: "#FFECEF", stroke: "#E4546B", text: "#5A1E29" },
    phase: { fill: "#F8FAFD", stroke: "#B7C2D4", text: "#344054" },
    edge: { stroke: "#667085", text: "#475467" },
  };

  const unquote = (value) => {
    const s = String(value || "").trim();
    return ((s[0] === '"' && s.at(-1) === '"') || (s[0] === "'" && s.at(-1) === "'"))
      ? s.slice(1, -1)
      : s;
  };

  const cleanLabel = (value) => unquote(value)
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();

  function stripInit(source) {
    return String(source || "").replace(/%%\{init:[\s\S]*?\}%%/gi, "");
  }

  function nodeFromToken(rawToken) {
    let token = String(rawToken || "").trim().replace(/;$/, "");
    const classMatch = token.match(/:::\s*([\w-]+)\s*$/);
    const inlineClass = classMatch ? classMatch[1] : null;
    if (classMatch) token = token.slice(0, classMatch.index).trim();
    const idMatch = token.match(/^([A-Za-z_][\w.-]*)/);
    if (!idMatch) return null;
    const id = idMatch[1];
    const rest = token.slice(id.length).trim();
    let shape = "rectangle";
    let label = id;

    if (rest.startsWith("{{") && rest.endsWith("}}")) {
      shape = "decision"; label = rest.slice(2, -2);
    } else if (rest.startsWith("{") && rest.endsWith("}")) {
      shape = "decision"; label = rest.slice(1, -1);
    } else if (rest.startsWith("((") && rest.endsWith("))")) {
      shape = "circle"; label = rest.slice(2, -2);
    } else if (rest.startsWith("([") && rest.endsWith("])")) {
      shape = "stadium"; label = rest.slice(2, -2);
    } else if (rest.startsWith("[[") && rest.endsWith("]]")) {
      shape = "subprocess"; label = rest.slice(2, -2);
    } else if (rest.startsWith("(") && rest.endsWith(")")) {
      shape = "rounded"; label = rest.slice(1, -1);
    } else if (rest.startsWith("[") && rest.endsWith("]")) {
      shape = "rectangle"; label = rest.slice(1, -1);
    } else if (rest.startsWith(">") && rest.endsWith("]")) {
      shape = "flag"; label = rest.slice(1, -1);
    } else if (rest) {
      label = rest;
    }
    return { id, label: cleanLabel(label), shape, inlineClass };
  }

  function splitEdgeLine(line) {
    const arrowRe = /(--\s+(?:"[^"]*"|'[^']*'|.*?)\s*-->|-\.\s+(?:"[^"]*"|'[^']*'|.*?)\s*\.->|-\.->|-->|==>|---)/g;
    const parts = [];
    let cursor = 0;
    let match;
    while ((match = arrowRe.exec(line))) {
      const before = line.slice(cursor, match.index).trim();
      if (before) parts.push({ kind: "node", value: before });
      const raw = match[0];
      let label = "";
      let style = "solid";
      if (raw.startsWith("-.")) style = "dashed";
      const labelMatch = raw.match(/^(?:--|-\.)\s+([\s\S]*?)\s+(?:-->|\.->)$/);
      if (labelMatch) label = cleanLabel(labelMatch[1]);
      parts.push({ kind: "edge", value: raw, label, style });
      cursor = match.index + raw.length;
    }
    const after = line.slice(cursor).trim();
    if (after) parts.push({ kind: "node", value: after });
    return parts;
  }

  function parseStyle(raw) {
    const out = {};
    String(raw || "").split(",").forEach((entry) => {
      const [key, value] = entry.split(":").map((x) => x && x.trim());
      if (!key || !value) return;
      if (key === "fill") out.fill = value;
      if (key === "stroke") out.stroke = value;
      if (key === "color") out.text = value;
      if (key === "stroke-width") out.strokeWidth = parseFloat(value) || 2;
    });
    return out;
  }

  function semanticType(node) {
    if (node.shape === "decision") return "decision";
    const classes = Array.from(node.classes || []).join(" ").toLowerCase();
    if (/agent|person|owner|actor/.test(classes)) return "agent";
    if (/integration|system|service|api|database|tool/.test(classes)) return "integration";
    if (/dashboard|report|metric|analytics/.test(classes)) return "dashboard";
    return "step";
  }

  function parseMermaid(source) {
    const text = stripInit(source).replace(/\r/g, "");
    const lines = text.split("\n");
    const graph = { direction: "TB", nodes: new Map(), edges: [], phases: new Map(), classDefs: new Map() };
    const phaseStack = [];

    const ensureNode = (candidate) => {
      if (!candidate) return null;
      const existing = graph.nodes.get(candidate.id);
      if (existing) {
        if (candidate.label !== candidate.id || !existing.label) existing.label = candidate.label;
        if (candidate.shape !== "rectangle" || !existing.shape) existing.shape = candidate.shape;
        if (candidate.inlineClass) existing.classes.add(candidate.inlineClass);
        return existing;
      }
      const node = {
        id: candidate.id,
        label: candidate.label || candidate.id,
        shape: candidate.shape || "rectangle",
        phaseId: phaseStack.at(-1) || null,
        classes: new Set(candidate.inlineClass ? [candidate.inlineClass] : []),
      };
      graph.nodes.set(node.id, node);
      return node;
    };

    lines.forEach((rawLine) => {
      let line = rawLine.trim();
      if (!line || line.startsWith("%%")) return;
      const flow = line.match(/^(?:flowchart|graph)\s+(TB|TD|BT|LR|RL)/i);
      if (flow) { graph.direction = flow[1].toUpperCase() === "TD" ? "TB" : flow[1].toUpperCase(); return; }
      const sub = line.match(/^subgraph\s+([\w.-]+)(?:\s*\[([\s\S]+)\])?$/i);
      if (sub) {
        const id = sub[1];
        graph.phases.set(id, { id, label: cleanLabel(sub[2] || id), parentId: phaseStack.at(-1) || null, direction: graph.direction });
        phaseStack.push(id);
        return;
      }
      if (/^end\s*;?$/i.test(line)) { phaseStack.pop(); return; }
      const direction = line.match(/^direction\s+(TB|TD|BT|LR|RL)/i);
      if (direction && phaseStack.length) {
        graph.phases.get(phaseStack.at(-1)).direction = direction[1].toUpperCase() === "TD" ? "TB" : direction[1].toUpperCase();
        return;
      }
      const classDef = line.match(/^classDef\s+([\w-]+)\s+(.+?);?$/i);
      if (classDef) { graph.classDefs.set(classDef[1], parseStyle(classDef[2])); return; }
      const classLine = line.match(/^class\s+([^\s]+)\s+([\w-]+)\s*;?$/i);
      if (classLine) {
        classLine[1].split(",").forEach((id) => ensureNode({ id, label: id, shape: "rectangle" }).classes.add(classLine[2]));
        return;
      }
      if (/^(?:style|linkStyle|click)\s+/i.test(line)) return;

      const parts = splitEdgeLine(line);
      if (!parts.some((part) => part.kind === "edge")) {
        ensureNode(nodeFromToken(line));
        return;
      }
      let previous = null;
      let pendingEdge = null;
      parts.forEach((part) => {
        if (part.kind === "edge") { pendingEdge = part; return; }
        const node = ensureNode(nodeFromToken(part.value));
        if (node && previous && pendingEdge) {
          graph.edges.push({
            id: `edge-${graph.edges.length + 1}`,
            from: previous.id,
            to: node.id,
            label: pendingEdge.label,
            style: pendingEdge.style,
          });
        }
        if (node) previous = node;
        pendingEdge = null;
      });
    });

    graph.nodes.forEach((node) => {
      node.type = semanticType(node);
      const iconClass = Array.from(node.classes).find((name) => /^icon-/i.test(name));
      const iconPrefix = node.id.match(/^ICON_([A-Za-z0-9-]+)_/i);
      node.icon = iconClass ? iconClass.replace(/^icon-/i, "").toLowerCase() : iconPrefix ? iconPrefix[1].toLowerCase() : null;
      const classStyles = Array.from(node.classes).map((name) => graph.classDefs.get(name)).filter(Boolean);
      node.style = Object.assign({}, PALETTE[node.type], ...classStyles);
    });
    return graph;
  }

  const textLines = (label) => String(label || "").split("\n");
  const estimateNodeSize = (node) => {
    const lines = textLines(node.label);
    const longest = Math.max(8, ...lines.map((line) => line.length));
    const width = Math.max(node.shape === "decision" ? 180 : 200, Math.min(330, longest * 8.2 + 44));
    const height = Math.max(node.shape === "decision" ? 120 : 82, lines.length * 22 + 38);
    return { width, height };
  };

  function layoutItems(items, edges, direction, nodeGap = 52, rankGap = 86) {
    const ids = new Set(items.map((item) => item.id));
    const outgoing = new Map(items.map((item) => [item.id, new Set()]));
    const indegree = new Map(items.map((item) => [item.id, 0]));
    const rank = new Map(items.map((item) => [item.id, 0]));

    edges.forEach((edge) => {
      if (!ids.has(edge.from) || !ids.has(edge.to) || edge.from === edge.to) return;
      const targets = outgoing.get(edge.from);
      if (!targets.has(edge.to)) {
        targets.add(edge.to);
        indegree.set(edge.to, indegree.get(edge.to) + 1);
      }
    });

    const queue = items.filter((item) => indegree.get(item.id) === 0).map((item) => item.id);
    const visited = new Set();
    while (queue.length) {
      const id = queue.shift();
      visited.add(id);
      outgoing.get(id).forEach((target) => {
        rank.set(target, Math.max(rank.get(target), rank.get(id) + 1));
        indegree.set(target, indegree.get(target) - 1);
        if (indegree.get(target) === 0) queue.push(target);
      });
    }

    const lastRank = Math.max(0, ...rank.values());
    items.filter((item) => !visited.has(item.id)).forEach((item) => rank.set(item.id, lastRank + 1));
    const ranks = new Map();
    items.forEach((item) => {
      const level = rank.get(item.id);
      if (!ranks.has(level)) ranks.set(level, []);
      ranks.get(level).push(item);
    });

    const horizontal = /^(LR|RL)$/i.test(direction || "TB");
    const levels = Array.from(ranks.keys()).sort((a, b) => a - b);
    const crossSizes = levels.map((level) => {
      const group = ranks.get(level);
      return group.reduce((sum, item) => sum + (horizontal ? item.height : item.width), 0) + Math.max(0, group.length - 1) * nodeGap;
    });
    const maxCross = Math.max(1, ...crossSizes);
    const placed = new Map();
    let primary = 0;
    levels.forEach((level, levelIndex) => {
      const group = ranks.get(level);
      const primarySize = Math.max(...group.map((item) => horizontal ? item.width : item.height));
      let cross = (maxCross - crossSizes[levelIndex]) / 2;
      group.forEach((item) => {
        const x = horizontal ? primary + (primarySize - item.width) / 2 : cross;
        const y = horizontal ? cross : primary + (primarySize - item.height) / 2;
        placed.set(item.id, Object.assign({}, item, { x, y }));
        cross += (horizontal ? item.height : item.width) + nodeGap;
      });
      primary += primarySize + rankGap;
    });

    let width = Math.max(1, ...Array.from(placed.values()).map((item) => item.x + item.width));
    let height = Math.max(1, ...Array.from(placed.values()).map((item) => item.y + item.height));
    if (/^RL$/i.test(direction || "")) placed.forEach((item) => { item.x = width - item.x - item.width; });
    if (/^BT$/i.test(direction || "")) placed.forEach((item) => { item.y = height - item.y - item.height; });
    return { nodes: placed, width, height };
  }

  function layoutFlat(nodes, edges, direction) {
    const sized = nodes.map((node) => Object.assign({}, node, estimateNodeSize(node)));
    return layoutItems(sized, edges, direction);
  }

  function layoutGraph(graph, _dagre, phaseOffsets) {
    const phases = new Map();
    const phaseIds = Array.from(graph.phases.keys());
    const ungroupedId = "__ungrouped__";
    const groups = new Map(phaseIds.map((id) => [id, []]));
    groups.set(ungroupedId, []);
    graph.nodes.forEach((node) => (groups.get(node.phaseId) || groups.get(ungroupedId)).push(node));

    if (!phaseIds.length) {
      const result = layoutFlat(Array.from(graph.nodes.values()), graph.edges, graph.direction);
      return { graph, nodes: result.nodes, phases, width: result.width, height: result.height, edges: graph.edges };
    }

    groups.forEach((members, phaseId) => {
      if (!members.length && phaseId === ungroupedId) return;
      const memberIds = new Set(members.map((node) => node.id));
      const internal = graph.edges.filter((edge) => memberIds.has(edge.from) && memberIds.has(edge.to));
      const phase = graph.phases.get(phaseId);
      const local = members.length ? layoutFlat(members, internal, phase?.direction || graph.direction) : { nodes: new Map(), width: 220, height: 80 };
      phases.set(phaseId, {
        id: phaseId,
        label: phase?.label || "Other",
        width: Math.max(260, local.width + 72),
        height: Math.max(150, local.height + 112),
        local,
      });
    });

    const phaseEdges = [];
    graph.edges.forEach((edge) => {
      const fromNode = graph.nodes.get(edge.from);
      const toNode = graph.nodes.get(edge.to);
      const fromPhase = fromNode?.phaseId || ungroupedId;
      const toPhase = toNode?.phaseId || ungroupedId;
      if (fromPhase !== toPhase && phases.has(fromPhase) && phases.has(toPhase)) phaseEdges.push({ from: fromPhase, to: toPhase });
    });
    const phaseLayout = layoutItems(Array.from(phases.values()), phaseEdges, graph.direction, 84, 110);

    const placedNodes = new Map();
    phases.forEach((phase) => {
      const pos = phaseLayout.nodes.get(phase.id);
      const offset = phaseOffsets?.[phase.id] || { x: 0, y: 0 };
      phase.x = pos.x + 30 + offset.x;
      phase.y = pos.y + 30 + offset.y;
      phase.local.nodes.forEach((node, id) => placedNodes.set(id, Object.assign({}, node, { x: node.x + phase.x + 36, y: node.y + phase.y + 74 })));
    });
    const xs = Array.from(phases.values()).map((p) => p.x);
    const ys = Array.from(phases.values()).map((p) => p.y);
    const rights = Array.from(phases.values()).map((p) => p.x + p.width);
    const bottoms = Array.from(phases.values()).map((p) => p.y + p.height);
    return {
      graph,
      nodes: placedNodes,
      phases,
      width: Math.max(...rights) - Math.min(...xs) + 60,
      height: Math.max(...bottoms) - Math.min(...ys) + 60,
      edges: graph.edges,
    };
  }

  function edgePoints(edge, layout) {
    const a = layout.nodes.get(edge.from);
    const b = layout.nodes.get(edge.to);
    if (!a || !b) return [];
    const ac = { x: a.x + a.width / 2, y: a.y + a.height / 2 };
    const bc = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    const horizontal = Math.abs(bc.x - ac.x) > Math.abs(bc.y - ac.y);
    if (horizontal) {
      const dir = bc.x >= ac.x ? 1 : -1;
      const start = { x: ac.x + dir * a.width / 2, y: ac.y };
      const end = { x: bc.x - dir * b.width / 2, y: bc.y };
      const midX = (start.x + end.x) / 2;
      return [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end];
    }
    const dir = bc.y >= ac.y ? 1 : -1;
    const start = { x: ac.x, y: ac.y + dir * a.height / 2 };
    const end = { x: bc.x, y: bc.y - dir * b.height / 2 };
    const midY = (start.y + end.y) / 2;
    return [start, { x: start.x, y: midY }, { x: end.x, y: midY }, end];
  }

  const hash = (value) => {
    let h = 2166136261;
    for (const ch of String(value)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return Math.abs(h) || 1;
  };
  const exId = (prefix, value) => `${prefix}_${hash(value).toString(36)}`;
  const baseElement = (id, type, x, y, width, height, index) => ({
    id, type, x, y, width, height, angle: 0,
    strokeColor: "#1e1e1e", backgroundColor: "transparent", fillStyle: "solid",
    strokeWidth: 2, strokeStyle: "solid", roughness: 0, opacity: 100,
    groupIds: [], frameId: null, index: `a${String(index).padStart(6, "0")}`,
    roundness: type === "rectangle" ? { type: 3 } : null,
    seed: hash(`${id}-seed`), version: 1, versionNonce: hash(`${id}-nonce`),
    isDeleted: false, boundElements: [], updated: Date.now(), link: null, locked: false,
  });

  function toExcalidraw(layout) {
    const elements = [];
    let index = 0;
    const push = (element) => { elements.push(element); index += 1; return element; };
    const shapeElements = new Map();

    layout.phases.forEach((phase) => {
      const id = exId("phase", phase.id);
      const rect = baseElement(id, "rectangle", phase.x, phase.y, phase.width, phase.height, index);
      rect.strokeColor = PALETTE.phase.stroke; rect.backgroundColor = PALETTE.phase.fill; rect.strokeWidth = 1;
      rect.groupIds = [exId("group", phase.id)];
      push(rect);
      const title = baseElement(exId("phase_title", phase.id), "text", phase.x + 24, phase.y + 22, phase.width - 48, 26, index);
      Object.assign(title, { strokeColor: PALETTE.phase.text, backgroundColor: "transparent", fontSize: 20, fontFamily: 2, text: phase.label, originalText: phase.label, textAlign: "left", verticalAlign: "middle", containerId: null, lineHeight: 1.25, autoResize: false, groupIds: rect.groupIds });
      push(title);
    });

    layout.nodes.forEach((node) => {
      const shapeId = exId("node", node.id);
      const textId = exId("text", node.id);
      const type = node.shape === "circle" ? "ellipse" : node.shape === "decision" ? "diamond" : "rectangle";
      const shape = baseElement(shapeId, type, node.x, node.y, node.width, node.height, index);
      shape.strokeColor = node.style.stroke; shape.backgroundColor = node.style.fill; shape.strokeWidth = node.style.strokeWidth || 2;
      shape.roundness = type === "rectangle" ? { type: node.shape === "rounded" || node.shape === "stadium" ? 3 : 3 } : null;
      shape.boundElements = [{ id: textId, type: "text" }];
      if (node.phaseId) shape.groupIds = [exId("phase_group", node.phaseId)];
      push(shape); shapeElements.set(node.id, shape);
      const lines = textLines(node.label);
      const fontSize = 18;
      const textHeight = lines.length * fontSize * 1.25;
      const text = baseElement(textId, "text", node.x + 16, node.y + (node.height - textHeight) / 2, node.width - 32, textHeight, index);
      Object.assign(text, { strokeColor: node.style.text, backgroundColor: "transparent", fontSize, fontFamily: 2, text: node.label, originalText: node.label, textAlign: "center", verticalAlign: "middle", containerId: shapeId, lineHeight: 1.25, autoResize: false, boundElements: null, roundness: null, groupIds: shape.groupIds });
      push(text);
    });

    layout.edges.forEach((edge) => {
      const points = edgePoints(edge, layout);
      if (points.length < 2) return;
      const start = points[0];
      const rel = points.map((point) => [point.x - start.x, point.y - start.y]);
      const relXs = rel.map((point) => point[0]);
      const relYs = rel.map((point) => point[1]);
      const arrowWidth = Math.max(...relXs) - Math.min(...relXs);
      const arrowHeight = Math.max(...relYs) - Math.min(...relYs);
      const arrowId = exId("arrow", edge.id);
      const arrow = baseElement(arrowId, "arrow", start.x, start.y, arrowWidth, arrowHeight, index);
      Object.assign(arrow, {
        strokeColor: PALETTE.edge.stroke, backgroundColor: "transparent", strokeWidth: 2,
        strokeStyle: edge.style === "dashed" ? "dashed" : "solid", roundness: { type: 2 },
        points: rel, lastCommittedPoint: null, startBinding: null, endBinding: null,
        startArrowhead: null, endArrowhead: "arrow", elbowed: false,
      });
      push(arrow);
      const from = shapeElements.get(edge.from); const to = shapeElements.get(edge.to);
      if (from) from.boundElements.push({ id: arrowId, type: "arrow" });
      if (to) to.boundElements.push({ id: arrowId, type: "arrow" });
      if (edge.label) {
        const mid = points[Math.floor(points.length / 2)];
        const labelWidth = Math.max(64, edge.label.length * 7 + 18);
        const label = baseElement(exId("edge_text", edge.id), "text", mid.x - labelWidth / 2, mid.y - 28, labelWidth, 22, index);
        Object.assign(label, { strokeColor: PALETTE.edge.text, backgroundColor: "#ffffff", fontSize: 14, fontFamily: 2, text: edge.label, originalText: edge.label, textAlign: "center", verticalAlign: "middle", containerId: null, lineHeight: 1.25, autoResize: false, boundElements: null, roundness: null });
        push(label);
      }
    });
    return { type: "excalidraw/clipboard", elements, files: {} };
  }

  const richText = (label) => ({
    type: "doc",
    content: String(label || "").split("\n").map((line) => line
      ? { type: "paragraph", content: [{ type: "text", text: line }] }
      : { type: "paragraph" }),
  });

  function toTldraw(layout, iconData) {
    const shapes = [];
    const bindings = [];
    const assets = [];
    const nodeShapeIds = new Map();
    const nonce = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    let sequence = 0;
    const id = (kind, value) => `${kind}:${String(value).replace(/[^A-Za-z0-9_-]/g, "_")}_${nonce}_${sequence++}`;
    const typeColors = { step: "blue", decision: "violet", agent: "green", integration: "orange", dashboard: "red" };

    layout.phases.forEach((phase) => {
      shapes.push({
        id: id("shape", `phase_${phase.id}`), type: "geo", x: phase.x, y: phase.y,
        props: { w: phase.width, h: phase.height, geo: "rectangle", color: "grey", fill: "none", dash: "dashed", size: "s", font: "sans", align: "start", verticalAlign: "start", richText: richText("") },
      });
      shapes.push({
        id: id("shape", `phase_label_${phase.id}`), type: "geo", x: phase.x + 14, y: phase.y + 12,
        props: { w: Math.min(260, Math.max(110, phase.label.length * 11 + 36)), h: 38, geo: "rectangle", color: "light-violet", fill: "semi", dash: "draw", size: "s", font: "sans", align: "middle", verticalAlign: "middle", richText: richText(phase.label) },
      });
    });

    layout.nodes.forEach((node) => {
      const shapeId = id("shape", `node_${node.id}`);
      nodeShapeIds.set(node.id, shapeId);
      const geo = node.shape === "decision" ? "diamond" : node.shape === "circle" ? "ellipse" : "rectangle";
      const hasIcon = node.icon && iconData && iconData[node.icon];
      shapes.push({
        id: shapeId, type: "geo", x: node.x, y: node.y,
        props: {
          w: node.width, h: node.height, geo, color: typeColors[node.type] || "blue", fill: "semi",
          dash: "draw", size: "m", font: "sans", align: "middle", verticalAlign: "middle",
          richText: richText(hasIcon ? `     ${node.label}` : node.label),
        },
      });
      if (hasIcon) {
        const icon = iconData[node.icon];
        const assetId = id("asset", `icon_${node.icon}`);
        const iconId = id("shape", `icon_${node.id}`);
        assets.push({
          id: assetId, typeName: "asset", type: "image",
          props: { name: `${icon.name || node.icon}.svg`, src: icon.src, w: 48, h: 48, mimeType: "image/svg+xml", isAnimated: false, fileSize: icon.size || icon.src.length },
          meta: {},
        });
        shapes.push({ id: iconId, type: "image", x: node.x + 16, y: node.y + (node.height - 42) / 2, props: { w: 42, h: 42, assetId } });
      }
    });

    layout.edges.forEach((edge) => {
      const from = layout.nodes.get(edge.from);
      const to = layout.nodes.get(edge.to);
      const fromId = nodeShapeIds.get(edge.from);
      const toId = nodeShapeIds.get(edge.to);
      if (!from || !to || !fromId || !toId) return;
      const arrowId = id("shape", `arrow_${edge.id}`);
      shapes.push({
        id: arrowId, type: "arrow", x: 0, y: 0,
        props: { color: "grey", dash: edge.style === "dashed" ? "dashed" : "draw", size: "s", arrowheadEnd: "arrow", arrowheadStart: "none", start: { x: 0, y: 0 }, end: { x: 0, y: 0 }, richText: richText(edge.label || "") },
      });
      const fc = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
      const tc = { x: to.x + to.width / 2, y: to.y + to.height / 2 };
      const horizontal = Math.abs(tc.x - fc.x) >= Math.abs(tc.y - fc.y);
      let startAnchor; let endAnchor;
      if (horizontal) {
        startAnchor = tc.x >= fc.x ? { x: 1, y: 0.5 } : { x: 0, y: 0.5 };
        endAnchor = tc.x >= fc.x ? { x: 0, y: 0.5 } : { x: 1, y: 0.5 };
      } else {
        startAnchor = tc.y >= fc.y ? { x: 0.5, y: 1 } : { x: 0.5, y: 0 };
        endAnchor = tc.y >= fc.y ? { x: 0.5, y: 0 } : { x: 0.5, y: 1 };
      }
      bindings.push({ id: id("binding", `start_${edge.id}`), type: "arrow", fromId: arrowId, toId: fromId, props: { terminal: "start", isPrecise: false, isExact: false, normalizedAnchor: startAnchor } });
      bindings.push({ id: id("binding", `end_${edge.id}`), type: "arrow", fromId: arrowId, toId, props: { terminal: "end", isPrecise: false, isExact: false, normalizedAnchor: endAnchor } });
    });
    return { shapes, bindings, assets };
  }

  return { PALETTE, parseMermaid, layoutGraph, edgePoints, toExcalidraw, toTldraw, cleanLabel };
});
