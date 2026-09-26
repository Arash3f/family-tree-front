"use client";

import { memo } from "react";
import {
  Handle,
  Position,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { useLocale } from "next-intl";
import { HiOutlineLockClosed } from "react-icons/hi2";
import {
  personDisplayName,
  type PersonNodeData,
} from "@/lib/pedigree/layout";
import { resolvePersonPhotoUrl } from "@/lib/media";
import { usePedigreeDataAccess } from "./PedigreeSelectContext";
import { CollapsedChip, initials, usePersonCardPress } from "./PersonNode";
import styles from "./PersonNode.module.css";
import minimal from "./MinimalPersonNode.module.css";

type PersonFlowNode = Node<PersonNodeData, "person">;

/**
 * The "minimal" tree view's person card: photo, name and family name only.
 * It fills the same box as the full card, so the layout, couples and exports
 * are unchanged — it just skips the facts, fold controls and marquee that make
 * a large tree slow to render.
 */
function MinimalPersonNodeComponent({ data }: NodeProps<PersonFlowNode>) {
  const locale = useLocale();
  const { canViewPhoto } = usePedigreeDataAccess();
  const {
    person,
    selected,
    highlighted,
    onPath,
    onAltPath,
    dimmed,
    inCouple,
    collapsedCount = 0,
  } = data;
  const press = usePersonCardPress(person.id);
  const photoSrc = canViewPhoto
    ? resolvePersonPhotoUrl(person.photo_url, person.photo_object_key)
    : null;
  const familyName = person.family_name?.trim();

  return (
    <div
      role="button"
      tabIndex={0}
      className={[
        styles.node,
        minimal.card,
        styles[person.gender],
        inCouple ? styles.inCouple : "",
        selected ? styles.selected : "",
        highlighted ? styles.highlighted : "",
        onPath ? styles.onPath : "",
        onAltPath ? styles.onAltPath : "",
        dimmed ? styles.dimmed : "",
        collapsedCount > 0 ? styles.collapsed : "",
        person.death_date ? styles.deceased : "",
      ]
        .filter(Boolean)
        .join(" ")}
      {...press}
      aria-pressed={selected}
      aria-label={personDisplayName(person)}
      dir={locale === "fa" ? "rtl" : "ltr"}
    >
      <Handle className={styles.handle} type="target" position={Position.Top} id="parent" />
      <Handle className={styles.handle} type="target" position={Position.Left} id="spouse-in" />
      <Handle className={styles.handle} type="source" position={Position.Right} id="spouse-out" />

      <span className={`${styles.avatar} ${minimal.avatar}`} aria-hidden>
        {!canViewPhoto ? (
          <HiOutlineLockClosed className={styles.avatarLock} />
        ) : photoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoSrc}
            alt=""
            className={styles.photo}
            loading="lazy"
            decoding="async"
          />
        ) : (
          initials(person.name)
        )}
      </span>
      <span className={minimal.name} title={person.name}>
        {person.name}
      </span>
      {familyName ? (
        <span className={minimal.familyName} title={familyName}>
          {familyName}
        </span>
      ) : null}

      {collapsedCount > 0 ? (
        <div className={`${styles.foldBar} ${styles.foldBarPinned} nodrag nopan`}>
          <CollapsedChip personId={person.id} count={collapsedCount} />
        </div>
      ) : null}

      <Handle className={styles.handle} type="source" position={Position.Bottom} id="child" />
    </div>
  );
}

export const MinimalPersonNode = memo(MinimalPersonNodeComponent);
