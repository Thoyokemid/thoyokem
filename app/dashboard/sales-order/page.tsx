"use client";

import { Suspense } from "react";
import { useSession } from "next-auth/react";
import { redirect, useRouter, useSearchParams } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import SalesOrdersTab from "./components/SalesOrdersTab";
import CustomersTab from "./components/CustomersTab";
import SalesInvoicesTab from "./components/SalesInvoicesTab";
import SalesOrderOverview from "./components/SalesOrderOverview";
import { AlertCircle } from "lucide-react";

function SalesOrderPageInner() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";

  if (status !== "loading" && !session) redirect("/login");
  if (status === "loading") return null;
  if (!session) return null;

  if (!session.user.permissions.sales_order) {
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

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "orders", label: "Sales Orders" },
    { id: "invoices", label: "Invoices" },
    { id: "customers", label: "Customers" },
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
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Sales Order</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Pesanan penjualan dan tagihan customer</p>
        </div>

        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-6 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => router.push(`/dashboard/sales-order${tab.id === "overview" ? "" : `?tab=${tab.id}`}`)}
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
          {activeTab === "overview" && <SalesOrderOverview />}
          {activeTab === "orders" && <SalesOrdersTab />}
          {activeTab === "invoices" && <SalesInvoicesTab />}
          {activeTab === "customers" && <CustomersTab />}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function SalesOrderPage() {
  return (
    <Suspense fallback={null}>
      <SalesOrderPageInner />
    </Suspense>
  );
}
