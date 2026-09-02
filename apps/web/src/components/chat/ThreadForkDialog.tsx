"use client";

/**
 * Fork-only. The dialog the chat hover fork icon opens: a same-sandbox
 * toggle (the only checkout that resumes this conversation, so it defaults
 * on) and an optional first message. A fork always runs on its source's
 * branch, so there is no branch control here.
 */
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
import { Switch } from "../ui/switch";
import { Textarea } from "../ui/textarea";

/** The fields a fork submission carries once resolved from the dialog. */
export interface ThreadForkSubmission {
  readonly sameSandbox: boolean;
  readonly message?: string;
}

interface ThreadForkDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSubmit: (submission: ThreadForkSubmission) => void;
}

export function ThreadForkDialog({ open, onOpenChange, onSubmit }: ThreadForkDialogProps) {
  const [sameSandbox, setSameSandbox] = useState(true);
  const [message, setMessage] = useState("");

  const submit = () => {
    const trimmedMessage = message.trim();
    onSubmit({
      sameSandbox,
      ...(trimmedMessage.length > 0 ? { message: trimmedMessage } : {}),
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
