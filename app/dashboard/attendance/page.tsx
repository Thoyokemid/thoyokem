"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ImportTab from "./components/ImportTab";
import DataTab from "./components/DataTab";
import ReportTab from "./components/ReportTab";
import RecapTab from "./components/RecapTab";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { AlertCircle, Upload } from "lucide-react";

export default function AttendancePage() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState("data");
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [dataRefreshKey, setDataRefreshKey] = useState(0);

  // Redirect if not authenticated
  if (status !== "loading" && !session) {
    redirect("/login");
  }

  // Return null during auth check
  if (status === "loading") {
    return null;
  }

  if (!session) {
    return null;
  }

  // Access denied
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

  const tabs = [
    { id: "data", label: "Data" },
    { id: "report", label: "Report" },
    { id: "recap", label: "Recap" },
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
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
              Attendance Management
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Manage employee attendance records
            </p>
          </div>
          <Button onClick={() => setIsImportModalOpen(true)} variant="outline" size="sm">
            <Upload size={14} className="mr-1.5" />
            Import
          </Button>
        </div>

        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-6 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
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
          }}
        />
      </Modal>
    </DashboardLayout>
  );
}