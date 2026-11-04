import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AdminDashboard } from "@/components/dashboard/AdminViews";

export default async function AdminPage({ params }: { params: Promise<{ section?: string[] }> }) {
  const user = await getCurrentUser();
  if (!user || user.status !== "active") redirect("/login?next=/admin");
  if (user.role !== "admin") redirect(user.role === "professional" ? "/pro" : "/account");
  const { section = [] } = await params;
  return <AdminDashboard section={section} user={{ id: user.id, fullName: user.fullName, role: user.role, phone: user.phone, phoneVerified: user.phoneVerified, avatarUrl: user.avatarUrl }} />;
}
