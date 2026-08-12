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

  function layoutFlat(nodes, edges, direction, dagre) {
    const g = new dagre.graphlib.Graph({ multigraph: true });
    g.setGraph({ rankdir: direction || "TB", nodesep: 52, ranksep: 86, marginx: 0, marginy: 0 });
    g.setDefaultEdgeLabel(() => ({}));
    nodes.forEach((node) => {
      const size = estimateNodeSize(node);
      g.setNode(node.id, { width: size.width, height: size.height });
    });
    edges.forEach((edge, index) => {
      if (g.hasNode(edge.from) && g.hasNode(edge.to)) g.setEdge(edge.from, edge.to, {}, `${edge.id}-${index}`);
    });
    dagre.layout(g);
    const placed = new Map();
    nodes.forEach((node) => {
      const d = g.node(node.id);
      const size = estimateNodeSize(node);
      placed.set(node.id, Object.assign({}, node, { x: d.x - size.width / 2, y: d.y - size.height / 2, width: size.width, height: size.height }));
    });
    const meta = g.graph();
    return { nodes: placed, width: meta.width || 1, height: meta.height || 1 };
  }

  function layoutGraph(graph, dagre, phaseOffsets) {
    if (!dagre || !dagre.graphlib) throw new Error("Dagre did not load. Check your network connection and try again.");
    const phases = new Map();
    const phaseIds = Array.from(graph.phases.keys());
    const ungroupedId = "__ungrouped__";
    const groups = new Map(phaseIds.map((id) => [id, []]));
    groups.set(ungroupedId, []);
    graph.nodes.forEach((node) => (groups.get(node.phaseId) || groups.get(ungroupedId)).push(node));

    if (!phaseIds.length) {
      const result = layoutFlat(Array.from(graph.nodes.values()), graph.edges, graph.direction, dagre);
      return { graph, nodes: result.nodes, phases, width: result.width, height: result.height, edges: graph.edges };
    }

    groups.forEach((members, phaseId) => {
      if (!members.length && phaseId === ungroupedId) return;
      const memberIds = new Set(members.map((node) => node.id));
      const internal = graph.edges.filter((edge) => memberIds.has(edge.from) && memberIds.has(edge.to));
      const phase = graph.phases.get(phaseId);
      const local = members.length ? layoutFlat(members, internal, phase?.direction || graph.direction, dagre) : { nodes: new Map(), width: 220, height: 80 };
      phases.set(phaseId, {
        id: phaseId,
        label: phase?.label || "Other",
        width: Math.max(260, local.width + 72),
        height: Math.max(150, local.height + 112),
        local,
      });
    });

    const phaseGraph = new dagre.graphlib.Graph({ multigraph: true });
    phaseGraph.setGraph({ rankdir: graph.direction, nodesep: 84, ranksep: 110, marginx: 30, marginy: 30 });
    phaseGraph.setDefaultEdgeLabel(() => ({}));
    phases.forEach((phase) => phaseGraph.setNode(phase.id, { width: phase.width, height: phase.height }));
    graph.edges.forEach((edge, index) => {
      const fromNode = graph.nodes.get(edge.from);
      const toNode = graph.nodes.get(edge.to);
      const fromPhase = fromNode?.phaseId || ungroupedId;
      const toPhase = toNode?.phaseId || ungroupedId;
      if (fromPhase !== toPhase && phaseGraph.hasNode(fromPhase) && phaseGraph.hasNode(toPhase)) phaseGraph.setEdge(fromPhase, toPhase, {}, `p-${index}`);
    });
    dagre.layout(phaseGraph);

    const placedNodes = new Map();
    phases.forEach((phase) => {
      const pos = phaseGraph.node(phase.id);
      const offset = phaseOffsets?.[phase.id] || { x: 0, y: 0 };
      phase.x = pos.x - phase.width / 2 + offset.x;
      phase.y = pos.y - phase.height / 2 + offset.y;
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

  return { PALETTE, parseMermaid, layoutGraph, edgePoints, toExcalidraw, cleanLabel };
});
