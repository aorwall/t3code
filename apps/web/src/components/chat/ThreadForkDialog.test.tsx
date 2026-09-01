import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { visitElements } from "../../test/reactElementTree";
import { reactHookHarness as hooks } from "../../test/reactHookHarness";

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  const { reactHookHarness } = await import("../../test/reactHookHarness");
  return {
    ...actual,
    useState: reactHookHarness.useState,
  };
});

import { ThreadForkDialog } from "./ThreadForkDialog";

type Props = Parameters<typeof ThreadForkDialog>[0];

function render(props: Props): ReactElement<Record<string, unknown>> {
  hooks.beginRender();
  return ThreadForkDialog(props) as ReactElement<Record<string, unknown>>;
}

function findById(tree: ReactElement, id: string) {
  return visitElements(tree, (element) => element.props.id === id);
}

function findByText(tree: ReactElement, text: string) {
  return visitElements(tree, (element) => element.props.children === text);
}

describe("ThreadForkDialog", () => {
  beforeEach(() => {
    hooks.reset();
  });

  it("submits sameSandbox only when nothing else was filled in", () => {
    const onSubmit = vi.fn();
    const tree = render({ open: true, onOpenChange: vi.fn(), onSubmit });

    (findByText(tree, "Fork")?.props.onClick as (() => void) | undefined)?.();

    expect(onSubmit).toHaveBeenCalledWith({ sameSandbox: true });
  });

  it("starts with the branch field disabled, since sameSandbox defaults on", () => {
    const tree = render({ open: true, onOpenChange: vi.fn(), onSubmit: vi.fn() });

    expect(findById(tree, "thread-fork-branch")?.props.disabled).toBe(true);
  });

  it("enables branch once sameSandbox is switched off, and disables it again when switched back on", () => {
    let tree = render({ open: true, onOpenChange: vi.fn(), onSubmit: vi.fn() });
    const toggleOff = findById(tree, "thread-fork-same-sandbox")?.props.onCheckedChange as
      | ((checked: boolean) => void)
      | undefined;
    toggleOff?.(false);

    tree = render({ open: true, onOpenChange: vi.fn(), onSubmit: vi.fn() });
    expect(findById(tree, "thread-fork-branch")?.props.disabled).toBe(false);

    const branchOnChange = findById(tree, "thread-fork-branch")?.props.onChange as
      | ((event: { target: { value: string } }) => void)
      | undefined;
    branchOnChange?.({ target: { value: "feat/checkout" } });

    const toggleOn = findById(tree, "thread-fork-same-sandbox")?.props.onCheckedChange as
      | ((checked: boolean) => void)
      | undefined;
    toggleOn?.(true);

    tree = render({ open: true, onOpenChange: vi.fn(), onSubmit: vi.fn() });
    expect(findById(tree, "thread-fork-branch")?.props.disabled).toBe(true);
    expect(findById(tree, "thread-fork-branch")?.props.value).toBe("");
  });

  it("carries a trimmed message and branch once sameSandbox is off", () => {
    const onSubmit = vi.fn();
    let tree = render({ open: true, onOpenChange: vi.fn(), onSubmit });

    (
      findById(tree, "thread-fork-same-sandbox")?.props.onCheckedChange as
        | ((checked: boolean) => void)
        | undefined
    )?.(false);
    tree = render({ open: true, onOpenChange: vi.fn(), onSubmit });
    (
      findById(tree, "thread-fork-message")?.props.onChange as
        | ((event: unknown) => void)
        | undefined
    )?.({
      target: { value: "  keep going  " },
    });
    (
      findById(tree, "thread-fork-branch")?.props.onChange as ((event: unknown) => void) | undefined
    )?.({
      target: { value: "  feat/checkout  " },
    });

    tree = render({ open: true, onOpenChange: vi.fn(), onSubmit });
    (findByText(tree, "Fork")?.props.onClick as (() => void) | undefined)?.();

    expect(onSubmit).toHaveBeenCalledWith({
      sameSandbox: false,
      message: "keep going",
      branch: "feat/checkout",
    });
  });

  it("cancels without submitting", () => {
    const onOpenChange = vi.fn();
    const onSubmit = vi.fn();
    const tree = render({ open: true, onOpenChange, onSubmit });

    (findByText(tree, "Cancel")?.props.onClick as (() => void) | undefined)?.();

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
