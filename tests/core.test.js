const assert = require("node:assert/strict");
const { parseMermaid, cleanLabel } = require("../dig-core.js");

const sample = `
flowchart LR
  subgraph P1["Discovery"]
    A["Capture notes<br/>and goals"]:::agent
    B{"Approved?"}
    A -- "review" --> B
  end
  subgraph P2["Delivery"]
    C["Build"]
  end
  B -- yes --> C
  classDef agent fill:#e8f8f1,stroke:#2aa876,color:#153f31;
`;

const graph = parseMermaid(sample);
assert.equal(graph.direction, "LR");
assert.equal(graph.nodes.size, 3);
assert.equal(graph.edges.length, 2);
assert.equal(graph.phases.size, 2);
assert.equal(graph.nodes.get("A").label, "Capture notes\nand goals");
assert.equal(graph.nodes.get("A").type, "agent");
assert.equal(graph.nodes.get("B").shape, "decision");
assert.equal(graph.edges[0].label, "review");
assert.equal(graph.edges[1].label, "yes");
assert.equal(cleanLabel('"Hello<br/>world"'), "Hello\nworld");

const chain = parseMermaid("flowchart TB\n A[One] --> B[Two] --> C[Three]");
assert.equal(chain.nodes.size, 3);
assert.equal(chain.edges.length, 2);

console.log("Dig core tests passed");
