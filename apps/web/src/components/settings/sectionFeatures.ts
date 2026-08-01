/**
 * Settings sections that exist only to drive a surface the server may not serve.
 *
 * Fork-only. A section listed here is the whole of one feature — every control
 * on its page calls methods in that group — so an environment that cannot serve
 * the group has nothing to show there and the section is left out of the nav
 * and refused as a route.
 *
 * Sections are deliberately absent from this map when their page mixes
 * server-backed and client-only state. **General** and **Providers** are both
 * like that: most of General persists to `localStorage` through
 * `splitPatch`, and Providers renders a list the server does publish. Hiding
 * either would take working controls with it, so the affordances inside them
 * that are purely server writes are gated one by one instead.
 *
 * **Diagnostics** is gated too, but has no entry here because it has none in
 * the nav either — it is reached by URL, so its route is the only place to gate
 * it.
 *
 * The nav reads this, and so does settings search: a result that jumps into a
 * hidden section is the same hole as a nav entry that does.
 */
import type { EnvironmentFeatureName } from "@t3tools/contracts";

import type { SettingsPath } from "./settingsSearch";

export const SETTINGS_SECTION_FEATURE: Partial<Record<SettingsPath, EnvironmentFeatureName>> = {
  "/settings/keybindings": "serverAdministration",
  "/settings/source-control": "projectManagement",
  "/settings/archived": "threadArchival",
};
