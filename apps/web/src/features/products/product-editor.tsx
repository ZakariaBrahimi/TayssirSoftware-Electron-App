"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSettings } from "@/hooks/use-settings";
import { Link } from "@/i18n/navigation";
import { useProduct } from "./api";
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
  const settings = useSettings();
  return (
    <>
      <PageHeader title={t("newTitle")} />
      {settings.data ? <ProductForm /> : <Loading />}
    </>
  );
}

export function EditProductEditor() {
  const t = useTranslations("products");
  const tc = useTranslations("common");
  const { id } = useParams<{ id: string }>();
  const settings = useSettings();
  const product = useProduct(Number(id));

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
      {product.data && settings.data ? (
        <ProductForm key={product.data.id} product={product.data} />
      ) : (
        <Loading />
      )}
    </>
  );
}
