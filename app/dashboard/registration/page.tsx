"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Loading from "@/components/ui/Loading";
import { Registration } from "@/types";
import { getInitials } from "@/utils/format";
import { AlertCircle, CheckCircle, XCircle, Clock } from "lucide-react";
import { motion } from "framer-motion";
import clsx from "clsx";

export default function RegistrationPage() {
  const { data: session, status } = useSession();
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
      <div className="space-y-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
            Registration Requests
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Review and manage user registration requests
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <div className="flex items-center justify-center py-8">
                  <Loading />
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <Card
                    key={tab.id}
                    className={clsx(
                      "cursor-pointer transition-all",
                      activeTab === tab.id ? "ring-2 ring-primary" : "hover:shadow-md"
                    )}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                          {tab.label}
                        </p>
                        <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mt-1">
                          {tab.count}
                        </p>
                      </div>
                      <div className={clsx("p-2 rounded-lg", tab.bg)}>
                        <Icon className={tab.color} size={22} />
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            <div className="space-y-3">
              {filteredRegistrations.length === 0 ? (
                <Card>
                  <div className="text-center py-10">
                    <AlertCircle className="mx-auto text-gray-400 mb-3" size={40} />
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      No {activeTab} registrations found
                    </p>
                  </div>
                </Card>
              ) : (
                filteredRegistrations.map((registration, i) => (
                  <motion.div
                    key={registration.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15, delay: Math.min(i * 0.03, 0.3) }}
                  >
                  <Card>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex-1 flex items-start gap-3">
                        <span className="w-9 h-9 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {getInitials(registration.name)}
                        </span>
                        <div>
                          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                            {registration.name}
                          </h3>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            Username: {registration.username}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                            Requested: {new Date(registration.created_at).toLocaleString()}
                          </p>
                          {registration.update_at !== registration.created_at && (
                            <p className="text-xs text-gray-500 dark:text-gray-500">
                              Updated: {new Date(registration.update_at).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>

                      {activeTab === "pending" && (
                        <div className="flex gap-2">
                          <Button
                            variant="success"
                            onClick={() => handleAction(registration.id, "approved")}
                          >
                            <CheckCircle size={14} className="mr-1.5" />
                            Approve
                          </Button>
                          <Button
                            variant="danger"
                            onClick={() => handleAction(registration.id, "rejected")}
                          >
                            <XCircle size={14} className="mr-1.5" />
                            Reject
                          </Button>
                        </div>
                      )}

                      {activeTab === "approved" && (
                        <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                          <CheckCircle size={18} />
                          <span className="font-medium text-sm">Approved</span>
                        </div>
                      )}

                      {activeTab === "rejected" && (
                        <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                          <XCircle size={18} />
                          <span className="font-medium text-sm">Rejected</span>
                        </div>
                      )}
                    </div>
                  </Card>
                  </motion.div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}