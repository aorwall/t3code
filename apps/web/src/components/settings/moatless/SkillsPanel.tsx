import { Link } from "@tanstack/react-router";
import { ChevronRightIcon, GitBranchIcon, LoaderIcon, PlusIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { createPlugin } from "@t3tools/moatless-api/generated/plugins/plugins";
import type { PluginResponse } from "@t3tools/moatless-api/generated/model";

import { useMoatlessCommand, useMoatlessQuery } from "../../../moatless/query";
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
import { Label } from "../../ui/label";
import { ITEM_ROW_CLASSNAME, ITEM_ROW_INNER_CLASSNAME } from "../itemRows";
import { SettingsPageContainer, SettingsSection } from "../settingsLayout";
import { searchableSetting } from "../settingsSearch";
import { SectionEmpty, SectionError, SectionPending } from "./MoatlessSectionState";
import { pluginsQuery } from "./queries";
import { comparePlugins } from "./skillRows";
import { cn } from "~/lib/utils";

/**
 * The plugins registered on this deployment — each a git source of skills — and
 * a way to register another.
 *
 * A plugin sources skills; who actually gets them is decided on the plugin's own
 * page, where the global default and the viewer's own override have room to sit
 * side by side. The list stays a catalog: what is registered, and where it came
 * from.
 */
export function SkillsPanel() {
  const { data, error, isPending, refresh } = useMoatlessQuery(pluginsQuery);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const rows = useMemo(() => [...(data ?? [])].sort(comparePlugins), [data]);

  return (
    <SettingsPageContainer>
      <SettingsSection
        {...searchableSetting("skills")}
        headerAction={
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="Register plugin"
            onClick={() => setIsCreateOpen(true)}
          >
            <PlusIcon />
          </Button>
        }
      >
        {error ? (
          <SectionError error={error} label="plugins" onRetry={refresh} />
        ) : data === null ? (
          isPending ? (
            <SectionPending label="plugins" />
          ) : null
        ) : rows.length === 0 ? (
          <SectionEmpty>
            No plugins yet. A plugin is a git repository of skills; register one to make its skills
            available to agents.
          </SectionEmpty>
        ) : (
          rows.map((plugin) => (
            <Link
              key={plugin.id}
              to="/settings/skills/$pluginId"
              params={{ pluginId: plugin.id }}
              className={cn(ITEM_ROW_CLASSNAME, "block hover:bg-accent")}
            >
              <div className={ITEM_ROW_INNER_CLASSNAME}>
                <div className="min-w-0">
                  <span className="truncate text-sm font-medium text-foreground">
                    {plugin.name}
                  </span>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[13px] leading-[1.45] text-muted-foreground/80">
                    <GitBranchIcon className="size-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{plugin.gitUrl}</span>
                  </p>
                </div>
                <ChevronRightIcon
                  className="size-4 shrink-0 self-center text-muted-foreground/60"
                  aria-hidden
                />
              </div>
            </Link>
          ))
        )}
      </SettingsSection>

      <RegisterPluginDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </SettingsPageContainer>
  );
}

/**
 * Registering a plugin asks for a name and its git source, and nothing else.
 *
 * The skills a plugin provides are read from that source, not typed here, and
 * who gets them is decided afterwards on the plugin's page. So registration is
 * only the two facts the deployment cannot discover on its own.
 */
function RegisterPluginDialog({
  open,
  onOpenChange,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [gitUrl, setGitUrl] = useState("");
  const create = useMoatlessCommand<{ name: string; gitUrl: string }, PluginResponse>(
    (values) => createPlugin({ name: values.name, gitUrl: values.gitUrl }),
    { invalidates: ["plugins", "plugins-effective"] },
  );

  const trimmedName = name.trim();
  const trimmedGitUrl = gitUrl.trim();
  const canSubmit = trimmedName.length > 0 && trimmedGitUrl.length > 0;

  async function submit() {
    if (!canSubmit) return;
    const created = await create.run({ name: trimmedName, gitUrl: trimmedGitUrl });
    if (created !== null) {
      setName("");
      setGitUrl("");
      onOpenChange(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          create.reset();
          setName("");
          setGitUrl("");
        }
        onOpenChange(next);
      }}
    >
      <DialogPopup className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Register plugin</DialogTitle>
          <DialogDescription>
            Point at a git repository of skills. They sync from the source when the plugin's page is
            opened.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="space-y-4 px-6 pb-5">
          <div>
            <Label htmlFor="new-plugin-name">Name</Label>
            <Input
              id="new-plugin-name"
              value={name}
              autoFocus
              placeholder="my-skills"
              onChange={(event) => setName(event.currentTarget.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="new-plugin-git-url">Git URL</Label>
            <Input
              id="new-plugin-git-url"
              value={gitUrl}
              placeholder="https://github.com/org/repo"
              onChange={(event) => setGitUrl(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void submit();
                }
              }}
              className="mt-1.5"
            />
          </div>
          {create.error ? (
            <p className="text-[13px] text-destructive-foreground">{create.error.message}</p>
          ) : null}
        </DialogPanel>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!canSubmit || create.isRunning} onClick={() => void submit()}>
            {create.isRunning ? <LoaderIcon className="animate-spin" /> : null}
            Register
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
