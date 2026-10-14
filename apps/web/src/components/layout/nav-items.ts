import {
  BarChart3,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: "/dashboard" | "/pos" | "/products" | "/sales" | "/reports" | "/settings";
  key: "dashboard" | "pos" | "products" | "sales" | "reports" | "settings";
  icon: LucideIcon;
  adminOnly?: boolean;
};

export const navItems: NavItem[] = [
  { href: "/dashboard", key: "dashboard", icon: LayoutDashboard, adminOnly: true },
  { href: "/pos", key: "pos", icon: ShoppingCart },
  { href: "/products", key: "products", icon: Package },
  { href: "/sales", key: "sales", icon: Receipt },
  { href: "/reports", key: "reports", icon: BarChart3, adminOnly: true },
  { href: "/settings", key: "settings", icon: Settings, adminOnly: true },
];
