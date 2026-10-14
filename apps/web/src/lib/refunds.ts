/**
 * Refund owed for returning `quantity` more units of a sale line, given how
 * many were already returned. The ticket discount is spread over the lines
 * pro rata, and refunds are computed cumulatively so that returning every
 * unit refunds exactly what was paid for the line (no rounding drift).
 * Shared by the server (authoritative) and the UI (preview).
 */
export function lineRefund(
  line: { lineTotal: number; quantity: number },
  sale: { subtotal: number; discount: number },
  alreadyReturned: number,
  quantity: number,
) {
  const discountShare =
    sale.subtotal > 0 ? Math.round((sale.discount * line.lineTotal) / sale.subtotal) : 0;
  const lineNet = line.lineTotal - discountShare;
  const upTo = (q: number) => Math.round((lineNet * q) / line.quantity);
  return upTo(alreadyReturned + quantity) - upTo(alreadyReturned);
}
