"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  HiArrowLeft,
  HiArrowRight,
  HiMagnifyingGlass,
  HiOutlineArrowUpRight,
  HiOutlineLockClosed,
  HiOutlineMapPin,
  HiOutlineUsers,
  HiXMark,
} from "react-icons/hi2";
import { Link } from "@/i18n/navigation";
import { Alert, Badge } from "@/components/ui/Feedback";
import { DocumentPortal } from "@/components/ui/DocumentPortal";
import { useFocusTrap, useScrollLock } from "@/components/ui/useFocusTrap";
import { getPersonCard } from "@/lib/auth/client";
import type {
  PersonCard,
  PersonCardSummary,
  Person,
} from "@/lib/auth/types";
import { formatLocaleDigits } from "@/lib/localeDigits";
import { resolvePersonPhotoUrl } from "@/lib/media";
import { ageInYearsAtYear, formatDateForLocale } from "@/lib/pedigree/dates";
import { namedGenerationKey } from "@/lib/pedigree/descendants";
import { buildTreeIndex } from "@/lib/pedigree/index-tree";
import { personDisplayName } from "@/lib/pedigree/layout";
import { usePedigreePermissions } from "./usePedigreePermissions";
import { useTreeData, type TreeSource } from "./useTreeData";
import styles from "./ProfileExplorerView.module.css";

/** How many search hits to render at once — enough to scan, cheap to paint. */
const MAX_RESULTS = 48;
/** Visited people kept in the "recent" rail on the search screen. */
const MAX_RECENT = 12;

type Props = {
  treeId: string;
  /** `"demo"` reads the publicly published tree; see {@link useTreeData}. */
  treeSource?: TreeSource;
};

/** A person as the explorer needs it for a chip or hero, from either source. */
type DisplayPerson = {
  id: string;
  name: string;
  family_name: string | null;
  gender: "male" | "female";
  birth_date: string | null;
  death_date: string | null;
  photo_url: string | null;
};

function summaryToDisplay(
  s: PersonCardSummary | Person,
): DisplayPerson {
  return {
    id: s.id,
    name: s.name,
    family_name: s.family_name,
    gender: s.gender,
    birth_date: s.birth_date,
    death_date: s.death_date,
    photo_url: s.photo_url,
  };
}

/**
 * The third tree view: not a canvas. A search box finds a person by name and
 * opens them as a full profile, and every relative on that profile is a link
 * that walks to the next person. A back/forward trail remembers the path so
 * browsing the family feels like moving through linked pages.
 */
