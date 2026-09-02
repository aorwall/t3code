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

  it("submits sameSandbox on with no message when nothing was typed", () => {
    const onSubmit = vi.fn();
    const tree = render({ open: true, onOpenChange: vi.fn(), onSubmit });

    (findByText(tree, "Fork")?.props.onClick as (() => void) | undefined)?.();

    expect(onSubmit).toHaveBeenCalledWith({ sameSandbox: true });
  });

  it("carries sameSandbox off once the toggle is switched", () => {
    const onSubmit = vi.fn();
    let tree = render({ open: true, onOpenChange: vi.fn(), onSubmit });

    (
      findById(tree, "thread-fork-same-sandbox")?.props.onCheckedChange as
        | ((checked: boolean) => void)
        | undefined
    )?.(false);

    tree = render({ open: true, onOpenChange: vi.fn(), onSubmit });
    (findByText(tree, "Fork")?.props.onClick as (() => void) | undefined)?.();

    expect(onSubmit).toHaveBeenCalledWith({ sameSandbox: false });
  });

  it("trims a typed message and omits it entirely when left blank", () => {
    const onSubmit = vi.fn();
    let tree = render({ open: true, onOpenChange: vi.fn(), onSubmit });

    (
      findById(tree, "thread-fork-message")?.props.onChange as
        | ((event: { target: { value: string } }) => void)
        | undefined
    )?.({ target: { value: "  keep going  " } });

    tree = render({ open: true, onOpenChange: vi.fn(), onSubmit });
    (findByText(tree, "Fork")?.props.onClick as (() => void) | undefined)?.();

    expect(onSubmit).toHaveBeenCalledWith({ sameSandbox: true, message: "keep going" });
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
