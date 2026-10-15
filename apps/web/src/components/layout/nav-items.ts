import {
  BarChart3,
  ClipboardCheck,
  Contact,
  Gem,
  LayoutDashboard,
  Package,
  PackageSearch,
  Receipt,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavKey =
  | "dashboard"
  | "pos"
  | "shifts"
  | "products"
  | "purchases"
  | "reorder"
  | "stockCount"
  | "sales"
  | "customers"
  | "suppliers"
  | "reports"
  | "subscription"
  | "settings";

export type NavItem = {
  href: `/${string}`;
  key: NavKey;
  icon: LucideIcon;
  adminOnly?: boolean;
};

export const navItems: NavItem[] = [
  { href: "/dashboard", key: "dashboard", icon: LayoutDashboard, adminOnly: true },
  { href: "/pos", key: "pos", icon: ShoppingCart },
  { href: "/shifts", key: "shifts", icon: Wallet },
  { href: "/sales", key: "sales", icon: Receipt },
  { href: "/customers", key: "customers", icon: Users },
  { href: "/products", key: "products", icon: Package },
  { href: "/reorder", key: "reorder", icon: PackageSearch, adminOnly: true },
  { href: "/stock-count", key: "stockCount", icon: ClipboardCheck, adminOnly: true },
  { href: "/purchases", key: "purchases", icon: Truck, adminOnly: true },
  { href: "/suppliers", key: "suppliers", icon: Contact, adminOnly: true },
  { href: "/reports", key: "reports", icon: BarChart3, adminOnly: true },
  { href: "/subscription", key: "subscription", icon: Gem, adminOnly: true },
  { href: "/settings", key: "settings", icon: Settings, adminOnly: true },
];
