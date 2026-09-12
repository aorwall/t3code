/**
 * Fork-only. The three pieces every credential surface is built from, shared by
 * the Version control page and the provider Setup sections so both read the same.
 */

import { useState } from "react";

import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { ITEM_ROW_CLASSNAME, ITEM_ROW_INNER_CLASSNAME } from "../itemRows";
import { cn } from "~/lib/utils";

/** What a credential is right now, above whatever changes it. */
export function CredentialRow({
  title,
  description,
  badge,
  actions,
}: {
  readonly title: string;
  readonly description: string;
  readonly badge?: React.ReactNode;
  readonly actions?: React.ReactNode;
}) {
  return (
    <div className={cn(ITEM_ROW_CLASSNAME, "bg-muted/30")}>
      <div className={ITEM_ROW_INNER_CLASSNAME}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground text-sm">{title}</span>
            {badge}
          </div>
          <p className="mt-0.5 text-[13px] text-muted-foreground/80">{description}</p>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export function ErrorText({ error }: { readonly error: Error | null }) {
  if (error === null) return null;
  return <p className="px-3 text-[13px] text-destructive-foreground sm:px-4">{error.message}</p>;
}

/** A password field and its Save button, cleared once the value is stored. */
export function TokenField({
  id,
  label,
  placeholder,
  hint,
  isSaving,
  onSave,
}: {
  readonly id: string;
  readonly label: string;
  readonly placeholder: string;
  readonly hint: React.ReactNode;
  readonly isSaving: boolean;
  /** Resolves true when the value was stored, which is when the field clears. */
  readonly onSave: (token: string) => Promise<boolean>;
}) {
  const [token, setToken] = useState("");

  async function submit() {
    if (await onSave(token)) setToken("");
  }

  return (
    <div className={ITEM_ROW_CLASSNAME}>
      <label htmlFor={id} className="mb-1.5 block font-medium text-foreground text-xs">
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id={id}
          type="password"
          value={token}
          autoComplete="off"
          placeholder={placeholder}
          onChange={(event) => setToken(event.currentTarget.value)}
          className="min-w-56 flex-1 font-mono text-[13px]"
        />
        <Button
          size="sm"
          disabled={token.trim().length === 0 || isSaving}
          onClick={() => void submit()}
        >
          Save
        </Button>
      </div>
      <p className="mt-1 text-[13px] text-muted-foreground/80">{hint}</p>
    </div>
  );
}
