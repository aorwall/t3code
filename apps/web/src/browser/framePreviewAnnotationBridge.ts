"use client";

/**
 * Fork-only. The host half of the preview-annotation conversation, for a page
 * shown in a hosted iframe.
 *
 * Upstream annotates a preview by loading a picker into an Electron `<webview>`
 * as a preload and talking to it over `ipcRenderer`. A browser has neither, and
 * a cross-origin frame cannot be injected into from outside — `postMessage` is
 * the only thing that crosses. So the guest carries its own runtime, shipped by
 * `@moatless/inspector`, and this module is what it talks to.
 *
 * The channel names and envelope are re-declared here rather than imported: the
 * package is a dependency of the *previewed app*, not of this one, and taking a
 * build dependency on it to name six strings would make every previewed project
 * a version negotiation. The protocol is fixed and its definition lives in
 * `@moatless/inspector/preview-annotation/protocol` — change it there first.
 *
 * Readiness is established from both directions, because the guest announcing
 * itself on load and the host asking for an announcement each lose a different
 * race: the host may mount after the page finished loading, and the page may
 * finish loading after the host mounted.
 */

import type { DesktopPreviewAnnotationTheme, PreviewAnnotationPayload } from "@t3tools/contracts";
import { useSyncExternalStore } from "react";

import { isPreviewAnnotationPayload } from "./previewAnnotationPayloadGuard";

export const START_PICK_CHANNEL = "preview:start-pick";
export const CANCEL_PICK_CHANNEL = "preview:cancel-pick";
export const ELEMENT_PICKED_CHANNEL = "preview:element-picked";
export const ANNOTATION_THEME_CHANNEL = "preview:annotation-theme";
export const GUEST_READY_CHANNEL = "preview:annotation-ready";
export const PING_CHANNEL = "preview:annotation-ping";
export const PREVIEW_ANNOTATION_MESSAGE = "t3code:preview-annotation";
const BASIC_INSPECTOR_MESSAGE = "preview-iframe";
const BASIC_INSPECTOR_NAVIGATE = "NAVIGATE";
const BASIC_INSPECTOR_ROUTE_CHANGE = "ROUTE_CHANGE";
const BASIC_INSPECTOR_SCRIPT_LOADED = "INSPECTOR_SCRIPT_LOADED";
const BASIC_INSPECTOR_HEARTBEAT = "HEARTBEAT";

interface PreviewAnnotationMessage {
  readonly source: typeof PREVIEW_ANNOTATION_MESSAGE;
  readonly channel: string;
  readonly args: readonly unknown[];
}

interface PendingPick {
  readonly resolve: (annotation: PreviewAnnotationPayload | null) => void;
}

interface FrameAnnotationHost {
  readonly frameWindow: Window;
  readonly targetOrigin: string;
  currentUrl: string;
  ready: boolean;
  inspectorReady: boolean;
  history: string[];
  historyIndex: number;
  navigationState: FramePreviewInspectorNavigationState;
  pendingPick: PendingPick | null;
  onInspectorRouteChange: ((change: FramePreviewInspectorRouteChange) => void) | null;
}

const hosts = new Map<string, FrameAnnotationHost>();
/**
 * The last host unregistered for a tab, kept so that a re-registration over the
 * same window can pick up where it left off. React tears the old registration
 * down before it builds the new one, so by the time `register` runs there is
 * nothing left in `hosts` to read.
 */
const retired = new Map<string, FrameAnnotationHost>();
const subscribers = new Map<string, Set<() => void>>();
const FRAME_PREVIEW_INSPECTOR_NAVIGATION_UNAVAILABLE: FramePreviewInspectorNavigationState =
  Object.freeze({
    ready: false,
    canGoBack: false,
    canGoForward: false,
  });
let listening = false;

export interface FramePreviewInspectorRouteChange {
  readonly url: string;
  readonly title: string | null;
  readonly canGoBack: boolean;
  readonly canGoForward: boolean;
}

export interface FramePreviewInspectorNavigationState {
  readonly ready: boolean;
  readonly canGoBack: boolean;
  readonly canGoForward: boolean;
}

