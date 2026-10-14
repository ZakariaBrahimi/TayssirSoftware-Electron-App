"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMe } from "@/hooks/use-me";
import { useSettings } from "@/hooks/use-settings";
import { BackupPanel } from "./backup-panel";
import { CatalogManager } from "./catalog-manager";
import { DataPanel } from "./data-panel";
import { LicensePanel } from "./license-panel";
import { StoreSettingsForm } from "./store-settings-form";
import { SyncPanel } from "./sync-panel";
import { UsersManager } from "./users-manager";

const TABS = [
  "store",
  "categories",
  "brands",
  "users",
  "license",
  "sync",
  "data",
  "backup",
] as const;
type Tab = (typeof TABS)[number];

export function SettingsScreen() {
  const t = useTranslations("settings");
  const settings = useSettings();
  const { data: me } = useMe();
  const params = useSearchParams();
  const initial = params.get("tab");
  const [tab, setTab] = useState<Tab>(TABS.includes(initial as Tab) ? (initial as Tab) : "store");
  const local = me?.mode !== "cloud";

  const visible = TABS.filter((k) => k !== "backup" || local);
  const label = (k: Tab) =>
    k === "license" ? (local ? t("license") : t("subscription")) : t(k === "store" ? "store" : k);

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="h-auto flex-wrap justify-start">
          {visible.map((k) => (
            <TabsTrigger key={k} value={k}>
              {label(k)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="store" className="mt-4">
          {settings.data ? (
            <StoreSettingsForm settings={settings.data} />
          ) : (
            <Skeleton className="h-80 w-full" />
          )}
        </TabsContent>
        <TabsContent value="categories" className="mt-4">
          <CatalogManager kind="categories" />
        </TabsContent>
        <TabsContent value="brands" className="mt-4">
          <CatalogManager kind="brands" />
        </TabsContent>
        <TabsContent value="users" className="mt-4">
          <UsersManager />
        </TabsContent>
        <TabsContent value="license" className="mt-4">
          <LicensePanel />
        </TabsContent>
        <TabsContent value="sync" className="mt-4">
          <SyncPanel />
        </TabsContent>
        <TabsContent value="data" className="mt-4">
          <DataPanel />
        </TabsContent>
        {local && (
          <TabsContent value="backup" className="mt-4">
            <BackupPanel />
          </TabsContent>
        )}
      </Tabs>
    </>
  );
}
