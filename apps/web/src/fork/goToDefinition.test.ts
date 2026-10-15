// @vitest-environment jsdom

import { describe, expect, it } from "vite-plus/test";

import { columnOf, symbolPositionFromEvent } from "./goToDefinition";

function renderLine(html: string): HTMLElement {
  const line = document.createElement("div");
  line.setAttribute("data-line", "7");
  line.innerHTML = html;
  document.body.append(line);
  return line;
}

describe("columnOf", () => {
  it("counts every character of the line before the clicked one, across token spans", () => {
    const line = renderLine(
      `<span>  </span><span>const</span><span> greeter = </span><span>new</span><span> Greeter</span>`,
    );
    const greeter = line.lastElementChild?.firstChild as Text;

    // The 21 characters before " Greeter" put its "G", at offset 1, in column 23.
    expect(columnOf(line, greeter, 1)).toBe(23);
  });

  it("counts in UTF-16 code units, as the language server does", () => {
    const line = renderLine(`<span>"🙂"</span><span>.length</span>`);
    const length = line.lastElementChild?.firstChild as Text;

    // The emoji is two code units, so ".length" starts at column 5.
    expect(columnOf(line, length, 1)).toBe(6);
  });
});

describe("symbolPositionFromEvent", () => {
  it("ignores a click outside any rendered code line", () => {
    const gutter = document.createElement("span");
    gutter.setAttribute("data-column-number", "7");
    gutter.textContent = "7";
    document.body.append(gutter);
    const event = new MouseEvent("click", { bubbles: true, composed: true });
    let position: ReturnType<typeof symbolPositionFromEvent> | undefined;
    gutter.addEventListener("click", (clicked) => {
      position = symbolPositionFromEvent(clicked);
    });

    gutter.dispatchEvent(event);

    expect(position).toBeNull();
  });
});
