"use client";

import { Suspense } from "react";
import { useSession } from "next-auth/react";
import { redirect, useSearchParams } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ItemsTab from "./components/ItemsTab";
import WarehousesTab from "./components/WarehousesTab";
import StockEntriesTab from "./components/StockEntriesTab";
import StockBalanceTab from "./components/StockBalanceTab";
import StockLedgerTab from "./components/StockLedgerTab";
import BomTab from "./components/BomTab";
import InventoryOverview from "./components/InventoryOverview";
import { AlertCircle } from "lucide-react";

function InventoryPageInner() {
  const { data: session, status } = useSession();
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

  const titles: Record<string, { title: string; subtitle: string }> = {
    overview: { title: "Inventory", subtitle: "Kelola barang, gudang, dan pergerakan stok" },
    balance: { title: "Stock Balance", subtitle: "Ringkasan stok per item dan warehouse" },
    ledger: { title: "Stock Ledger", subtitle: "Kartu stok — semua pergerakan masuk/keluar per transaksi" },
    entries: { title: "Stock Entries", subtitle: "Riwayat pergerakan stok" },
    items: { title: "Items", subtitle: "Daftar barang" },
    bom: { title: "Product Campuran (BOM)", subtitle: "Produk hasil campuran/rakitan beberapa item" },
    warehouses: { title: "Warehouses", subtitle: "Daftar gudang" },
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
          {activeTab === "overview" && <InventoryOverview />}
          {activeTab === "balance" && <StockBalanceTab />}
          {activeTab === "ledger" && <StockLedgerTab />}
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