export function ProfileExplorerView({ treeId, treeSource = "member" }: Props) {
  const t = useTranslations("pedigree");
  const tTrees = useTranslations("trees");
  const locale = useLocale();

  const onLoaded = useCallback(() => {}, []);
  const tree = useTreeData(treeId, onLoaded, treeSource);
  const { persons, marriages, loading } = tree;
  const apiTreeId = tree.treeMeta?.id ?? treeId;
  const permissions = usePedigreePermissions(tree.hasTreeAccess);

  /**
   * Where the visitor is in their own path through the family.
   *
   * `trail` is the people they have opened, in order, and `pos` points at the
   * one on screen — `-1` being the search page, which is why going back from
   * the first person lands there. Both live in one state so opening someone is
   * a single atomic update: a stale `pos` against a new `trail` would truncate
   * the path or point past its end.
   */
  const [nav, setNav] = useState<{ trail: string[]; pos: number }>({
    trail: [],
    pos: -1,
  });
  const { trail, pos } = nav;
  const currentId = pos >= 0 ? (trail[pos] ?? null) : null;

  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [personCard, setPersonCard] = useState<PersonCard | null>(null);
  const [cardSettledForId, setCardSettledForId] = useState<string | null>(null);

  const index = useMemo(
    () => buildTreeIndex(persons, marriages),
    [persons, marriages],
  );
  const personById = index.personById;

  /** parentId -> their children, built once per data load (siblings + kids). */
  const childrenByParent = useMemo(() => {
    const map = new Map<string, Person[]>();
    for (const person of persons) {
      for (const link of person.parents) {
        const list = map.get(link.parent_id);
        if (list) list.push(person);
        else map.set(link.parent_id, [person]);
      }
    }
    return map;
  }, [persons]);

  /**
   * Open a person, forking the trail at the current position — so stepping
   * back and walking a different way discards the path that was ahead, the way
   * browser history does.
   */
  const openPerson = useCallback((id: string) => {
    setNav(({ trail: prev, pos: at }) => {
      const base = prev.slice(0, at + 1);
      // Re-opening whoever is already on screen is a no-op, not a repeat entry.
      if (base[base.length - 1] === id) {
        return { trail: base, pos: base.length - 1 };
      }
      return { trail: [...base, id], pos: base.length };
    });
  }, []);

  const canBack = pos > -1;
  const canForward = pos < trail.length - 1;

  const goBack = useCallback(
    () => setNav((n) => ({ ...n, pos: Math.max(-1, n.pos - 1) })),
    [],
  );
  const goForward = useCallback(
    () =>
      setNav((n) => ({ ...n, pos: Math.min(n.trail.length - 1, n.pos + 1) })),
    [],
  );
  const jumpTo = useCallback(
    (at: number) => setNav((n) => ({ ...n, pos: at })),
    [],
  );
  const goSearch = useCallback(() => {
    setNav((n) => ({ ...n, pos: -1 }));
    // Focus after the search screen mounts.
    requestAnimationFrame(() => searchInputRef.current?.focus());
  }, []);

  // Load the detail card for the open person; ignore a stale response.
  useEffect(() => {
    if (!currentId || !apiTreeId) return;
    const controller = new AbortController();
    let cancelled = false;
    const requestId = currentId;
    // No need to reset `cardSettledForId` here: it still names the previous
    // person, so `cardLoading` below already reads as loading.
    void getPersonCard(apiTreeId, requestId, controller.signal)
      .then((card) => {
        if (cancelled) return;
        setPersonCard(card);
        setCardSettledForId(requestId);
      })
      .catch(() => {
        if (cancelled) return;
        setCardSettledForId(requestId);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [currentId, apiTreeId]);

  // Keyboard: Alt+← / Alt+→ walk the trail, "/" jumps to the search box.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (event.altKey && event.key === "ArrowLeft") {
        event.preventDefault();
        goBack();
      } else if (event.altKey && event.key === "ArrowRight") {
        event.preventDefault();
        goForward();
      } else if (event.key === "/" && !typing) {
        event.preventDefault();
        goSearch();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goBack, goForward, goSearch]);

  const results = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return [];
    const hits: Person[] = [];
    for (const person of persons) {
      const hay = `${person.name} ${person.family_name ?? ""}`.toLowerCase();
      if (hay.includes(q)) {
        hits.push(person);
        if (hits.length >= MAX_RESULTS) break;
      }
    }
    return hits.sort((a, b) =>
      personDisplayName(a).localeCompare(personDisplayName(b), locale),
    );
  }, [deferredQuery, persons, locale]);

  const recent = useMemo(() => {
    const seen = new Set<string>();
    const out: Person[] = [];
    for (let i = trail.length - 1; i >= 0 && out.length < MAX_RECENT; i -= 1) {
      const id = trail[i];
      if (seen.has(id)) continue;
      seen.add(id);
      const person = personById.get(id);
      if (person) out.push(person);
    }
    return out;
  }, [trail, personById]);

  const cardLoading = Boolean(currentId) && cardSettledForId !== currentId;
  const activeCard =
    personCard && currentId && personCard.person.id === currentId
      ? personCard
      : null;

  if (loading) {
    return (
      <section className={styles.root}>
        <div className={styles.center} role="status" aria-busy="true">
          <span className={styles.spinner} aria-hidden />
          <p>{t("loading")}</p>
        </div>
      </section>
    );
  }

  if (tree.loadError && !tree.treeName) {
    return (
      <section className={styles.root}>
        <Alert tone="error">{tree.loadError}</Alert>
        <Link href="/dashboard/trees">{tTrees("back")}</Link>
      </section>
    );
  }

  if (!permissions.canReadPersons) {
    return (
      <section className={styles.root}>
        <Alert tone="error">{t("needPersonRead")}</Alert>
      </section>
    );
  }

  return (
    <section className={styles.root}>
      <nav className={styles.topbar} aria-label={t("explorer.navLabel")}>
        <div className={styles.navButtons}>
          <button
            type="button"
            className={`${styles.navBtn} ${styles.navArrow}`}
            onClick={goBack}
            disabled={!canBack}
            aria-label={t("explorer.back")}
            title={t("explorer.back")}
          >
            <HiArrowLeft aria-hidden />
          </button>
          <button
            type="button"
            className={`${styles.navBtn} ${styles.navArrow}`}
            onClick={goForward}
            disabled={!canForward}
            aria-label={t("explorer.forward")}
            title={t("explorer.forward")}
          >
            <HiArrowRight aria-hidden />
          </button>
          <button
            type="button"
            className={`${styles.navBtn} ${styles.searchToggle} ${
              pos === -1 ? styles.searchToggleActive : ""
            }`}
            onClick={goSearch}
            aria-label={t("explorer.openSearch")}
            title={t("explorer.openSearch")}
          >
            <HiMagnifyingGlass aria-hidden />
          </button>
        </div>

        <div className={styles.treeMeta}>
          <span className={styles.treeName}>{tree.treeName}</span>
          <span className={styles.treeCount}>
            {t("statPeople", {
              count: formatLocaleDigits(persons.length, locale),
            })}
          </span>
        </div>

        <div className={styles.trail} aria-label={t("explorer.trailLabel")}>
          {trail.map((id, i) => {
            const person = personById.get(id);
            if (!person) return null;
            return (
              <button
                key={`${id}-${i}`}
                type="button"
                className={`${styles.trailChip} ${
                  i === pos ? styles.trailChipActive : ""
                }`}
                onClick={() => jumpTo(i)}
                title={personDisplayName(person)}
              >
                {personDisplayName(person)}
              </button>
            );
          })}
        </div>
      </nav>

      {pos === -1 ? (
        <SearchScreen
          query={query}
          onQueryChange={setQuery}
          results={results}
          recent={recent}
          hasQuery={deferredQuery.trim().length > 0}
          inputRef={searchInputRef}
          canViewPhoto={permissions.canViewPhoto}
          onOpen={openPerson}
          personById={personById}
          childrenByParent={childrenByParent}
          locale={locale}
          t={t}
        />
      ) : (
        <ProfileScreen
          key={currentId ?? "none"}
          card={activeCard}
          fallback={currentId ? (personById.get(currentId) ?? null) : null}
          loading={cardLoading}
          canViewPhoto={permissions.canViewPhoto}
          canViewBirthDate={permissions.canViewBirthDate}
          canViewMarriageDate={permissions.canViewMarriageDate}
          canReadMarriages={permissions.canReadMarriages}
          childrenByParent={childrenByParent}
          personById={personById}
          onOpen={openPerson}
          locale={locale}
          t={t}
        />
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ search */

type Translate = ReturnType<typeof useTranslations>;

function SearchScreen({
  query,
  onQueryChange,
  results,
  recent,
  hasQuery,
  inputRef,
  canViewPhoto,
  onOpen,
  personById,
  childrenByParent,
  locale,
  t,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  results: Person[];
  recent: Person[];
  hasQuery: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  canViewPhoto: boolean;
  onOpen: (id: string) => void;
  personById: Map<string, Person>;
  childrenByParent: Map<string, Person[]>;
  locale: string;
  t: Translate;
}) {
  const parentHint = useCallback(
    (person: Person) => {
      const names: string[] = [];
      for (const link of person.parents) {
        const parent = personById.get(link.parent_id);
        if (parent) names.push(personDisplayName(parent));
        if (names.length === 2) break;
      }
      if (names.length === 0) return null;
      return t("explorer.childOf", { names: names.join(" · ") });
    },
    [personById, t],
  );

  return (
    <div className={styles.searchScreen}>
      <div className={styles.searchHero}>
        <h1 className={styles.searchTitle}>{t("explorer.searchTitle")}</h1>
        <p className={styles.searchSub}>{t("explorer.searchSubtitle")}</p>
        <div className={styles.searchBox}>
          <HiMagnifyingGlass aria-hidden className={styles.searchBoxIcon} />
          <input
            ref={inputRef}
            type="search"
            className={styles.searchInput}
            value={query}
            placeholder={t("searchPlaceholder")}
            onChange={(event) => onQueryChange(event.target.value)}
            autoFocus
            aria-label={t("searchPlaceholder")}
          />
          {query ? (
            <button
              type="button"
              className={styles.searchClear}
              onClick={() => onQueryChange("")}
              aria-label={t("close")}
            >
              <HiXMark aria-hidden />
            </button>
          ) : null}
        </div>
      </div>

      {hasQuery ? (
        results.length > 0 ? (
          <ul className={styles.resultGrid}>
            {results.map((person) => (
              <li key={person.id}>
                <PersonCardButton
                  person={summaryToDisplay(person)}
                  hint={parentHint(person)}
                  childCount={childrenByParent.get(person.id)?.length ?? 0}
                  canViewPhoto={canViewPhoto}
                  onClick={() => onOpen(person.id)}
                  locale={locale}
                  t={t}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.noResults}>{t("explorer.noResults")}</p>
        )
      ) : recent.length > 0 ? (
        <div className={styles.recentBlock}>
          <h2 className={styles.sectionLabel}>{t("explorer.recent")}</h2>
          <ul className={styles.resultGrid}>
            {recent.map((person) => (
              <li key={person.id}>
                <PersonCardButton
                  person={summaryToDisplay(person)}
                  hint={parentHint(person)}
                  childCount={childrenByParent.get(person.id)?.length ?? 0}
                  canViewPhoto={canViewPhoto}
                  onClick={() => onOpen(person.id)}
                  locale={locale}
                  t={t}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className={styles.searchPrompt}>{t("explorer.typeToStart")}</p>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- profile */

function ProfileScreen({
  card,
  fallback,
  loading,
  canViewPhoto,
  canViewBirthDate,
  canViewMarriageDate,
  canReadMarriages,
  childrenByParent,
  personById,
  onOpen,
  locale,
  t,
}: {
  card: PersonCard | null;
  fallback: Person | null;
  loading: boolean;
  canViewPhoto: boolean;
  canViewBirthDate: boolean;
  canViewMarriageDate: boolean;
  canReadMarriages: boolean;
  childrenByParent: Map<string, Person[]>;
  personById: Map<string, Person>;
  onOpen: (id: string) => void;
  locale: string;
  t: Translate;
}) {
  const hero: DisplayPerson | null = card
    ? summaryToDisplay(card.person)
    : fallback
      ? summaryToDisplay(fallback)
      : null;

  const [photoOpen, setPhotoOpen] = useState(false);
  const photoTitleId = useId();
  const photoDialogRef = useRef<HTMLDivElement>(null);
  const closePhoto = useCallback(() => setPhotoOpen(false), []);
  useFocusTrap(photoDialogRef, photoOpen, closePhoto);
  useScrollLock(photoOpen);

  // The caller keys this component by person id, so switching people remounts
  // it: the scroll position and the lightbox reset on their own.

  if (!hero) {
    return (
      <div className={styles.center}>
        <span className={styles.spinner} aria-hidden />
      </div>
    );
  }

  const photoUrl = resolvePersonPhotoUrl(hero.photo_url);
  const age = ageInYearsAtYear(hero.birth_date, hero.death_date, null, locale);
  /** Full record for the fields a summary does not carry (notes, places). */
  const detail: Person | null = card?.person ?? fallback;

  // Parents: from the card when loaded, else the raw person links.
  const parentPeople: DisplayPerson[] = card
    ? card.parents
        .map((link) => (link.person ? summaryToDisplay(link.person) : null))
        .filter((p): p is DisplayPerson => p !== null)
    : (fallback?.parents ?? [])
        .map((link) => personById.get(link.parent_id))
        .filter((p): p is Person => Boolean(p))
        .map(summaryToDisplay);

  const spouses = card && canReadMarriages ? card.marriages : [];

  const children: DisplayPerson[] = (() => {
    const gen1 = card?.descendants.generations.find((g) => g.generation === 1);
    if (gen1) return gen1.people.map(summaryToDisplay);
    return (childrenByParent.get(hero.id) ?? []).map(summaryToDisplay);
  })();

  // Siblings: other children of this person's parents.
  const siblings: DisplayPerson[] = (() => {
    const parentIds = card
      ? card.parents.map((l) => l.parent_id)
      : (fallback?.parents ?? []).map((l) => l.parent_id);
    if (parentIds.length === 0) return [];
    const seen = new Set<string>([hero.id]);
    const out: DisplayPerson[] = [];
    for (const parentId of parentIds) {
      for (const child of childrenByParent.get(parentId) ?? []) {
        if (seen.has(child.id)) continue;
        seen.add(child.id);
        out.push(summaryToDisplay(child));
      }
    }
    return out;
  })();

  const descendantTotal = card?.descendants.total.total ?? 0;
  const descendantSummary =
    card && descendantTotal > 0
      ? card.descendants.generations
          .map((row) => {
            const key = namedGenerationKey(row.generation);
            const count = formatLocaleDigits(row.total, locale);
            return key === "n"
              ? t("generationShort.n", {
                  count,
                  n: formatLocaleDigits(row.generation, locale),
                })
              : t(`generationShort.${key}`, { count });
          })
          .join(" · ")
      : null;

  return (
    <div className={styles.profileScreen}>
      <article className={styles.profileCard}>
        <header className={`${styles.hero} ${styles[hero.gender]}`}>
          {canViewPhoto && photoUrl ? (
            <button
              type="button"
              className={`${styles.heroAvatar} ${styles.heroAvatarButton}`}
              onClick={() => setPhotoOpen(true)}
              aria-label={t("photoEnlarge")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl} alt="" loading="lazy" decoding="async" />
            </button>
          ) : (
            <span className={styles.heroAvatar} aria-hidden>
              {canViewPhoto ? (
                hero.name.slice(0, 1).toUpperCase()
              ) : (
                <HiOutlineLockClosed />
              )}
            </span>
          )}
          <div className={styles.heroText}>
            <h1 className={styles.heroName}>
              {personDisplayName(hero)}
              {hero.death_date ? (
                <Badge>{t("vital.deceased")}</Badge>
              ) : (
                <Badge tone="accent">{t("vital.alive")}</Badge>
              )}
            </h1>
            <div className={styles.heroFacts}>
              <span className={styles.heroFact}>{t(`gender.${hero.gender}`)}</span>
              {canViewBirthDate && hero.birth_date ? (
                <span className={styles.heroFact}>
                  {t("born")}:{" "}
                  {formatLocaleDigits(
                    formatDateForLocale(hero.birth_date, locale),
                    locale,
                  )}
                </span>
              ) : !canViewBirthDate ? (
                <span className={styles.heroFact} title={t("noAccessHint")}>
                  {t("born")}: <HiOutlineLockClosed aria-hidden />
                </span>
              ) : null}
              {canViewBirthDate && hero.death_date ? (
                <span className={styles.heroFact}>
                  {t("fields.deathDate")}:{" "}
                  {formatLocaleDigits(
                    formatDateForLocale(hero.death_date, locale),
                    locale,
                  )}
                </span>
              ) : null}
              {age !== null ? (
                <span className={styles.heroFact}>
                  {t("ageYears", { count: formatLocaleDigits(age, locale) })}
                </span>
              ) : null}
            </div>
            {detail?.birth_place || detail?.death_place ? (
              <div className={styles.heroPlaces}>
                {detail.birth_place ? (
                  <span className={styles.heroFact}>
                    <HiOutlineMapPin aria-hidden /> {t("fields.birthPlace")}:{" "}
                    {detail.birth_place}
                  </span>
                ) : null}
                {detail.death_place ? (
                  <span className={styles.heroFact}>
                    <HiOutlineMapPin aria-hidden /> {t("fields.deathPlace")}:{" "}
                    {detail.death_place}
                  </span>
                ) : null}
              </div>
            ) : null}
            {descendantSummary ? (
              <p className={styles.heroDescendants}>
                <HiOutlineUsers aria-hidden /> {descendantSummary}
              </p>
            ) : null}
          </div>
        </header>

        {loading && !card ? (
          <div className={styles.cardLoadingRow}>
            <span className={styles.spinner} aria-hidden />
            <span>{t("cardLoading")}</span>
          </div>
        ) : null}

        {detail?.notes ? <p className={styles.notes}>{detail.notes}</p> : null}

        <div className={styles.relGrid}>
          <RelationColumn
            title={t("fields.parents")}
            people={parentPeople}
            empty={t("explorer.noParents")}
            canViewPhoto={canViewPhoto}
            onOpen={onOpen}
            locale={locale}
          />
          <RelationColumn
            title={t("marriagesTitle")}
            people={spouses
              .map((m) => (m.spouse ? summaryToDisplay(m.spouse) : null))
              .filter((p): p is DisplayPerson => p !== null)}
            badges={spouses.map((m) =>
              m.spouse
                ? m.divorced_at
                  ? t("divorced")
                  : t("spouseActive")
                : null,
            )}
            empty={t("explorer.noSpouses")}
            canViewPhoto={canViewPhoto}
            onOpen={onOpen}
            locale={locale}
          />
          <RelationColumn
            title={t("fields.children")}
            people={children}
            empty={t("explorer.noChildren")}
            canViewPhoto={canViewPhoto}
            onOpen={onOpen}
            locale={locale}
          />
          {siblings.length > 0 ? (
            <RelationColumn
              title={t("explorer.siblings")}
              people={siblings}
              canViewPhoto={canViewPhoto}
              onOpen={onOpen}
              locale={locale}
            />
          ) : null}
        </div>

        {canViewMarriageDate && spouses.length > 0 ? (
          <section className={styles.block}>
            <h3 className={styles.sectionLabel}>{t("explorer.marriageDates")}</h3>
            <ul className={styles.dateList}>
              {spouses.map((m) => (
                <li key={m.id}>
                  <span>
                    {m.spouse ? personDisplayName(m.spouse) : "—"}
                  </span>
                  <span className={styles.dateValue}>
                    {m.married_at
                      ? formatLocaleDigits(
                          formatDateForLocale(m.married_at, locale),
                          locale,
                        )
                      : "—"}
                    {m.divorced_at
                      ? ` → ${formatLocaleDigits(
                          formatDateForLocale(m.divorced_at, locale),
                          locale,
                        )}`
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </article>

      {photoOpen && photoUrl ? (
        <DocumentPortal>
          <div
            className={styles.lightbox}
            role="presentation"
            onClick={closePhoto}
          >
            <div
              ref={photoDialogRef}
              className={styles.lightboxDialog}
              role="dialog"
              aria-modal="true"
              aria-labelledby={photoTitleId}
              onClick={(event) => event.stopPropagation()}
            >
              <header className={styles.lightboxHeader}>
                <h2 id={photoTitleId}>{personDisplayName(hero)}</h2>
                <button
                  type="button"
                  className={styles.navBtn}
                  onClick={closePhoto}
                  aria-label={t("close")}
                  data-autofocus
                >
                  <HiXMark aria-hidden />
                </button>
              </header>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className={styles.lightboxImage}
                src={photoUrl}
                alt={t("photoEnlargeAlt", { name: personDisplayName(hero) })}
              />
            </div>
          </div>
        </DocumentPortal>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ pieces */

function RelationColumn({
  title,
  people,
  badges,
  empty,
  canViewPhoto,
  onOpen,
  locale,
}: {
  title: string;
  people: DisplayPerson[];
  badges?: (string | null)[];
  empty?: string;
  canViewPhoto: boolean;
  onOpen: (id: string) => void;
  locale: string;
}) {
  return (
    <section className={styles.relColumn}>
      <h3 className={styles.sectionLabel}>
        {title}
        {people.length > 0 ? (
          <span className={styles.countPill}>
            {formatLocaleDigits(people.length, locale)}
          </span>
        ) : null}
      </h3>
      {people.length === 0 ? (
        empty ? (
          <p className={styles.relEmpty}>{empty}</p>
        ) : null
      ) : (
        <ul className={styles.relList}>
          {people.map((person, i) => (
            <li key={person.id}>
              <PersonChip
                person={person}
                badge={badges?.[i] ?? null}
                canViewPhoto={canViewPhoto}
                onClick={() => onOpen(person.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Avatar({
  person,
  canViewPhoto,
  size,
}: {
  person: DisplayPerson;
  canViewPhoto: boolean;
  size: "sm" | "md";
}) {
  const url = canViewPhoto ? resolvePersonPhotoUrl(person.photo_url) : null;
  const cls = `${styles.avatar} ${size === "sm" ? styles.avatarSm : styles.avatarMd} ${styles[person.gender]}`;
  if (url) {
    return (
      <span className={cls}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" loading="lazy" decoding="async" />
      </span>
    );
  }
  return <span className={cls}>{person.name.slice(0, 1).toUpperCase()}</span>;
}

function PersonChip({
  person,
  badge,
  canViewPhoto,
  onClick,
}: {
  person: DisplayPerson;
  badge: string | null;
  canViewPhoto: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={styles.chip} onClick={onClick}>
      <Avatar person={person} canViewPhoto={canViewPhoto} size="sm" />
      <span className={styles.chipBody}>
        <span className={styles.chipName}>{personDisplayName(person)}</span>
        {badge ? <span className={styles.chipBadge}>{badge}</span> : null}
      </span>
      <HiOutlineArrowUpRight aria-hidden className={styles.chipGo} />
    </button>
  );
}

function PersonCardButton({
  person,
  hint,
  childCount,
  canViewPhoto,
  onClick,
  locale,
  t,
}: {
  person: DisplayPerson;
  hint: string | null;
  childCount: number;
  canViewPhoto: boolean;
  onClick: () => void;
  locale: string;
  t: Translate;
}) {
  return (
    <button type="button" className={styles.resultCard} onClick={onClick}>
      <Avatar person={person} canViewPhoto={canViewPhoto} size="md" />
      <span className={styles.resultBody}>
        <span className={styles.resultName}>{personDisplayName(person)}</span>
        {hint ? <span className={styles.resultHint}>{hint}</span> : null}
        <span className={styles.resultMeta}>
          <span>{t(`gender.${person.gender}`)}</span>
          {childCount > 0 ? (
            <span>
              {t("explorer.childrenCount", {
                count: formatLocaleDigits(childCount, locale),
              })}
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );
}
