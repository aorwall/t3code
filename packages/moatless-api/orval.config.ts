import { defineConfig } from "orval";

/**
 * Generates the Moatless REST client this fork uses for its administration
 * pages.
 *
 * Fork-only, and deliberately not a copy of the Moatless repo's own config.
 * That one emits `client: "react-query"`, because the Moatless SPA is built on
 * TanStack Query. This app is not: `apps/web/package.json` has no
 * `@tanstack/react-query`, and adding one so that a handful of settings pages
 * can fetch would put a second data layer beside Effect Atom and carry it
 * through every upstream merge. `fetch` mode emits plain functions, which is
 * all `apps/web/src/moatless/query.ts` needs to wrap in an atom.
 *
 * The input is checked in beside this file rather than read across the
 * workspace from `../../../moatless/openapi-specs.json`. A build must not
 * depend on the sibling checkout being present, and pinning the description
 * lets the two repositories diverge deliberately between syncs — with
 * `spec:check` failing the build when the divergence was not deliberate.
 *
 * `output.target` names `src/generated/index.ts`, so a run emits a barrel of
 * `export *` lines there. That file is not checked in and no export in
 * `package.json` names it: every caller imports a tag module by name, such as
 * `@t3tools/moatless-api/generated/users/users`. Delete the barrel after
 * generating.
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
     * Orval emits single-quoted imports, which `pnpm fmt:check` rejects on all
     * 293 generated files — and a check that is always red is a check nobody
     * reads. So format the output rather than exclude it from the check.
     *
     * `openapi-specs.json` is formatted here too, though orval only reads it.
     * A refresh copies that file from the Moatless checkout and then runs this
     * generator, so the copy is the other way the package acquires unformatted
     * text. `spec:check` compares the two descriptions parsed, not as bytes, so
     * formatting the copy does not make it look stale.
     *
     * `formatter: "oxfmt"` is orval's own answer and does not work here: it
     * calls the `oxfmt` binary directly, and the one this repository installs
     * is a vite-plus wrapper that refuses every invocation except LSP and
     * stdin. `vp fmt` is the wrapped entry point, and it reads the repository's
     * own fmt configuration, which calling oxfmt directly would not.
     */
    hooks: {
      afterAllFilesWrite: {
        command: "vp fmt src/generated openapi-specs.json",
        injectGeneratedDirsAndFiles: false,
      },
    },
  },
});
