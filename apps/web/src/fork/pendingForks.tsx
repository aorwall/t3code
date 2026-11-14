/**
 * Fork-only. The forks this client asked for and has not yet opened, per source thread, so
 * the Lineage section can show one while Moatless copies a long conversation (28 s for a
 * 253-turn source).
 */
import type { ScopedThreadRef } from "@t3tools/contracts";
import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import { create } from "zustand";

import { Spinner } from "~/components/ui/spinner";
import { THREAD_DETAILS_PANEL_ROW_CONTENT_CLASS } from "~/components/chat/threadDetailsPanelStyles";

export interface PendingFork {
  readonly id: number;
  readonly title: string;
}

interface PendingForksState {
  /** By `scopedThreadKey` of the source thread. */
  readonly bySource: Readonly<Record<string, ReadonlyArray<PendingFork>>>;
}

const NONE: ReadonlyArray<PendingFork> = [];
let nextId = 0;

const usePendingForksStore = create<PendingForksState>(() => ({ bySource: {} }));

/** Records a fork of `source` as under way; call the returned function once it settles. */
export function beginPendingFork(source: ScopedThreadRef, title: string): () => void {
  const key = scopedThreadKey(source);
  const fork: PendingFork = { id: nextId++, title };
  usePendingForksStore.setState((state) => ({
    bySource: { ...state.bySource, [key]: [...(state.bySource[key] ?? NONE), fork] },
  }));
  return () =>
    usePendingForksStore.setState((state) => {
      const rest = (state.bySource[key] ?? NONE).filter((entry) => entry.id !== fork.id);
      const { [key]: _settled, ...others } = state.bySource;
      return { bySource: rest.length === 0 ? others : { ...others, [key]: rest } };
    });
}

function forksOf(state: PendingForksState, source: ScopedThreadRef): ReadonlyArray<PendingFork> {
  return state.bySource[scopedThreadKey(source)] ?? NONE;
}

export function usePendingForks(source: ScopedThreadRef): ReadonlyArray<PendingFork> {
  return usePendingForksStore((state) => forksOf(state, source));
}

export function readPendingForks(source: ScopedThreadRef): ReadonlyArray<PendingFork> {
  return forksOf(usePendingForksStore.getState(), source);
}

/** A Lineage row for a fork the server has not finished; it has no thread to open yet. */
export function PendingForkRow(props: { readonly fork: PendingFork }) {
  return (
    <li
      className={`flex h-8 items-center rounded-lg ${THREAD_DETAILS_PANEL_ROW_CONTENT_CLASS}`}
      aria-busy="true"
    >
      <span className="inline-flex size-4 shrink-0 items-center justify-center">
        <Spinner aria-hidden size="xs" />
      </span>
      <span className="min-w-0 flex-1 truncate text-left text-sm font-medium leading-4 text-foreground/60">
        {props.fork.title}
      </span>
      <span className="shrink-0 text-2xs text-muted-foreground">Forking…</span>
    </li>
  );
}
