"use client";

import {
  Children,
  Fragment,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type OptionHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { FiCheck } from "react-icons/fi";

import styles from "./Select.module.css";

export type SelectOption = {
  value: string;
  label: ReactNode;
  /** The label as plain text, for the closed control and for type-ahead. */
  text: string;
  /** Optional compact label for the closed trigger; falls back to `label`. */
  triggerLabel?: ReactNode;
  disabled?: boolean;
};

type Position = {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
};

/** Gap between the control and its list, plus the viewport edge to keep clear. */
const GAP = 6;
const MARGIN = 8;
/** Below this much room the list flips above the control instead. */
const MIN_ROOM = 180;
const MAX_HEIGHT = 320;
/** How long consecutive keystrokes count as one type-ahead search. */
const TYPEAHEAD_MS = 700;

function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) {
    return textOf((node.props as { children?: ReactNode }).children);
  }
  return "";
}

/**
 * Read `<option>` children into plain data, so callers keep writing the markup
 * a native select takes while the list itself is ours to draw. Fragments are
 * walked through because `{cond ? <option/> : null}` and `.map()` both nest.
 */
export function optionsFromChildren(children: ReactNode): SelectOption[] {
  const out: SelectOption[] = [];
  const walk = (node: ReactNode) => {
    Children.forEach(node, (child) => {
      if (!isValidElement(child)) return;
      if (child.type === Fragment) {
        walk((child.props as { children?: ReactNode }).children);
        return;
      }
      if (child.type !== "option") return;
      const props = child.props as OptionHTMLAttributes<HTMLOptionElement> & {
        children?: ReactNode;
      };
      const text = props.label ?? textOf(props.children);
      out.push({
        value: props.value === undefined ? text : String(props.value),
        label: props.children ?? text,
        text,
        disabled: props.disabled,
      });
    });
  };
  walk(children);
  return out;
}

function measure(trigger: HTMLElement, minWidth = 0): Position {
  const rect = trigger.getBoundingClientRect();
  const below = window.innerHeight - rect.bottom - GAP - MARGIN;
  const above = rect.top - GAP - MARGIN;
  const flip = below < MIN_ROOM && above > below;
  const maxHeight = Math.min(Math.max(flip ? above : below, 140), MAX_HEIGHT);
  const width = Math.max(rect.width, minWidth);
  const left = Math.min(
    Math.max(MARGIN, rect.left),
    Math.max(MARGIN, window.innerWidth - width - MARGIN),
  );
  return flip
    ? { bottom: window.innerHeight - rect.top + GAP, left, width, maxHeight }
    : { top: rect.bottom + GAP, left, width, maxHeight };
}

function matchesFilter(option: SelectOption, query: string): boolean {
  if (!query) return true;
  // Empty-value rows (e.g. "None") stay reachable while filtering.
  if (option.value === "") return true;
  return option.text.toLowerCase().includes(query);
}

type SelectProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "className" | "size"
> & {
  /**
   * The list to draw. `<option>` children are optional: pass them when the
   * caller already writes native markup, otherwise they are generated here.
   */
  options: SelectOption[];
  /** Classes for the closed control, so it matches the other form fields. */
  className?: string;
  describedBy?: string;
  invalid?: boolean;
  /** Shown when the current value matches no option. */
  placeholder?: string;
  /**
   * When true, the open list shows a text field that filters options by label.
   * Use for long person / entity pickers where type-ahead alone is not enough.
   */
  filterable?: boolean;
  /** Placeholder for the filter field when `filterable` is set. */
  filterPlaceholder?: string;
  /** Shown in the list when the filter matches nothing. */
  filterEmptyLabel?: string;
  /** Floor for the portalled list width (useful for compact triggers). */
  minPanelWidth?: number;
};

/**
 * A select whose open list is drawn by the app rather than the operating
 * system. The native popup cannot be styled at all: it arrives in the system
 * font, ignores the theme and the RTL layout, and on Windows still looks like a
 * grey Win32 list dropped onto the page.
 *
 * A real `<select>` stays in the DOM, hidden but rendered, and remains the
 * source of truth: form submission, `required` validation and the `onChange`
 * event all keep working, so callers see no difference from the native element.
 */
