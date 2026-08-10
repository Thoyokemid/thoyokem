"use client";

import { Suspense } from "react";
import { useSession } from "next-auth/react";
import { redirect, useSearchParams } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PurchaseOrdersTab from "./components/PurchaseOrdersTab";
import SuppliersTab from "./components/SuppliersTab";
import PurchaseInvoicesTab from "./components/PurchaseInvoicesTab";
import PurchasingOverview from "./components/PurchasingOverview";
import { AlertCircle } from "lucide-react";

function PurchasingPageInner() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";

  if (status !== "loading" && !session) redirect("/login");
  if (status === "loading") return null;
  if (!session) return null;

  if (!session.user.permissions.purchasing) {
    return (
      <DashboardLayout
        user={{
          id: session.user.id,
          username: session.user.email || "",
          name: session.user.name ?? "",
          role: session.user.role,
          permissions: session.user.permissions,
        }}
      >
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <AlertCircle className="mx-auto text-red-500 mb-3" size={40} />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">You don't have permission to access this page.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const titles: Record<string, { title: string; subtitle: string }> = {
    overview: { title: "Purchasing", subtitle: "Purchase order, penerimaan barang, dan tagihan supplier" },
    orders: { title: "Purchase Orders", subtitle: "Daftar purchase order" },
    invoices: { title: "Invoices", subtitle: "Tagihan dari supplier" },
    suppliers: { title: "Suppliers", subtitle: "Daftar supplier" },
  };
  const { title, subtitle } = titles[activeTab] || titles.overview;

  return (
    <DashboardLayout
      user={{
        id: session.user.id,
        username: session.user.email || "",
        name: session.user.name ?? "",
        role: session.user.role,
        permissions: session.user.permissions,
      }}
    >
      <div className="space-y-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{subtitle}</p>
        </div>

        <div>
          {activeTab === "overview" && <PurchasingOverview />}
          {activeTab === "orders" && <PurchaseOrdersTab />}
          {activeTab === "invoices" && <PurchaseInvoicesTab />}
          {activeTab === "suppliers" && <SuppliersTab />}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function PurchasingPage() {
  return (
    <Suspense fallback={null}>
      <PurchasingPageInner />
    </Suspense>
  );
}
