/**
 * Fork-only. Narrows what came back over `postMessage` to the annotation
 * payload the composer accepts.
 *
 * Upstream needs no equivalent: its picker is a preload it shipped itself,
 * reached over ipc, so what comes back is what it sent. This one arrives from a
 * page the fork does not control, on a channel any script on that page can post
 * to, and it ends up rendered in the composer and sent to an agent. So it is
 * checked field by field before it is believed.
 */

import type { PickedElementPayload, PreviewAnnotationPayload } from "@t3tools/contracts";

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isFiniteNumberOrNull(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isPickedStackFrame(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const frame = value as Record<string, unknown>;
  return (
    isStringOrNull(frame["functionName"]) &&
    isStringOrNull(frame["fileName"]) &&
    isFiniteNumberOrNull(frame["lineNumber"]) &&
    isFiniteNumberOrNull(frame["columnNumber"])
  );
}

export function isPickedElementPayload(value: unknown): value is PickedElementPayload {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate["pageUrl"] !== "string") return false;
  if (typeof candidate["tagName"] !== "string") return false;
  if (typeof candidate["htmlPreview"] !== "string") return false;
  if (typeof candidate["styles"] !== "string") return false;
  if (typeof candidate["pickedAt"] !== "string") return false;
  if (!isStringOrNull(candidate["pageTitle"])) return false;
  if (!isStringOrNull(candidate["selector"])) return false;
  if (!isStringOrNull(candidate["componentName"])) return false;
  if (candidate["source"] !== null && !isPickedStackFrame(candidate["source"])) return false;
  if (!Array.isArray(candidate["stack"])) return false;
  return candidate["stack"].every(isPickedStackFrame);
}

function isRect(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const rect = value as Record<string, unknown>;
  return ["x", "y", "width", "height"].every(
    (key) => typeof rect[key] === "number" && Number.isFinite(rect[key]),
  );
}

function isPoint(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const point = value as Record<string, unknown>;
  return (
    typeof point["x"] === "number" &&
    Number.isFinite(point["x"]) &&
    typeof point["y"] === "number" &&
    Number.isFinite(point["y"])
  );
}

function isScreenshot(value: unknown): boolean {
  if (value === null) return true;
  if (typeof value !== "object") return false;
  const screenshot = value as Record<string, unknown>;
  return (
    typeof screenshot["dataUrl"] === "string" &&
    typeof screenshot["width"] === "number" &&
    Number.isFinite(screenshot["width"]) &&
    typeof screenshot["height"] === "number" &&
    Number.isFinite(screenshot["height"]) &&
    isRect(screenshot["cropRect"])
  );
}

export function isPreviewAnnotationPayload(value: unknown): value is PreviewAnnotationPayload {
  if (typeof value !== "object" || value === null) return false;
  const annotation = value as Record<string, unknown>;
  if (typeof annotation["id"] !== "string") return false;
  if (typeof annotation["pageUrl"] !== "string") return false;
  if (!isStringOrNull(annotation["pageTitle"])) return false;
  if (typeof annotation["comment"] !== "string") return false;
  if (typeof annotation["createdAt"] !== "string") return false;
  if (!isScreenshot(annotation["screenshot"])) return false;

  const elements = annotation["elements"];
  if (!Array.isArray(elements)) return false;
  if (
    !elements.every((entry) => {
      if (typeof entry !== "object" || entry === null) return false;
      const target = entry as Record<string, unknown>;
      return (
        typeof target["id"] === "string" &&
        isPickedElementPayload(target["element"]) &&
        isRect(target["rect"])
      );
    })
  ) {
    return false;
  }

  const regions = annotation["regions"];
  if (!Array.isArray(regions)) return false;
  if (
    !regions.every((entry) => {
      if (typeof entry !== "object" || entry === null) return false;
      const target = entry as Record<string, unknown>;
      return typeof target["id"] === "string" && isRect(target["rect"]);
    })
  ) {
    return false;
  }

  const strokes = annotation["strokes"];
  if (!Array.isArray(strokes)) return false;
  if (
    !strokes.every((entry) => {
      if (typeof entry !== "object" || entry === null) return false;
      const target = entry as Record<string, unknown>;
      return (
        typeof target["id"] === "string" &&
        typeof target["color"] === "string" &&
        typeof target["width"] === "number" &&
        Number.isFinite(target["width"]) &&
        Array.isArray(target["points"]) &&
        target["points"].every(isPoint) &&
        isRect(target["bounds"])
      );
    })
  ) {
    return false;
  }

  const styleChanges = annotation["styleChanges"];
  if (!Array.isArray(styleChanges)) return false;
  return styleChanges.every((entry) => {
    if (typeof entry !== "object" || entry === null) return false;
    const change = entry as Record<string, unknown>;
    return (
      typeof change["targetId"] === "string" &&
      isStringOrNull(change["selector"]) &&
      typeof change["property"] === "string" &&
      typeof change["previousValue"] === "string" &&
      typeof change["value"] === "string"
    );
  });
}
