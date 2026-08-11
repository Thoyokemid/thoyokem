"use client";

import { Suspense } from "react";
import { useSession } from "next-auth/react";
import { redirect, useSearchParams } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ReadyToDeliverTab from "./components/ReadyToDeliverTab";
import DeliveryHistoryTab from "./components/DeliveryHistoryTab";
import { AlertCircle } from "lucide-react";

function DeliveryOrderPageInner() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "ready";

  if (status !== "loading" && !session) redirect("/login");
  if (status === "loading") return null;
  if (!session) return null;

  const layoutUser = {
    id: session.user.id,
    username: session.user.email || "",
    name: session.user.name ?? "",
    role: session.user.role,
    permissions: session.user.permissions,
  };

  if (!session.user.permissions.delivery_order) {
    return (
      <DashboardLayout user={layoutUser}>
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
    ready: { title: "Ready to Deliver", subtitle: "Sales order yang sudah dikonfirmasi & di-approve, siap dikirim" },
    history: { title: "Delivery History", subtitle: "Riwayat pengiriman" },
  };
  const { title, subtitle } = titles[activeTab] || titles.ready;

  return (
    <DashboardLayout user={layoutUser}>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{subtitle}</p>
        </div>

        <div>
          {activeTab === "ready" && <ReadyToDeliverTab />}
          {activeTab === "history" && <DeliveryHistoryTab />}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function DeliveryOrderPage() {
  return (
    <Suspense fallback={null}>
      <DeliveryOrderPageInner />
    </Suspense>
  );
}
