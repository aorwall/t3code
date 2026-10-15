/**
 * Go to definition — where the symbol under a position in a workspace file is
 * declared.
 *
 * Fork-only. A Moatless sandbox answers it with a language server it starts
 * from the Workspace's `languageServers`; upstream has no code intelligence in
 * the file viewer. Lines are 1-based and columns are 1-based UTF-16 code units,
 * which is how a browser counts a string, so a column taken from the DOM needs
 * no conversion.
 *
 * @module ProjectDefinition
 */
import { Schema } from "effect";
import { PositiveInt, TrimmedNonEmptyString } from "./baseSchemas.ts";

export const ProjectGoToDefinitionInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  relativePath: TrimmedNonEmptyString,
  line: PositiveInt,
  column: PositiveInt,
});
export type ProjectGoToDefinitionInput = typeof ProjectGoToDefinitionInput.Type;

export const ProjectSourceLocation = Schema.Struct({
  relativePath: TrimmedNonEmptyString,
  line: PositiveInt,
  column: PositiveInt,
  endLine: PositiveInt,
  endColumn: PositiveInt,
});
export type ProjectSourceLocation = typeof ProjectSourceLocation.Type;

/** Empty when the symbol has no definition inside the workspace. */
export const ProjectGoToDefinitionResult = Schema.Struct({
  locations: Schema.Array(ProjectSourceLocation),
});
export type ProjectGoToDefinitionResult = typeof ProjectGoToDefinitionResult.Type;

/**
 * The lookup could not run: no sandbox, no language server for the file's
 * language, or a server that failed. `message` is written for the person.
 */
export class ProjectGoToDefinitionError extends Schema.TaggedError<ProjectGoToDefinitionError>()(
  "ProjectGoToDefinitionError",
  { message: TrimmedNonEmptyString },
) {}
