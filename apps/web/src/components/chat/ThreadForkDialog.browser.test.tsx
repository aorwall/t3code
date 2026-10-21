/**
 * Fork-only. Upstream removed react-test-renderer and the
 * apps/web/src/test/{reactElementTree,reactHookHarness} helpers in favor of
 * vitest browser mode, so this replaces the deleted ThreadForkDialog.test.tsx
 * with the same coverage driven through real DOM.
 */
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";

import { act, render } from "../../../test/render";
import { ThreadForkDialog, type ThreadForkHarnessOption } from "./ThreadForkDialog";

function dialogElement(
  onOpenChange: () => void,
  onSubmit: () => void,
  props: Partial<ComponentProps<typeof ThreadForkDialog>> = {},
) {
  return <ThreadForkDialog open onOpenChange={onOpenChange} onSubmit={onSubmit} {...props} />;
}

// The dialog's own inert backdrop marker sits over its unstyled popup without
// the app's CSS to layer it properly, so Playwright pointer clicks land on
// the marker instead of the control. A direct DOM click skips that check.
async function clickButton(name: string) {
  const target = await vi.waitFor(() => {
    const match = [...document.querySelectorAll<HTMLElement>("button")].find(
      (element) => element.textContent?.trim() === name,
    );
    if (!match) throw new Error(`No button "${name}"`);
    return match;
  });
  await act(async () => target.click());
}

async function toggleSameSandbox() {
  const switchElement = document.querySelector<HTMLElement>('[role="switch"]');
  if (!switchElement) throw new Error("No same-sandbox switch");
  await act(async () => switchElement.click());
}

async function pickHarness(label: string) {
  const trigger = document.querySelector<HTMLElement>('[role="combobox"]');
  if (!trigger) throw new Error("No harness picker");
  await act(async () => trigger.click());
  const option = await vi.waitFor(() => {
    const match = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(
      (element) => element.textContent?.trim() === label,
    );
    if (!match) throw new Error(`No harness option "${label}"`);
    return match;
  });
  await act(async () => option.click());
}

describe("ThreadForkDialog", () => {
  it("submits sameSandbox off with no message when nothing was typed", async () => {
    const onSubmit = vi.fn();
    await using _screen = await render(dialogElement(vi.fn(), onSubmit));

    await clickButton("Fork");

    expect(onSubmit).toHaveBeenCalledWith({ sameSandbox: false });
  });

  it("carries sameSandbox on once the toggle is switched", async () => {
    const onSubmit = vi.fn();
    await using _screen = await render(dialogElement(vi.fn(), onSubmit));

    await toggleSameSandbox();
    await clickButton("Fork");

    expect(onSubmit).toHaveBeenCalledWith({ sameSandbox: true });
  });

  it("trims a typed message and omits it entirely when left blank", async () => {
    const onSubmit = vi.fn();
    await using _screen = await render(dialogElement(vi.fn(), onSubmit));

    const textarea = await vi.waitFor(() => {
      const match = document.querySelector<HTMLTextAreaElement>("#thread-fork-message");
      if (!match) throw new Error("No message textarea");
      return match;
    });
    await userEvent.fill(textarea, "  keep going  ");
    await clickButton("Fork");

    expect(onSubmit).toHaveBeenCalledWith({ sameSandbox: false, message: "keep going" });
  });

  it("sends the picked harness and hides the picker when there is none to pick", async () => {
    const onOpenChange = vi.fn();
    const onSubmit = vi.fn();
    await using screen = await render(dialogElement(onOpenChange, onSubmit));
    await vi.waitFor(() => {
      if (!document.querySelector("#thread-fork-message")) throw new Error("Dialog not open");
    });
    expect(document.querySelector('[role="combobox"]')).toBeNull();

    const modelSelection = { instanceId: "codex", model: "gpt-5" } as never;
    const harnessOptions: ThreadForkHarnessOption[] = [
      { key: "codex", label: "Codex", modelSelection },
    ];
    await screen.rerender(dialogElement(onOpenChange, onSubmit, { harnessOptions }));

    await pickHarness("Codex");
    await clickButton("Fork");

    expect(onSubmit).toHaveBeenCalledWith({ sameSandbox: false, modelSelection });
  });

  it("cancels without submitting", async () => {
    const onOpenChange = vi.fn();
    const onSubmit = vi.fn();
    await using _screen = await render(dialogElement(onOpenChange, onSubmit));

    await clickButton("Cancel");

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
