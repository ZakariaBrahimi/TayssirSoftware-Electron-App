"use client";

import { Layers } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSettings } from "@/hooks/use-settings";
import { Link, useRouter } from "@/i18n/navigation";
import { useFamily, useProduct } from "./api";
import { FamilyForm } from "./family-form";
import { ProductForm } from "./product-form";

function Loading() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <Skeleton className="h-96" />
      <Skeleton className="h-60" />
    </div>
  );
}

export function NewProductEditor() {
  const t = useTranslations("products");
  const tv = useTranslations("variants");
  const settings = useSettings();
  return (
    <>
      <PageHeader
        title={t("newTitle")}
        actions={
          <Button asChild variant="outline">
            <Link href="/products/families/new">
              <Layers />
              {tv("cta")}
            </Link>
          </Button>
        }
      />
      {settings.data ? <ProductForm /> : <Loading />}
    </>
  );
}

export function EditProductEditor() {
  const t = useTranslations("products");
  const tc = useTranslations("common");
  const { id } = useParams<{ id: string }>();
  const settings = useSettings();
  const product = useProduct(id);
  const router = useRouter();
  const familyId = product.data?.familyId;

  // Variants are edited together, on their family's page.
  useEffect(() => {
    if (familyId) router.replace(`/products/families/${familyId}`);
  }, [familyId, router]);

  if (product.isError) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <p className="text-muted-foreground">{tc("notFound")}</p>
        <Button asChild variant="outline">
          <Link href="/products">{tc("back")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={product.data ? product.data.name : t("editTitle")}
        description={t("editTitle")}
      />
      {product.data && settings.data && !familyId ? (
        <ProductForm key={product.data.id} product={product.data} />
      ) : (
        <Loading />
      )}
    </>
  );
}

function NotFound() {
  const tc = useTranslations("common");
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <p className="text-muted-foreground">{tc("notFound")}</p>
      <Button asChild variant="outline">
        <Link href="/products">{tc("back")}</Link>
      </Button>
    </div>
  );
}

export function NewFamilyEditor() {
  const t = useTranslations("variants");
  const settings = useSettings();
  return (
    <>
      <PageHeader title={t("newTitle")} description={t("newDescription")} />
      {settings.data ? <FamilyForm /> : <Loading />}
    </>
  );
}

export function EditFamilyEditor() {
  const t = useTranslations("variants");
  const { id } = useParams<{ id: string }>();
  const settings = useSettings();
  const family = useFamily(id);
  if (family.isError) return <NotFound />;
  return (
    <>
      <PageHeader
        title={family.data ? family.data.name : t("editTitle")}
        description={t("editTitle")}
      />
      {family.data && settings.data ? (
        <FamilyForm key={family.data.id} family={family.data} />
      ) : (
        <Loading />
      )}
    </>
  );
}
