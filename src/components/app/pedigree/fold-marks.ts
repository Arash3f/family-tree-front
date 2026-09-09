import type { Edge, Node } from "@xyflow/react";
import type { TreeIndex } from "@/lib/pedigree/index-tree";
import type { PersonNodeData } from "@/lib/pedigree/layout";

/**
 * Stamp fold affordances onto person nodes from the live index + collapse map.
 * Offered only when the canvas actually shows a foldable line.
 */
export function withFoldMarks(
  graph: { nodes: Node[]; edges: Edge[] },
  index: TreeIndex,
  countByRoot: Map<string, number>,
): { nodes: Node[]; edges: Edge[] } {
  const nodes = graph.nodes.map((node) => {
    if (node.type !== "person") return node;
    const data = node.data as PersonNodeData;
    const hasDescendants = index.childrenByParentId.has(node.id);
    const collapsedCount = countByRoot.get(node.id) ?? 0;
    if (
      data.hasDescendants === hasDescendants &&
      data.collapsedCount === collapsedCount
    ) {
      return node;
    }
    return { ...node, data: { ...data, hasDescendants, collapsedCount } };
  });
  return { nodes, edges: graph.edges };
}
