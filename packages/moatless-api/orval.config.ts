import { defineConfig } from "orval";

/**
 * Generates the Moatless REST client for the administration pages. Fork-only.
 *
 * `fetch` mode, not `react-query`: this app has no TanStack Query, and plain functions are
 * what `apps/web/src/moatless/query.ts` wraps in an atom. The spec is checked in beside this
 * file so builds do not need the sibling checkout. Delete the generated `src/generated/index.ts` barrel.
 */
export default defineConfig({
  moatless: {
    input: {
      target: "./openapi-specs.json",
    },
    output: {
      target: "./src/generated/index.ts",
      schemas: "./src/generated/model",
      client: "fetch",
      mode: "tags-split",
      // The repo compiles on `moduleResolution: nodenext`, which requires an
      // explicit extension on every relative import. Orval derives that from
      // the tsconfig and emits extensionless imports when it cannot find one.
      tsconfig: "./tsconfig.json",
      override: {
        mutator: {
          path: "./src/customInstance.ts",
          name: "customInstance",
        },
      },
    },
    /*
     * Orval emits single-quoted imports that `pnpm fmt:check` rejects, so format the output.
     * `openapi-specs.json` too, since a refresh copies it in unformatted. Not
     * `formatter: "oxfmt"`: the installed binary is a vite-plus wrapper that refuses it.
     */
    hooks: {
      afterAllFilesWrite: {
        command: "vp fmt src/generated openapi-specs.json",
        injectGeneratedDirsAndFiles: false,
      },
    },
  },
});
