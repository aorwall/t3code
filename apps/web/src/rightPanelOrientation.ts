import * as Schema from "effect/Schema";

import { useLocalStorage } from "~/hooks/useLocalStorage";

/**
 * Where the inline right panel sits relative to the chat column: beside it
 * ("right", the screen split vertically) or under it ("bottom", the screen
 * split horizontally, the way the terminal drawer sits).
 *
 * Per browser rather than per thread — like the panel's width, this is how
 * someone arranges their window, not something a thread owns.
 *
 * Fork addition: upstream's panel only ever sits beside the chat.
 */
export const RightPanelOrientation = Schema.Literals(["right", "bottom"]);
export type RightPanelOrientation = typeof RightPanelOrientation.Type;

const RIGHT_PANEL_ORIENTATION_STORAGE_KEY = "t3code:right-panel-orientation";
const DEFAULT_RIGHT_PANEL_ORIENTATION: RightPanelOrientation = "right";

export function useRightPanelOrientation() {
  return useLocalStorage(
    RIGHT_PANEL_ORIENTATION_STORAGE_KEY,
    DEFAULT_RIGHT_PANEL_ORIENTATION,
    RightPanelOrientation,
  );
}
