import { describe, expect, it } from "vite-plus/test";

import { parseArtifactTitles, parseMoatlessArtifactHref } from "./moatlessArtifactLink";

const ORIGIN = "https://moatless.example.com";
const ID = "77e15557-209a-4e15-8e03-d524e230a88b";

describe("parseMoatlessArtifactHref", () => {
  it("reads a versioned artifact link", () => {
    expect(parseMoatlessArtifactHref(`${ORIGIN}/api/v1/artifacts/${ID}/v3`, ORIGIN)).toEqual({
      artifactId: ID,
      version: 3,
    });
  });

  it("reads the latest-version link", () => {
    expect(parseMoatlessArtifactHref(`${ORIGIN}/api/v1/artifacts/${ID}`, ORIGIN)).toEqual({
      artifactId: ID,
      version: null,
    });
  });

  it("ignores the same path on another origin", () => {
    expect(
      parseMoatlessArtifactHref(`https://elsewhere.example.com/api/v1/artifacts/${ID}`, ORIGIN),
    ).toBeNull();
  });

  it("ignores other backend paths and malformed links", () => {
    expect(parseMoatlessArtifactHref(`${ORIGIN}/api/v1/tasks/${ID}/artifacts`, ORIGIN)).toBeNull();
    expect(parseMoatlessArtifactHref(`${ORIGIN}/api/v1/artifacts/${ID}/latest`, ORIGIN)).toBeNull();
    expect(parseMoatlessArtifactHref("not a url", ORIGIN)).toBeNull();
    expect(parseMoatlessArtifactHref(`${ORIGIN}/api/v1/artifacts/${ID}`, null)).toBeNull();
  });
});

describe("parseArtifactTitles", () => {
  it("maps each artifact id to its title", () => {
    const titles = parseArtifactTitles({
      items: [
        { artifactId: ID.toUpperCase(), title: "SP-3388 rewrite" },
        { artifactId: "other", title: "  " },
        { title: "no id" },
      ],
    });
    expect([...titles]).toEqual([[ID, "SP-3388 rewrite"]]);
  });

  it("tolerates an unexpected body", () => {
    expect(parseArtifactTitles(null).size).toBe(0);
    expect(parseArtifactTitles({ items: "nope" }).size).toBe(0);
  });
});
