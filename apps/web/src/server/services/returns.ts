import { and, eq, inArray, sql } from "drizzle-orm";
import type { z } from "zod";
import { lineRefund } from "@/lib/refunds";
import type { returnCreateInput } from "@/lib/validators";
import type { Ctx } from "../context";
import type { Database } from "../db/client";
import { products, returnItems, saleItems, saleReturns, sales } from "../db/schema";
import { AppError } from "../errors";
import { isMeasured, lineAmount, round3 } from "@/lib/quantity";
import { includedTax } from "@/lib/tax";
import { getSale } from "./sales";
import { findOpenShift } from "./shifts";
import { moveStock } from "./stock";

export { lineRefund };

export async function createReturn(
  db: Database,
  ctx: Ctx,
  saleId: string,
  input: z.output<typeof returnCreateInput>,
) {
  const shift = await findOpenShift(db, ctx);

  await db.transaction(async (tx) => {
    const [sale] = await tx
      .select()
      .from(sales)
      .where(and(eq(sales.id, saleId), eq(sales.storeId, ctx.storeId)));
    if (!sale) throw new AppError("NOT_FOUND");
    if (sale.status === "voided") throw new AppError("SALE_ALREADY_VOIDED");
    if (input.refundMethod === "account" && !sale.customerId) {
      throw new AppError("CUSTOMER_REQUIRED");
    }

    const lines = await tx.select().from(saleItems).where(eq(saleItems.saleId, saleId));
    // Pieces are returned whole; weighed products in fractions.
    const productIds = lines.map((l) => l.productId).filter((v): v is string => Boolean(v));
    const unitOf = new Map(
      productIds.length
        ? (
            await tx
              .select({ id: products.id, unit: products.unit })
              .from(products)
              .where(inArray(products.id, productIds))
          ).map((p) => [p.id, p.unit])
        : [],
    );
    const returned = await tx
      .select({
        saleItemId: returnItems.saleItemId,
        quantity: sql<number>`sum(${returnItems.quantity})`,
      })
      .from(returnItems)
      .innerJoin(saleReturns, eq(saleReturns.id, returnItems.returnId))
      .where(eq(saleReturns.saleId, saleId))
      .groupBy(returnItems.saleItemId);
    const returnedBy = new Map(returned.map((r) => [r.saleItemId, Number(r.quantity)]));

    // Merge duplicate lines in the request.
    const requested = new Map<string, number>();
    for (const item of input.items) {
      requested.set(item.saleItemId, round3((requested.get(item.saleItemId) ?? 0) + item.quantity));
    }

    const toInsert: {
      saleItemId: string;
      productId: string | null;
      productName: string;
      quantity: number;
      refundAmount: number;
      taxAmount: number;
      unitCost: number;
    }[] = [];
    for (const [saleItemId, quantity] of requested) {
      const line = lines.find((l) => l.id === saleItemId);
      if (!line) throw new AppError("NOT_FOUND", undefined, { saleItemId });
      const already = returnedBy.get(saleItemId) ?? 0;
      if (!Number.isInteger(quantity) && !isMeasured(unitOf.get(line.productId ?? ""))) {
        throw new AppError("QUANTITY_WHOLE", undefined, { name: line.productName });
      }
      if (round3(already + quantity - line.quantity) > 0) {
        throw new AppError("RETURN_EXCEEDS_SALE", undefined, {
          name: line.productName,
          returnable: round3(line.quantity - already),
        });
      }
      const refundAmount = lineRefund(line, sale, already, quantity);
      toInsert.push({
        saleItemId,
        productId: line.productId,
        productName: line.productName,
        quantity,
        refundAmount,
        // The refund gives back the VAT it includes.
        taxAmount: includedTax(refundAmount, line.taxRate),
        unitCost: line.unitCost,
      });
    }

    const refundAmount = toInsert.reduce((s, i) => s + i.refundAmount, 0);
    const restockedCost = input.restock
      ? toInsert.reduce((s, i) => s + lineAmount(i.unitCost, i.quantity), 0)
      : 0;

    const [ret] = await tx
      .insert(saleReturns)
      .values({
        storeId: ctx.storeId,
        saleId,
        shiftId: shift?.id ?? null,
        refundMethod: input.refundMethod,
        refundAmount,
        restockedCost,
        restock: input.restock,
        reason: input.reason,
        cashierId: ctx.userId,
        cashierName: ctx.userName,
      })
      .returning({ id: saleReturns.id });

    await tx.insert(returnItems).values(
      toInsert.map((i) => ({
        storeId: ctx.storeId,
        returnId: ret.id,
        saleItemId: i.saleItemId,
        productId: i.productId,
        productName: i.productName,
        quantity: i.quantity,
        refundAmount: i.refundAmount,
        taxAmount: i.taxAmount,
      })),
    );

    if (input.restock) {
      for (const item of toInsert) {
        if (!item.productId) continue;
        await moveStock(tx, ctx, {
          productId: item.productId,
          change: item.quantity,
          reason: "return",
          refId: ret.id,
        });
      }
    }
  });

  return getSale(db, ctx, saleId);
}
