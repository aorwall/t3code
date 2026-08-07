import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeftIcon, LoaderIcon } from "lucide-react";
import { useState } from "react";

import { deleteAdapterConnection } from "@t3tools/moatless-api/generated/adapters/adapters";
import type { AdapterConnectionResponse } from "@t3tools/moatless-api/generated/model";

import { useMoatlessCommand, useMoatlessQuery } from "../../../moatless/query";
import {
  AlertDialog,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "../../ui/alert-dialog";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { ITEM_ROW_CLASSNAME } from "../itemRows";
import { SettingsPageContainer, SettingsRow, SettingsSection } from "../settingsLayout";
import { adapterKindLabel } from "./integrationRows";
import { SectionError, SectionPending } from "./MoatlessSectionState";
import { connectionsQuery } from "./queries";
import { cn } from "~/lib/utils";

/**
 * One connection. There is no single-connection read, so this finds it in the
 * same list the panel shows — the account it points at, how it connects, and
 * the one write it supports: removing it.
 */
export function ConnectionDetailPanel({ connectionId }: { readonly connectionId: string }) {
  const { data, error, isPending, refresh } = useMoatlessQuery(connectionsQuery);
  const connection = data?.find((item) => item.id === connectionId) ?? null;

  return (
    <SettingsPageContainer>
      <div>
        <Button
          size="xs"
          variant="ghost"
          className="-ml-1.5 text-muted-foreground"
          render={<Link to="/settings/integrations" />}
        >
          <ArrowLeftIcon />
          Integrations
        </Button>
      </div>

      {error ? (
        <SettingsSection id="connection" title="Connection">
          <SectionError error={error} label="this connection" onRetry={refresh} />
        </SettingsSection>
      ) : data === null ? (
        <SettingsSection id="connection" title="Connection">
          {isPending ? <SectionPending label="this connection" /> : null}
        </SettingsSection>
      ) : connection === null ? (
        <SettingsSection id="connection" title="Connection">
          <p className={cn(ITEM_ROW_CLASSNAME, "text-[13px] text-muted-foreground/80")}>
            This connection no longer exists.
          </p>
        </SettingsSection>
      ) : (
        <ConnectionDetail key={connection.id} connection={connection} />
      )}
    </SettingsPageContainer>
  );
}

function ConnectionDetail({ connection }: { readonly connection: AdapterConnectionResponse }) {
  return (
    <>
      <SettingsSection id="connection-overview" title={connection.externalAccountId}>
        <div className={cn(ITEM_ROW_CLASSNAME, "space-y-2")}>
          <DetailRow label="Adapter" value={adapterKindLabel(connection.adapterKind)} />
          <DetailRow label="Connection kind" value={connection.connectionKind} />
          <DetailRow label="External account" value={connection.externalAccountId} />
          <DetailRow label="Scope" value={connection.scope} />
          <DetailRow label="Created" value={connection.createdAt} />
          <DetailRow label="Updated" value={connection.updatedAt} />
        </div>
      </SettingsSection>

      <DangerSection connection={connection} />
    </>
  );
}

function DetailRow({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[13px] text-muted-foreground/80">{label}</span>
      <span className="min-w-0 truncate text-[13px] font-medium text-foreground">{value}</span>
    </div>
  );
}

function DangerSection({ connection }: { readonly connection: AdapterConnectionResponse }) {
  const navigate = useNavigate();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const remove = useMoatlessCommand<void, unknown>(() => deleteAdapterConnection(connection.id), {
    invalidates: ["integrations"],
  });

  return (
    <SettingsSection id="connection-danger" title="Danger zone">
      <SettingsRow
        title="Remove this connection"
        description="Loops that subscribe through it stop receiving events."
        status={
          remove.error ? (
            <span className="text-destructive-foreground">{remove.error.message}</span>
          ) : null
        }
        control={
          <Button size="sm" variant="destructive-outline" onClick={() => setIsConfirmOpen(true)}>
            Remove
          </Button>
        }
      />

      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {connection.externalAccountId}?</AlertDialogTitle>
            <AlertDialogDescription>
              <Badge variant="secondary" size="sm">
                {adapterKindLabel(connection.adapterKind)}
              </Badge>{" "}
              Loops subscribing through this connection stop receiving events.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isRunning}
              onClick={() => {
                void remove.run().then((result) => {
                  if (result !== null) {
                    setIsConfirmOpen(false);
                    void navigate({ to: "/settings/integrations" });
                  }
                });
              }}
            >
              {remove.isRunning ? <LoaderIcon className="animate-spin" /> : null}
              Remove connection
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </SettingsSection>
  );
}
