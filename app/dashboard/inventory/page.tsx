"use client";

import { Suspense } from "react";
import { useSession } from "next-auth/react";
import { redirect, useRouter, useSearchParams } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ItemsTab from "./components/ItemsTab";
import WarehousesTab from "./components/WarehousesTab";
import StockEntriesTab from "./components/StockEntriesTab";
import StockBalanceTab from "./components/StockBalanceTab";
import BomTab from "./components/BomTab";
import InventoryOverview from "./components/InventoryOverview";
import { AlertCircle } from "lucide-react";

function InventoryPageInner() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";

  if (status !== "loading" && !session) redirect("/login");
  if (status === "loading") return null;
  if (!session) return null;

  if (!session.user.permissions.inventory) {
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
            <p className="text-sm text-gray-600 dark:text-gray-400">
              You don't have permission to access this page.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "balance", label: "Stock Balance" },
    { id: "entries", label: "Stock Entries" },
    { id: "items", label: "Items" },
    { id: "bom", label: "Product Campuran (BOM)" },
    { id: "warehouses", label: "Warehouses" },
  ];

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
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Inventory</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Kelola barang, gudang, dan pergerakan stok
          </p>
        </div>

        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-6 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => router.push(`/dashboard/inventory${tab.id === "overview" ? "" : `?tab=${tab.id}`}`)}
                className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-4">
          {activeTab === "overview" && <InventoryOverview />}
          {activeTab === "balance" && <StockBalanceTab />}
          {activeTab === "entries" && <StockEntriesTab />}
          {activeTab === "items" && <ItemsTab />}
          {activeTab === "bom" && <BomTab />}
          {activeTab === "warehouses" && <WarehousesTab />}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function InventoryPage() {
  return (
    <Suspense fallback={null}>
      <InventoryPageInner />
    </Suspense>
  );
}
