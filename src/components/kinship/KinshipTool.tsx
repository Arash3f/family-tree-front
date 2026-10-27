"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { labelKinshipChain } from "@/lib/auth/client";
import { AuthApiError } from "@/lib/auth/types";
import {
  describeChain,
  KINSHIP_STEPS,
  MAX_KINSHIP_STEPS,
  type KinshipLabel,
  type KinshipStep,
} from "@/lib/kinship";
import styles from "./KinshipTool.module.css";

type Result =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "done"; label: KinshipLabel }
  | { state: "error"; message: string };

/** Asks the labeller once the chain has been still for this long. */
const DEBOUNCE_MS = 250;

/**
 * Build a chain of family steps ("my father's brother's son") and see the
 * relation's name, as the app itself would name it.
 */
export function KinshipTool() {
  const t = useTranslations("kinship");
  const locale = useLocale();
  const [steps, setSteps] = useState<KinshipStep[]>([]);
  const [result, setResult] = useState<Result>({ state: "idle" });

  const words = Object.fromEntries(
    KINSHIP_STEPS.map((step) => [step, t(`steps.${step}`)]),
  ) as Record<KinshipStep, string>;

  useEffect(() => {
    if (steps.length === 0) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setResult({ state: "loading" });
      labelKinshipChain(steps, controller.signal)
        .then((label) => setResult({ state: "done", label }))
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          const tooMany = error instanceof AuthApiError && error.status === 429;
          setResult({ state: "error", message: t(tooMany ? "tooMany" : "error") });
        });
    }, DEBOUNCE_MS);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [steps, t]);

  const full = steps.length >= MAX_KINSHIP_STEPS;
  const name =
    result.state === "done"
      ? locale === "fa"
        ? result.label.label_fa
        : result.label.label_en
      : null;
  const otherName =
    result.state === "done"
      ? locale === "fa"
        ? result.label.label_en
        : result.label.label_fa
      : null;

  return (
    <section className={styles.tool} aria-labelledby="kinship-tool-title">
      <h2 id="kinship-tool-title" className={styles.heading}>
        {t("toolTitle")}
      </h2>

      <div className={styles.steps} role="group" aria-label={t("addStep")}>
        {KINSHIP_STEPS.map((step) => (
          <button
            key={step}
            type="button"
            className={styles.step}
            disabled={full}
            onClick={() => setSteps((current) => [...current, step])}
          >
            + {words[step]}
          </button>
        ))}
      </div>

      <div className={styles.chain} aria-live="polite">
        <span className={styles.chainLabel}>{t("chainLabel")}</span>
        <p className={styles.chainText}>
          {steps.length === 0 ? t("emptyChain") : describeChain(steps, words, locale, t("me"))}
        </p>
        <div className={styles.chainActions}>
          <button
            type="button"
            className={styles.link}
            disabled={steps.length === 0}
            onClick={() => {
              const next = steps.slice(0, -1);
              setSteps(next);
              if (next.length === 0) setResult({ state: "idle" });
            }}
          >
            {t("undo")}
          </button>
          <button
            type="button"
            className={styles.link}
            disabled={steps.length === 0}
            onClick={() => {
              setSteps([]);
              setResult({ state: "idle" });
            }}
          >
            {t("clear")}
          </button>
        </div>
        {full ? <p className={styles.hint}>{t("maxSteps", { count: MAX_KINSHIP_STEPS })}</p> : null}
      </div>

      <div className={styles.answer} aria-live="polite">
        {result.state === "loading" ? (
          <p className={styles.hint}>{t("loading")}</p>
        ) : result.state === "error" ? (
          <p className={styles.error} role="alert">
            {result.message}
          </p>
        ) : result.state === "done" && name ? (
          <>
            <span className={styles.answerLabel}>{t("answerLabel")}</span>
            <p className={styles.answerName}>{name}</p>
            {otherName ? (
              <p className={styles.hint}>
                {t("otherLanguage")}{" "}
                {/* Isolated, so a Persian name inside English text (or the
                    reverse) keeps its own direction and the colon stays put. */}
                <bdi lang={locale === "fa" ? "en" : "fa"}>{otherName}</bdi>
              </p>
            ) : null}
          </>
        ) : (
          <p className={styles.hint}>{t("startHint")}</p>
        )}
      </div>
    </section>
  );
}