function readPreviewAnnotationMessage(data: unknown): PreviewAnnotationMessage | null {
  if (typeof data !== "object" || data === null) return null;
  const candidate = data as Partial<PreviewAnnotationMessage>;
  if (candidate.source !== PREVIEW_ANNOTATION_MESSAGE) return null;
  if (typeof candidate.channel !== "string") return null;
  if (!Array.isArray(candidate.args)) return null;
  return {
    source: PREVIEW_ANNOTATION_MESSAGE,
    channel: candidate.channel,
    args: candidate.args,
  };
}

function previewAnnotationMessage(
  channel: string,
  args: readonly unknown[] = [],
): PreviewAnnotationMessage {
  return { source: PREVIEW_ANNOTATION_MESSAGE, channel, args };
}

function notify(runtimeTabId: string): void {
  for (const listener of subscribers.get(runtimeTabId) ?? []) listener();
}

function send(host: FrameAnnotationHost, channel: string, args: readonly unknown[] = []): void {
  host.frameWindow.postMessage(previewAnnotationMessage(channel, args), host.targetOrigin);
}

function sendBasicInspectorMessage(
  host: FrameAnnotationHost,
  type: string,
  payload: unknown,
): void {
  host.frameWindow.postMessage({ type, payload }, host.targetOrigin);
}

function finishPendingPick(host: FrameAnnotationHost, annotation: PreviewAnnotationPayload | null) {
  const pending = host.pendingPick;
  if (!pending) return;
  host.pendingPick = null;
  pending.resolve(annotation);
}

function previewPathFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hash.startsWith("#/")) return parsed.hash;
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return "/";
  }
}

export function resolveFramePreviewInspectorRouteUrl(currentUrl: string, path: string): string {
  try {
    const base = new URL(currentUrl);
    if (path.startsWith("#")) {
      base.hash = path;
      return base.href;
    }
    return new URL(path, base.origin).href;
  } catch {
    return currentUrl;
  }
}

function readBasicInspectorMessage(
  data: unknown,
): { readonly type: string; readonly payload: unknown } | null {
  if (typeof data !== "object" || data === null) return null;
  const candidate = data as Record<string, unknown>;
  if (candidate["source"] !== BASIC_INSPECTOR_MESSAGE) return null;
  if (typeof candidate["type"] !== "string") return null;
  return { type: candidate["type"], payload: candidate["payload"] };
}

function readRoutePayload(
  payload: unknown,
): { readonly path: string; readonly title: string | null } | null {
  if (typeof payload !== "object" || payload === null) return null;
  const candidate = payload as Record<string, unknown>;
  if (typeof candidate["path"] !== "string") return null;
  return {
    path: candidate["path"],
    title: typeof candidate["title"] === "string" ? candidate["title"] : null,
  };
}

function navigationState(host: FrameAnnotationHost): FramePreviewInspectorNavigationState {
  const next = {
    ready: host.inspectorReady,
    canGoBack: host.historyIndex > 0,
    canGoForward: host.historyIndex < host.history.length - 1,
  };
  if (
    host.navigationState.ready === next.ready &&
    host.navigationState.canGoBack === next.canGoBack &&
    host.navigationState.canGoForward === next.canGoForward
  ) {
    return host.navigationState;
  }
  host.navigationState = next;
  return next;
}

function notifyInspectorRouteChange(host: FrameAnnotationHost): void {
  host.onInspectorRouteChange?.({
    url: host.currentUrl,
    title: null,
    canGoBack: navigationState(host).canGoBack,
    canGoForward: navigationState(host).canGoForward,
  });
}

function applyInspectorRouteChange(
  runtimeTabId: string,
  host: FrameAnnotationHost,
  path: string,
  title: string | null,
): void {
  host.inspectorReady = true;
  const activePath = host.history[host.historyIndex];
  if (activePath !== path) {
    host.history = [...host.history.slice(0, host.historyIndex + 1), path];
    host.historyIndex = host.history.length - 1;
  }
  host.currentUrl = resolveFramePreviewInspectorRouteUrl(host.currentUrl, path);
  host.onInspectorRouteChange?.({
    url: host.currentUrl,
    title,
    canGoBack: navigationState(host).canGoBack,
    canGoForward: navigationState(host).canGoForward,
  });
  notify(runtimeTabId);
}

