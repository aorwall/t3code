import { SettingsPageContainer, SettingsSection } from "../settingsLayout";

/**
 * A settings page for a surface that has not moved here yet.
 *
 * Administration is moving out of the Moatless SPA one surface at a time, and
 * this is what makes that safe to do in the open: the navigation entry exists
 * from the start, so the sidebar does not change shape as surfaces land, and
 * nobody has to know which half of the work has shipped to find their way
 * around.
 *
 * It says what is missing and stops there. An earlier version linked out to the
 * same surface in the Moatless SPA; that put a second application one click
 * from settings and made the sidebar a menu of two products. A placeholder is
 * the honest shape while the work is unfinished.
 *
 * Delete a usage when its real panel lands. Delete the file when the last one
 * does.
 */
export function NotInT3Yet({
  title,
  sectionId,
  describe,
}: {
  readonly title: string;
  readonly sectionId: string;
  /** What this surface administers, lower-case, to finish "Managing …". */
  readonly describe: string;
}) {
  return (
    <SettingsPageContainer>
      <SettingsSection id={sectionId} title={title}>
        <div className="mx-3 rounded-xl border border-dashed border-input px-4 py-8 text-center sm:mx-4">
          <p className="text-[13px] font-medium text-foreground">Not in T3 yet</p>
          <p className="mx-auto mt-1 max-w-sm text-[13px] leading-[1.45] text-muted-foreground/80">
            Managing {describe} is not part of this build yet.
          </p>
        </div>
      </SettingsSection>
    </SettingsPageContainer>
  );
}
