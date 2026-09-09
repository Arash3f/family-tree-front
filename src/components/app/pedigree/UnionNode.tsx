"use client";

import { memo } from "react";
import {
  Handle,
  Position,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { useLocale } from "next-intl";
import { isReachedByYear } from "@/lib/pedigree/dates";
import type { UnionNodeData } from "@/lib/pedigree/layout";
import { usePedigreeAsOfYear } from "./PedigreeSelectContext";
import styles from "./UnionNode.module.css";

type UnionFlowNode = Node<UnionNodeData, "union">;

function UnionNodeComponent({ data }: NodeProps<UnionFlowNode>) {
  const locale = useLocale();
  const asOfYear = usePedigreeAsOfYear();
  const unmarried =
    asOfYear !== null &&
    !isReachedByYear(data.marriedAt, asOfYear, locale);

  return (
    <div
      className={[
        styles.union,
        data.tone === "secondary" ? styles.secondary : "",
        data.highlighted ? styles.highlighted : "",
        data.onPath ? styles.onPath : "",
        data.onAltPath ? styles.onAltPath : "",
        data.dimmed ? styles.dimmed : "",
        unmarried ? styles.unmarried : data.divorced ? styles.divorced : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden
    >
      <Handle
        className={styles.handle}
        type="target"
        position={Position.Top}
        id="in"
      />
      <Handle
        className={styles.handle}
        type="source"
        position={Position.Bottom}
        id="out"
      />
    </div>
  );
}

export const UnionNode = memo(UnionNodeComponent);
