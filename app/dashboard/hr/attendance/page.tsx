"use client";

import { Suspense, useState } from "react";
import { useSession } from "next-auth/react";
import { redirect, useRouter, useSearchParams } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ImportTab from "./components/ImportTab";
import DataTab from "./components/DataTab";
import ReportTab from "./components/ReportTab";
import RecapTab from "./components/RecapTab";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { AlertCircle, Upload } from "lucide-react";

function AttendancePageInner() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "data";
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [dataRefreshKey, setDataRefreshKey] = useState(0);

  if (status !== "loading" && !session) {
    redirect("/login");
  }

  if (status === "loading") {
    return null;
  }

  if (!session) {
    return null;
  }

  if (!session.user.permissions.attendance) {
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
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Access Denied
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              You don't have permission to access this page.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const titles: Record<string, { title: string; subtitle: string }> = {
    data: { title: "Attendance Data", subtitle: "Riwayat absensi karyawan" },
    report: { title: "Attendance Report", subtitle: "Laporan keterlambatan & overtime" },
    recap: { title: "Attendance Recap", subtitle: "Rekap kehadiran per karyawan" },
  };
  const { title, subtitle } = titles[activeTab] || titles.data;

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
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
              {title}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{subtitle}</p>
          </div>
          <Button onClick={() => setIsImportModalOpen(true)} variant="outline" size="sm">
            <Upload size={14} className="mr-1.5" />
            Import
          </Button>
        </div>

        <div>
          {activeTab === "data" && <DataTab key={dataRefreshKey} />}
          {activeTab === "report" && <ReportTab />}
          {activeTab === "recap" && <RecapTab />}
        </div>
      </div>

      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Import Attendance Data"
        size="xl"
      >
        <ImportTab
          onImported={() => {
            setDataRefreshKey((k) => k + 1);
            setIsImportModalOpen(false);
            router.push("/dashboard/hr/attendance?tab=data");
          }}
        />
      </Modal>
    </DashboardLayout>
  );
}

export default function AttendancePage() {
  return (
    <Suspense fallback={null}>
      <AttendancePageInner />
    </Suspense>
  );
}
