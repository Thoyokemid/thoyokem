import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/auth';
import DashboardLayout from "@/components/layout/DashboardLayout";
import HRDashboardContent from "./HRDashboardContent";
import { AlertCircle } from "lucide-react";

export default async function HRDashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const hasHRAccess = session.user.permissions.attendance || session.user.permissions.leave || session.user.permissions.staff;

  if (!hasHRAccess) {
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
      <HRDashboardContent permissions={session.user.permissions} />
    </DashboardLayout>
  );
}
