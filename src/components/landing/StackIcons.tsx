import { getTranslations } from "next-intl/server";
import {
  SiCelery,
  SiFastapi,
  SiGraphql,
  SiNeo4J,
  SiNextdotjs,
  SiPostgresql,
  SiRedis,
  SiTypescript,
} from "react-icons/si";
import { FaDocker, FaExchangeAlt } from "react-icons/fa";
import styles from "./StackIcons.module.css";

const ITEMS = [
  { key: "fastapi", Icon: SiFastapi },
  { key: "postgresql", Icon: SiPostgresql },
  { key: "neo4j", Icon: SiNeo4J },
  { key: "redis", Icon: SiRedis },
  { key: "celery", Icon: SiCelery },
  { key: "docker", Icon: FaDocker },
  { key: "nextjs", Icon: SiNextdotjs },
  { key: "typescript", Icon: SiTypescript },
  { key: "rest", Icon: FaExchangeAlt },
  { key: "graphql", Icon: SiGraphql },
] as const;

export async function StackIcons() {
  const t = await getTranslations("stack");

  return (
    <ul className={styles.grid}>
      {ITEMS.map(({ key, Icon }) => (
        <li key={key} className={styles.item}>
          <Icon className={styles.icon} aria-hidden />
          <span>{t(key)}</span>
        </li>
      ))}
    </ul>
  );
}
