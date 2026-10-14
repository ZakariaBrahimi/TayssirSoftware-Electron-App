"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSettings } from "@/hooks/use-settings";
import { CatalogManager } from "./catalog-manager";
import { StoreSettingsForm } from "./store-settings-form";
import { UsersManager } from "./users-manager";

export function SettingsScreen() {
  const t = useTranslations("settings");
  const settings = useSettings();

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <Tabs defaultValue="store">
        <TabsList>
          <TabsTrigger value="store">{t("store")}</TabsTrigger>
          <TabsTrigger value="categories">{t("categories")}</TabsTrigger>
          <TabsTrigger value="brands">{t("brands")}</TabsTrigger>
          <TabsTrigger value="users">{t("users")}</TabsTrigger>
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
      </Tabs>
    </>
  );
}