export function Select({
  options,
  className,
  describedBy,
  invalid,
  placeholder,
  filterable = false,
  filterPlaceholder,
  filterEmptyLabel,
  minPanelWidth,
  id,
  value,
  defaultValue,
  disabled,
  children,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  ...rest
}: SelectProps) {
  const selectRef = useRef<HTMLSelectElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const search = useRef({ text: "", at: 0 });
  const filterInputId = useId();

  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const [active, setActive] = useState(-1);
  const [filter, setFilter] = useState("");
  const [uncontrolled, setUncontrolled] = useState(() =>
    defaultValue === undefined ? "" : String(defaultValue),
  );

  const firstEnabled = options.find((option) => !option.disabled)?.value ?? "";
  const current =
    value === undefined ? uncontrolled || firstEnabled : String(value);
  const selected = options.find((option) => option.value === current);
  const listId = `${id ?? "select"}-list`;

  const query = filter.trim().toLowerCase();
  const visible = useMemo(
    () =>
      filterable ? options.filter((option) => matchesFilter(option, query)) : options,
    [filterable, options, query],
  );

  const close = useCallback((refocus = true) => {
    setOpen(false);
    setActive(-1);
    setFilter("");
    if (refocus) triggerRef.current?.focus();
  }, []);

  const commit = useCallback(
    (option: SelectOption) => {
      if (option.disabled) return;
      const node = selectRef.current;
      // Drive the hidden select through its own value setter and let the change
      // bubble: React then reports it exactly as a user's click on the native
      // control would, including a proper `event.target`.
      if (node && node.value !== option.value) {
        const setter = Object.getOwnPropertyDescriptor(
          HTMLSelectElement.prototype,
          "value",
        )?.set;
        setter?.call(node, option.value);
        node.dispatchEvent(new Event("change", { bubbles: true }));
      }
      if (value === undefined) setUncontrolled(option.value);
      close();
    },
    [close, value],
  );

  const show = useCallback(
    (activeValue: string) => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      setFilter("");
      setPosition(measure(trigger, minPanelWidth));
      const index = options.findIndex((option) => option.value === activeValue);
      setActive(index >= 0 ? index : options.findIndex((o) => !o.disabled));
      setOpen(true);
    },
    [minPanelWidth, options],
  );

  const step = useCallback(
    (from: number, delta: number, list: SelectOption[]) => {
      if (list.length === 0) return;
      let next = from;
      for (let i = 0; i < list.length; i += 1) {
        next += delta;
        if (next < 0) next = list.length - 1;
        if (next > list.length - 1) next = 0;
        if (!list[next]?.disabled) {
          setActive(next);
          return;
        }
      }
    },
    [],
  );

  const edge = useCallback((fromStart: boolean, list: SelectOption[]) => {
    const index = fromStart
      ? list.findIndex((option) => !option.disabled)
      : list.reduce((last, option, i) => (option.disabled ? last : i), -1);
    if (index >= 0) setActive(index);
  }, []);

  const typeahead = useCallback(
    (key: string, list: SelectOption[]) => {
      const now = Date.now();
      const text =
        now - search.current.at < TYPEAHEAD_MS
          ? search.current.text + key.toLowerCase()
          : key.toLowerCase();
      search.current = { text, at: now };
      const matches = (option: SelectOption) =>
        !option.disabled && option.text.trim().toLowerCase().startsWith(text);
      // Search past the active row first, so repeating a letter cycles.
      const after = list.findIndex(
        (option, i) => i > active && matches(option),
      );
      const index = after >= 0 ? after : list.findIndex(matches);
      if (index >= 0) setActive(index);
    },
    [active],
  );

  const onListKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>, list: SelectOption[]) => {
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          step(active, 1, list);
          break;
        case "ArrowUp":
          event.preventDefault();
          step(active < 0 ? list.length : active, -1, list);
          break;
        case "Home":
          event.preventDefault();
          edge(true, list);
          break;
        case "End":
          event.preventDefault();
          edge(false, list);
          break;
        case "Enter":
          event.preventDefault();
          if (list[active]) commit(list[active]);
          break;
        case "Escape":
          event.preventDefault();
          event.stopPropagation();
          close();
          break;
        case "Tab":
          close(false);
          break;
        default:
          if (
            !filterable &&
            event.key.length === 1 &&
            !event.ctrlKey &&
            !event.metaKey
          ) {
            event.preventDefault();
            typeahead(event.key, list);
          }
      }
    },
    [active, close, commit, edge, filterable, step, typeahead],
  );

  useEffect(() => {
    if (!open) return;
    const reposition = (event?: Event) => {
      // Scrolling the open list itself must not re-measure: capture-phase
      // window listeners see those events and would shrink / jump the panel.
      const target = event?.target;
      if (
        target instanceof Node &&
        panelRef.current &&
        (target === panelRef.current || panelRef.current.contains(target))
      ) {
        return;
      }
      const trigger = triggerRef.current;
      if (trigger) setPosition(measure(trigger, minPanelWidth));
    };
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      close(false);
    };
    // Capture on `window` runs ahead of the dialog focus traps, which listen on
    // `document`: Escape has to shut this list, not the dialog behind it.
    // DOM KeyboardEvent — not React's (imported above for JSX handlers).
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Filterable lists handle Escape on the input; skip the window listener
      // so we do not close twice / steal the event from the filter field.
      if (filterable && event.target === filterRef.current) return;
      event.stopPropagation();
      close();
    };
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [close, filterable, minPanelWidth, open]);

  useEffect(() => {
    if (!open || !filterable) return;
    filterRef.current?.focus();
  }, [filterable, open]);

  useEffect(() => {
    if (!open || active < 0) return;
    panelRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  return (
    <span className={styles.wrap}>
      <select
        {...rest}
        ref={selectRef}
        value={value}
        defaultValue={defaultValue}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden
        className={styles.native}
      >
        {children ??
          options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.text}
            </option>
          ))}
      </select>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-autocomplete={filterable ? "list" : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-activedescendant={
          open && active >= 0 ? `${listId}-${active}` : undefined
        }
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        aria-required={rest.required || undefined}
        disabled={disabled}
        className={[className, styles.trigger, open ? styles.triggerOpen : null]
          .filter(Boolean)
          .join(" ")}
        onClick={() => (open ? close() : show(current))}
        onKeyDown={(event) => {
          if (event.altKey && event.key !== "ArrowDown") return;
          if (!open) {
            if (
              event.key === "ArrowDown" ||
              event.key === "ArrowUp" ||
              event.key === "Enter" ||
              event.key === " "
            ) {
              event.preventDefault();
              show(current);
            } else if (
              !filterable &&
              event.key.length === 1 &&
              !event.ctrlKey &&
              !event.metaKey
            ) {
              event.preventDefault();
              show(current);
              typeahead(event.key, options);
            }
            return;
          }
          if (filterable) return;
          onListKeyDown(event, visible);
        }}
      >
        <span className={selected ? styles.value : styles.placeholder}>
          {selected
            ? (selected.triggerLabel ?? selected.label)
            : (placeholder ?? "")}
        </span>
      </button>
      {open && position
        ? createPortal(
            <div
              ref={panelRef}
              id={listId}
              role="listbox"
              aria-label={ariaLabel}
              className={styles.panel}
              style={{
                top: position.top,
                bottom: position.bottom,
                left: position.left,
                width: position.width,
                maxHeight: position.maxHeight,
              }}
            >
              {filterable ? (
                <div className={styles.filterRow}>
                  <input
                    ref={filterRef}
                    id={filterInputId}
                    type="text"
                    role="searchbox"
                    className={styles.filter}
                    value={filter}
                    placeholder={filterPlaceholder}
                    aria-label={filterPlaceholder}
                    aria-controls={listId}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    onChange={(event) => {
                      const next = event.target.value;
                      setFilter(next);
                      const list = options.filter((option) =>
                        matchesFilter(option, next.trim().toLowerCase()),
                      );
                      const index = list.findIndex(
                        (option) => option.value === current,
                      );
                      setActive(
                        index >= 0
                          ? index
                          : list.findIndex((option) => !option.disabled),
                      );
                    }}
                    onKeyDown={(event) => onListKeyDown(event, visible)}
                    onMouseDown={(event) => event.stopPropagation()}
                  />
                </div>
              ) : null}
              {visible.length === 0 ? (
                <div className={styles.empty} role="status">
                  {filterEmptyLabel ?? ""}
                </div>
              ) : (
                visible.map((option, index) => (
                  <div
                    key={`${option.value}-${index}`}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={option.value === current}
                    aria-disabled={option.disabled || undefined}
                    data-index={index}
                    className={[
                      styles.option,
                      index === active ? styles.optionActive : null,
                      option.value === current ? styles.optionSelected : null,
                      option.disabled ? styles.optionDisabled : null,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onMouseEnter={() => {
                      if (!option.disabled) setActive(index);
                    }}
                    onClick={() => commit(option)}
                  >
                    <span className={styles.optionLabel}>{option.label}</span>
                    {option.value === current ? (
                      <FiCheck className={styles.check} aria-hidden />
                    ) : null}
                  </div>
                ))
              )}
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}
