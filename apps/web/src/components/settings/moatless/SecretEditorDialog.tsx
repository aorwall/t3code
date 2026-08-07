import { LoaderIcon } from "lucide-react";
import { useState } from "react";

import { patchSecret, putSecret } from "@t3tools/moatless-api/generated/secrets/secrets";
import type {
  Scope,
  SecretKind,
  SecretMetadataResponse,
  SecretMutationResponse,
} from "@t3tools/moatless-api/generated/model";

import { useMoatlessCommand } from "../../../moatless/query";
import { Button } from "../../ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "../../ui/dialog";
import { Input } from "../../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Textarea } from "../../ui/textarea";
import { SECRET_KIND_LABELS } from "./secretRows";

/** The kinds an administrator authors, in the order the editor offers them. */
const EDITABLE_KINDS: ReadonlyArray<SecretKind> = [
  "env",
  "provider_token",
  "runtime_file",
  "deployment",
  "ssh_key",
];

const SCOPE_LABELS: Record<Scope, string> = {
  global: "Global · every task in the deployment",
  user: "Personal · only your own tasks",
};

/**
 * Create a Secret, or replace an existing one's value.
 *
 * The value is write-only: the API never returns it, so editing offers a blank
 * field and treats blank as "leave it". Scope and key are an identity the
 * backend keys on and cannot be re-pointed, so both are fixed once the secret
 * exists — changing either is a new secret, made with the add button.
 */
export function SecretEditorDialog({
  open,
  onOpenChange,
  scope,
  secret,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** The scope a newly created secret lands in. Ignored when editing. */
  readonly scope: Scope;
  readonly secret?: SecretMetadataResponse | null;
}) {
  const isEditing = secret != null;
  const [key, setKey] = useState(secret?.key ?? "");
  const [kind, setKind] = useState<SecretKind>(secret?.kind ?? "env");
  const [value, setValue] = useState("");

  const create = useMoatlessCommand<void, SecretMutationResponse>(
    () => putSecret({ scope, key: key.trim(), kind, value }),
    { invalidates: ["secrets"] },
  );
  const update = useMoatlessCommand<void, SecretMutationResponse>(
    () =>
      patchSecret(secret?.id ?? "", {
        ...(value.length > 0 ? { value } : {}),
        ...(secret && kind !== secret.kind ? { kind } : {}),
      }),
    { invalidates: ["secrets"] },
  );
  const active = isEditing ? update : create;

  const trimmedKey = key.trim();
  // A new secret needs a value; an edit may keep the stored one by leaving it
  // blank, so only the create path requires one.
  const canSubmit = trimmedKey.length > 0 && (isEditing || value.length > 0) && !active.isRunning;

  async function submit() {
    if (!canSubmit) return;
    const result = await active.run();
    if (result !== null) {
      onOpenChange(false);
    }
  }

  function reset() {
    setKey(secret?.key ?? "");
    setKind(secret?.kind ?? "env");
    setValue("");
    create.reset();
    update.reset();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogPopup className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? `Update ${secret.key}` : "New secret"}</DialogTitle>
          <DialogDescription>
            Encrypted at rest and delivered to a sandbox at task start. The value is never returned
            after it is saved.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="space-y-4 px-6 pb-5">
          {!isEditing ? (
            <p className="rounded-lg bg-accent px-3 py-2 text-[13px] text-muted-foreground">
              {SCOPE_LABELS[scope]}
            </p>
          ) : null}

          <div>
            <label
              htmlFor="secret-key"
              className="mb-1.5 block text-xs font-medium text-foreground"
            >
              Key
            </label>
            <Input
              id="secret-key"
              value={key}
              autoFocus={!isEditing}
              disabled={isEditing}
              placeholder="OPENAI_API_KEY"
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setKey(event.currentTarget.value)}
              className="font-mono"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Environment variable name. Case-sensitive, fixed once created.
            </p>
          </div>

          <div>
            <label
              htmlFor="secret-kind"
              className="mb-1.5 block text-xs font-medium text-foreground"
            >
              Kind
            </label>
            <Select value={kind} onValueChange={(next) => next && setKind(next as SecretKind)}>
              <SelectTrigger id="secret-kind" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EDITABLE_KINDS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {SECRET_KIND_LABELS[option] ?? option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label
              htmlFor="secret-value"
              className="mb-1.5 block text-xs font-medium text-foreground"
            >
              Value
              {isEditing ? (
                <span className="ml-2 font-normal text-muted-foreground">
                  leave blank to keep current
                </span>
              ) : null}
            </label>
            {kind === "ssh_key" ? (
              <Textarea
                id="secret-value"
                value={value}
                placeholder={"-----BEGIN OPENSSH PRIVATE KEY-----\n…"}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => setValue(event.currentTarget.value)}
                className="min-h-[140px] font-mono text-xs"
              />
            ) : (
              <Input
                id="secret-value"
                type="password"
                value={value}
                placeholder={isEditing ? "Enter a new value to replace" : "Secret value"}
                autoComplete="new-password"
                spellCheck={false}
                onChange={(event) => setValue(event.currentTarget.value)}
              />
            )}
          </div>

          {active.error ? (
            <p className="text-[13px] text-destructive-foreground">{active.error.message}</p>
          ) : null}
        </DialogPanel>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!canSubmit} onClick={() => void submit()}>
            {active.isRunning ? <LoaderIcon className="animate-spin" /> : null}
            {isEditing ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
