/**
 * Artifacts: HTML pages a thread's agent published. Fork-only.
 *
 * The list and the pages are served over Moatless's HTTP API; this module holds only the
 * write the thread details panel makes over the socket.
 * @module Artifacts
 */
import { Schema } from "effect";
import { TrimmedNonEmptyString } from "./baseSchemas.ts";

/**
 * Who may open an Artifact's pages and records. `public` is any signed-in user, whatever
 * the thread's own visibility; `private` is whoever can read the thread.
 */
export const ArtifactVisibility = Schema.Literals(["public", "private"]);
export type ArtifactVisibility = typeof ArtifactVisibility.Type;

export const ArtifactSetVisibilityInput = Schema.Struct({
  artifactId: TrimmedNonEmptyString,
  visibility: ArtifactVisibility,
});
export type ArtifactSetVisibilityInput = typeof ArtifactSetVisibilityInput.Type;

/** The visibility the Artifact now has, covering every version it published. */
export const ArtifactSetVisibilityResult = Schema.Struct({
  artifactId: TrimmedNonEmptyString,
  visibility: ArtifactVisibility,
});
export type ArtifactSetVisibilityResult = typeof ArtifactSetVisibilityResult.Type;
