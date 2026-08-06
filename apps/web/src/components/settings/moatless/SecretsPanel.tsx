import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useMemo, useState } from "react";

import { deleteSecret, patchSecret } from "@t3tools/moatless-api/generated/secrets/secrets";
import type {
  Scope,
  SecretMetadataResponse,
  SecretMutationResponse,
} from "@t3tools/moatless-api/generated/model";

import { useMoatlessCommand, useMoatlessQuery } from "../../../moatless/query";
import { Button } from "../../ui/button";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "../../ui/alert-dialog";
import { Switch } from "../../ui/switch";
import { ITEM_ROW_CLASSNAME, ITEM_ROW_INNER_CLASSNAME } from "../itemRows";
import { SettingsPageContainer, SettingsSection } from "../settingsLayout";
import { SectionEmpty, SectionError, SectionPending } from "./MoatlessSectionState";
import { secretsQuery } from "./queries";
import { compareSecrets, secretKindLabel } from "./secretRows";
import { SecretEditorDialog } from "./SecretEditorDialog";
import { cn } from "~/lib/utils";

/**
 * The deployment's secrets, split by scope.
 *
 * Two sections rather than a tab: a settings page reads top to bottom, and the
 * global secrets an administrator came here for should not be one click behind
 * their own personal ones. Only an administrator reaches this page at all — the
 * nav hides it otherwise — so the global section is the point and leads.
 */
export function SecretsPanel() {
  return (
    <SettingsPageContainer>
      <SecretsSection
        scope="global"
        sectionId="secrets"
        title="Global secrets"
        emptyLabel="No global secrets yet. These reach every task in the deployment."
      />
      <SecretsSection
        scope="user"
        sectionId="personal-secrets"
        title="Your secrets"
        emptyLabel="No personal secrets yet. These reach only your own tasks."
      />
    </SettingsPageContainer>
  );
}

function SecretsSection({
  scope,
  sectionId,
  title,
  emptyLabel,
}: {
  readonly scope: Scope;
  readonly sectionId: string;
  readonly title: string;
  readonly emptyLabel: string;
}) {
  const query = useMemo(() => secretsQuery(scope), [scope]);
  const { data, error, isPending, refresh } = useMoatlessQuery(query);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<SecretMetadataResponse | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SecretMetadataResponse | null>(null);

  const rows = useMemo(() => [...(data ?? [])].sort(compareSecrets), [data]);

  function openCreate() {
    setEditing(null);
    setEditorOpen(true);
  }

  function openEdit(secret: SecretMetadataResponse) {
    setEditing(secret);
    setEditorOpen(true);
  }

  return (
    <SettingsSection
      id={sectionId}
      title={title}
      headerAction={
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label={`Add ${scope} secret`}
          onClick={openCreate}
        >
          <PlusIcon />
        </Button>
      }
    >
      {error ? (
        <SectionError error={error} label="secrets" onRetry={refresh} />
      ) : isPending && data === null ? (
        <SectionPending label="secrets" />
      ) : rows.length === 0 ? (
        <SectionEmpty>{emptyLabel}</SectionEmpty>
      ) : (
        rows.map((secret) => (
          <SecretRow
            key={secret.id}
            secret={secret}
            onEdit={() => openEdit(secret)}
            onDelete={() => setPendingDelete(secret)}
          />
        ))
      )}

      <SecretEditorDialog
        key={`${editorOpen ? "open" : "closed"}:${editing?.id ?? "new"}`}
        open={editorOpen}
        onOpenChange={setEditorOpen}
        scope={scope}
        secret={editing}
      />
      <DeleteSecretDialog secret={pendingDelete} onOpenChange={() => setPendingDelete(null)} />
    </SettingsSection>
  );
}

function SecretRow({
  secret,
  onEdit,
  onDelete,
}: {
  readonly secret: SecretMetadataResponse;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
}) {
  // One toggle command per row is fine: `useMoatlessCommand` holds only its own
  // pending flag, and the switch reflects the server value once the write
  // invalidates the list.
  const toggle = useMoatlessCommand<boolean, SecretMutationResponse>(
    (enabled) => patchSecret(secret.id, { enabled }),
    { invalidates: ["secrets"] },
  );

  return (
    <div className={cn(ITEM_ROW_CLASSNAME, !secret.enabled && "opacity-64")}>
      <div className={ITEM_ROW_INNER_CLASSNAME}>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-mono text-sm font-medium text-foreground">
              {secret.key}
            </span>
          </div>
          <p className="mt-0.5 text-[13px] leading-[1.45] text-muted-foreground/80">
            {secretKindLabel(secret.kind)}
            {secret.provider ? ` · ${secret.provider}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Switch
            checked={secret.enabled}
            disabled={toggle.isRunning}
            aria-label={secret.enabled ? `Disable ${secret.key}` : `Enable ${secret.key}`}
            onCheckedChange={(checked) => void toggle.run(Boolean(checked))}
          />
          <Button size="icon-xs" variant="ghost" aria-label={`Edit ${secret.key}`} onClick={onEdit}>
            <PencilIcon />
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={`Delete ${secret.key}`}
            onClick={onDelete}
          >
            <Trash2Icon className="text-destructive-foreground" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function DeleteSecretDialog({
  secret,
  onOpenChange,
}: {
  readonly secret: SecretMetadataResponse | null;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const remove = useMoatlessCommand<string, unknown>((id) => deleteSecret(id), {
    invalidates: ["secrets"],
  });

  async function confirm() {
    if (secret === null) return;
    const result = await remove.run(secret.id);
    if (result !== null) onOpenChange(false);
  }

  return (
    <AlertDialog
      open={secret !== null}
      onOpenChange={(open) => {
        if (remove.isRunning) return;
        if (!open) remove.reset();
        onOpenChange(open);
      }}
    >
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {secret?.key}?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the secret for good. Tasks already running keep the value they resolved;
            new tasks will not receive it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {remove.error ? (
          <p className="px-6 text-[13px] text-destructive-foreground">{remove.error.message}</p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogClose
            disabled={remove.isRunning}
            render={<Button variant="outline" disabled={remove.isRunning} />}
          >
            Cancel
          </AlertDialogClose>
          <Button variant="destructive" disabled={remove.isRunning} onClick={() => void confirm()}>
            Delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );
}
