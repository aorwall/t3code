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
      biome: false,
      prettier: false,
      override: {
        mutator: {
          path: "./src/customInstance.ts",
          name: "customInstance",
        },
      },
    },
  },
});
