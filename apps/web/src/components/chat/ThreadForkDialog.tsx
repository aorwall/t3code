"use client";

/**
 * Fork-only. The dialog the chat hover fork icon opens: a same-sandbox
 * toggle (the only checkout that resumes this conversation, so it defaults
 * on), an optional first message, and a branch that only applies once the
 * toggle is off — the sink refuses `branch` together with `sameSandbox`
 * (`TaskForkService::validate_checkout` in the Moatless backend), so the
 * field is disabled rather than left to round-trip a refusal.
 */
import { useState } from "react";

import {
  resolveThreadForkSubmission,
  type ThreadForkSubmission,
} from "../../fork/threadForkDialog";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { Textarea } from "../ui/textarea";

interface ThreadForkDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSubmit: (submission: ThreadForkSubmission) => void;
}

export function ThreadForkDialog({ open, onOpenChange, onSubmit }: ThreadForkDialogProps) {
  const [sameSandbox, setSameSandbox] = useState(true);
  const [message, setMessage] = useState("");
  const [branch, setBranch] = useState("");

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
              onCheckedChange={(checked) => {
                const next = Boolean(checked);
                setSameSandbox(next);
                if (next) {
                  setBranch("");
                }
              }}
            />
          </div>

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

          <label className="grid gap-2" htmlFor="thread-fork-branch">
            <span className="text-xs font-medium text-foreground">Branch</span>
            <Input
              id="thread-fork-branch"
              value={branch}
              onChange={(event) => setBranch(event.target.value)}
              placeholder="Repository default"
              disabled={sameSandbox}
            />
            <span className="text-[11px] text-muted-foreground">
              {sameSandbox
                ? "Only available for an isolated fork — a same-sandbox fork shares the parent's working tree."
                : "Checked out fresh for the fork. Leave blank for the repository's default."}
            </span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => onSubmit(resolveThreadForkSubmission({ sameSandbox, message, branch }))}
          >
            Fork
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
