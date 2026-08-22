"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { redirect } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Button from "@/components/ui/Button";
import { SkeletonList } from "@/components/ui/Skeleton";
import { ListViewLayout, ListRow, ListRowAvatar, StatusBadge } from "@/components/ui/ListView";
import { Registration } from "@/types";
import { getInitials } from "@/utils/format";
import { AlertCircle, CheckCircle, XCircle, Clock } from "lucide-react";
import { formatDateTime } from "@/lib/date";

export default function RegistrationPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "rejected">("pending");

  useEffect(() => {
    if (session?.user.permissions.registration_request) {
      fetchData();
    } else if (session && !session.user.permissions.registration_request) {
      setIsLoading(false);
    }
  }, [session]);

  const fetchData = async () => {
    try {
      const response = await fetch("/api/registration");
      if (response.ok) {
        const data = await response.json();
        setRegistrations(data);
      }
    } catch (error) {
      console.error("Error fetching registrations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async (id: string, status: "approved" | "rejected") => {
    try {
      const response = await fetch("/api/registration", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });

      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("Error updating registration:", error);
    }
  };

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
  if (!session.user.permissions.registration_request) {
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

  const filteredRegistrations = registrations.filter((r) => r.status === activeTab);

  const tabs = [
    {
      id: "pending" as const,
      label: "Pending",
      icon: Clock,
      color: "text-orange-500",
      bg: "bg-orange-50 dark:bg-orange-900/20",
      count: registrations.filter((r) => r.status === "pending").length,
    },
    {
      id: "approved" as const,
      label: "Approved",
      icon: CheckCircle,
      color: "text-green-500",
      bg: "bg-green-50 dark:bg-green-900/20",
      count: registrations.filter((r) => r.status === "approved").length,
    },
    {
      id: "rejected" as const,
      label: "Rejected",
      icon: XCircle,
      color: "text-red-500",
      bg: "bg-red-50 dark:bg-red-900/20",
      count: registrations.filter((r) => r.status === "rejected").length,
    },
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
      <ListViewLayout
        title="Registration Requests"
        filterGroups={[
          {
            title: 'Status',
            filters: tabs.map((tab) => ({
              label: tab.label,
              value: tab.id,
              active: activeTab === tab.id,
              onClick: () => setActiveTab(tab.id),
              count: tab.count,
            })),
          },
        ]}
      >
        {isLoading ? (
          <SkeletonList />
        ) : filteredRegistrations.length === 0 ? (
          <div className="text-center py-10">
            <AlertCircle className="mx-auto text-gray-400 mb-3" size={40} />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              No {activeTab} registrations found
            </p>
          </div>
        ) : (
          filteredRegistrations.map((registration) => (
            <ListRow
              key={registration.id}
              onClick={() => router.push(`/dashboard/registration/${encodeURIComponent(registration.id)}`)}
              avatar={<ListRowAvatar initials={getInitials(registration.name)} />}
              title={registration.name}
              statusTone={activeTab === 'approved' ? 'green' : activeTab === 'rejected' ? 'red' : 'orange'}
              subtitle={registration.email}
              meta={`Requested: ${formatDateTime(registration.created_at)}`}
              badges={
                activeTab === "approved" ? (
                  <StatusBadge label="Approved" tone="green" />
                ) : activeTab === "rejected" ? (
                  <StatusBadge label="Rejected" tone="red" />
                ) : undefined
              }
              actions={
                activeTab === "pending" ? (
                  <>
                    <Button variant="success" onClick={() => handleAction(registration.id, "approved")}>
                      <CheckCircle size={14} className="mr-1.5" />
                      Approve
                    </Button>
                    <Button variant="danger" onClick={() => handleAction(registration.id, "rejected")}>
                      <XCircle size={14} className="mr-1.5" />
                      Reject
                    </Button>
                  </>
                ) : undefined
              }
            />
          ))
        )}
      </ListViewLayout>
    </DashboardLayout>
  );
}