function hostForMessage(event: MessageEvent): [string, FrameAnnotationHost] | null {
  for (const entry of hosts) {
    const [, host] = entry;
    if (event.source !== host.frameWindow) continue;
    if (host.targetOrigin !== "*" && event.origin !== host.targetOrigin) continue;
    return entry;
  }
  return null;
}

function handleAnnotationMessage(
  runtimeTabId: string,
  host: FrameAnnotationHost,
  message: PreviewAnnotationMessage,
): void {
  if (message.channel === GUEST_READY_CHANNEL) {
    if (!host.ready) {
      host.ready = true;
      notify(runtimeTabId);
    }
    return;
  }

  if (message.channel === ELEMENT_PICKED_CHANNEL) {
    const [candidate] = message.args;
    if (candidate === null || isPreviewAnnotationPayload(candidate)) {
      finishPendingPick(host, candidate);
    }
    return;
  }
}

function handleBasicInspectorMessage(
  runtimeTabId: string,
  host: FrameAnnotationHost,
  message: { readonly type: string; readonly payload: unknown },
): void {
  if (
    message.type === BASIC_INSPECTOR_SCRIPT_LOADED ||
    message.type === BASIC_INSPECTOR_HEARTBEAT
  ) {
    if (!host.inspectorReady) {
      host.inspectorReady = true;
      notify(runtimeTabId);
    }
    return;
  }
  if (message.type !== BASIC_INSPECTOR_ROUTE_CHANGE) return;
  const route = readRoutePayload(message.payload);
  if (!route) return;
  applyInspectorRouteChange(runtimeTabId, host, route.path, route.title);
}

function handleFrameMessage(event: MessageEvent): void {
  const hostEntry = hostForMessage(event);
  if (!hostEntry) return;
  const [runtimeTabId, host] = hostEntry;

  const annotationMessage = readPreviewAnnotationMessage(event.data);
  if (annotationMessage) {
    handleAnnotationMessage(runtimeTabId, host, annotationMessage);
    return;
  }

  const basicInspectorMessage = readBasicInspectorMessage(event.data);
  if (basicInspectorMessage) {
    handleBasicInspectorMessage(runtimeTabId, host, basicInspectorMessage);
  }
}

function ensureListening(): void {
  if (listening || typeof window === "undefined") return;
  window.addEventListener("message", handleFrameMessage);
  listening = true;
}

export function resolveFramePreviewAnnotationOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "*";
  }
}

export function registerFramePreviewAnnotationHost(input: {
  readonly runtimeTabId: string;
  readonly frameWindow: Window;
  readonly targetOrigin: string;
  readonly url: string;
  readonly onInspectorRouteChange?: ((change: FramePreviewInspectorRouteChange) => void) | null;
}): () => void {
  ensureListening();

  const previous = hosts.get(input.runtimeTabId);
  if (previous) finishPendingPick(previous, null);

  // Registering over the same window is a re-render, not a new page. The guest
  // announces itself once per document, so anything relearned here would have
  // to wait on the ping round-trip below — and until it lands, the annotate
  // button reads as unavailable and a pick resolves to null. A different window
  // means a different frame element, hence a different document, so there is
  // nothing to carry.
  const before = previous ?? retired.get(input.runtimeTabId);
  const carried = before?.frameWindow === input.frameWindow ? before : null;
  retired.delete(input.runtimeTabId);

  const host: FrameAnnotationHost = {
    frameWindow: input.frameWindow,
    targetOrigin: input.targetOrigin,
    currentUrl: carried?.currentUrl ?? input.url,
    ready: carried?.ready ?? false,
    inspectorReady: carried?.inspectorReady ?? false,
    history: carried?.history ?? [previewPathFromUrl(input.url)],
    historyIndex: carried?.historyIndex ?? 0,
    navigationState: carried?.navigationState ?? FRAME_PREVIEW_INSPECTOR_NAVIGATION_UNAVAILABLE,
    pendingPick: null,
    onInspectorRouteChange: input.onInspectorRouteChange ?? null,
  };
  hosts.set(input.runtimeTabId, host);
  notify(input.runtimeTabId);
  send(host, PING_CHANNEL);

  return () => {
    if (hosts.get(input.runtimeTabId) !== host) return;
    finishPendingPick(host, null);
    hosts.delete(input.runtimeTabId);
    retired.set(input.runtimeTabId, host);
    notify(input.runtimeTabId);
  };
}

