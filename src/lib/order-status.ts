// Plain status labels, safe to import from client components.
import type { OrderStatus } from "@prisma/client";

export const statusLabels: Record<OrderStatus, string> = {
  PENDING: "New",
  CONFIRMED: "Confirmed",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};
