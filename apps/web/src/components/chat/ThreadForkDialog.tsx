"use client";

/**
 * Fork-only. The dialog the chat hover fork icon opens: a same-sandbox
 * toggle (off by default, so a fork cannot disturb its source's checkout), an
 * optional first message, and the harness to run the fork on. A fork always
 * runs on its source's branch, so there is no branch control here.
 */
import type { ModelSelection } from "@t3tools/contracts";
import { useState } from "react";

import { Button } from "../ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import { Label } from "../ui/label";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { Textarea } from "../ui/textarea";

/** The fields a fork submission carries once resolved from the dialog. */
export interface ThreadForkSubmission {
  readonly sameSandbox: boolean;
  readonly message?: string;
  /** Absent when the fork keeps its source's harness. */
  readonly modelSelection?: ModelSelection;
}

/** One harness the fork can run on. `key` is unique across the list. */
export interface ThreadForkHarnessOption {
  readonly key: string;
  readonly label: string;
  readonly modelSelection: ModelSelection;
}

interface ThreadForkDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSubmit: (submission: ThreadForkSubmission) => void;
  /** Harnesses besides the source's own; the picker is hidden when empty. */
  readonly harnessOptions?: ReadonlyArray<ThreadForkHarnessOption>;
}

const SAME_HARNESS = "same";

export function ThreadForkDialog({
  open,
  onOpenChange,
  onSubmit,
  harnessOptions = [],
}: ThreadForkDialogProps) {
  const [sameSandbox, setSameSandbox] = useState(false);
  const [message, setMessage] = useState("");
  const [harnessKey, setHarnessKey] = useState(SAME_HARNESS);

  const submit = () => {
    const trimmedMessage = message.trim();
    const harness = harnessOptions.find((option) => option.key === harnessKey);
    onSubmit({
      sameSandbox,
      ...(trimmedMessage.length > 0 ? { message: trimmedMessage } : {}),
      ...(harness === undefined ? {} : { modelSelection: harness.modelSelection }),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-md">
        <DialogHeader>
          <DialogTitle>Fork this thread</DialogTitle>
          <DialogDescription>
            Branches a new thread off this message. This conversation is unaffected.
          </DialogDescription>
        </DialogHeader>
        <div data-slot="dialog-panel" className="grid gap-4 px-6 py-1">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <Label htmlFor="thread-fork-same-sandbox">Same sandbox</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                {sameSandbox
                  ? "Resumes this conversation in the parent's sandbox."
                  : "Starts fresh in its own sandbox — it won't resume this conversation."}
              </p>
            </div>
            <Switch
              id="thread-fork-same-sandbox"
              checked={sameSandbox}
              onCheckedChange={(checked) => setSameSandbox(Boolean(checked))}
            />
          </div>

          {harnessOptions.length > 0 ? (
            <div className="grid gap-2">
              <Label htmlFor="thread-fork-harness">Harness</Label>
              <Select
                value={harnessKey}
                onValueChange={(value) => setHarnessKey(value ?? SAME_HARNESS)}
              >
                <SelectTrigger id="thread-fork-harness">
                  <SelectValue>
                    {harnessOptions.find((option) => option.key === harnessKey)?.label ??
                      "Same as this thread"}
                  </SelectValue>
                </SelectTrigger>
                <SelectPopup>
                  <SelectItem value={SAME_HARNESS}>Same as this thread</SelectItem>
                  {harnessOptions.map((option) => (
                    <SelectItem key={option.key} value={option.key}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </div>
          ) : null}

          <label className="grid gap-2" htmlFor="thread-fork-message">
            <span className="text-xs font-medium text-foreground">Initial message</span>
            <Textarea
              id="thread-fork-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Leave blank to start the fork idle"
              rows={3}
            />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit}>Fork</Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