export function pingFramePreviewAnnotationHost(runtimeTabId: string): void {
  const host = hosts.get(runtimeTabId);
  if (!host) return;
  send(host, PING_CHANNEL);
}

export function navigateFramePreviewInspectorHistory(
  runtimeTabId: string,
  direction: "back" | "forward",
): void {
  const host = hosts.get(runtimeTabId);
  if (!host || !host.inspectorReady) return;
  const nextIndex = host.historyIndex + (direction === "back" ? -1 : 1);
  if (nextIndex < 0 || nextIndex >= host.history.length) return;
  host.historyIndex = nextIndex;
  const path = host.history[nextIndex];
  if (!path) return;
  host.currentUrl = resolveFramePreviewInspectorRouteUrl(host.currentUrl, path);
  sendBasicInspectorMessage(host, BASIC_INSPECTOR_NAVIGATE, { path });
  notifyInspectorRouteChange(host);
  notify(runtimeTabId);
}

export function setFramePreviewAnnotationTheme(
  runtimeTabId: string,
  theme: DesktopPreviewAnnotationTheme,
): void {
  const host = hosts.get(runtimeTabId);
  if (!host || !host.ready) return;
  send(host, ANNOTATION_THEME_CHANNEL, [theme]);
}

export function pickFramePreviewAnnotationElement(
  runtimeTabId: string,
  theme: DesktopPreviewAnnotationTheme,
): Promise<PreviewAnnotationPayload | null> {
  const host = hosts.get(runtimeTabId);
  if (!host || !host.ready) return Promise.resolve(null);
  if (host.pendingPick) {
    send(host, CANCEL_PICK_CHANNEL);
    finishPendingPick(host, null);
  }
  send(host, START_PICK_CHANNEL, [theme]);
  return new Promise((resolve) => {
    host.pendingPick = { resolve };
  });
}

export function cancelFramePreviewAnnotationPick(runtimeTabId: string): void {
  const host = hosts.get(runtimeTabId);
  if (!host) return;
  send(host, CANCEL_PICK_CHANNEL);
  finishPendingPick(host, null);
}

function subscribe(runtimeTabId: string, listener: () => void): () => void {
  const existing = subscribers.get(runtimeTabId);
  if (existing) {
    existing.add(listener);
  } else {
    subscribers.set(runtimeTabId, new Set([listener]));
  }
  return () => {
    const next = subscribers.get(runtimeTabId);
    next?.delete(listener);
    if (next?.size === 0) subscribers.delete(runtimeTabId);
  };
}

export function isFramePreviewAnnotationReady(runtimeTabId: string | null): boolean {
  return runtimeTabId ? (hosts.get(runtimeTabId)?.ready ?? false) : false;
}

export function getFramePreviewInspectorNavigationState(
  runtimeTabId: string | null,
): FramePreviewInspectorNavigationState {
  const host = runtimeTabId ? hosts.get(runtimeTabId) : null;
  return host ? navigationState(host) : FRAME_PREVIEW_INSPECTOR_NAVIGATION_UNAVAILABLE;
}

export function useFramePreviewAnnotationReady(runtimeTabId: string | null): boolean {
  return useSyncExternalStore(
    (listener) => (runtimeTabId ? subscribe(runtimeTabId, listener) : () => undefined),
    () => isFramePreviewAnnotationReady(runtimeTabId),
    () => false,
  );
}

export function useFramePreviewInspectorNavigationState(
  runtimeTabId: string | null,
): FramePreviewInspectorNavigationState {
  return useSyncExternalStore(
    (listener) => (runtimeTabId ? subscribe(runtimeTabId, listener) : () => undefined),
    () => getFramePreviewInspectorNavigationState(runtimeTabId),
    () => FRAME_PREVIEW_INSPECTOR_NAVIGATION_UNAVAILABLE,
  );
}

export function resetFramePreviewAnnotationBridgeForTest(): void {
  for (const host of hosts.values()) finishPendingPick(host, null);
  hosts.clear();
  retired.clear();
  subscribers.clear();
  if (listening && typeof window !== "undefined") {
    window.removeEventListener("message", handleFrameMessage);
  }
  listening = false;
}
