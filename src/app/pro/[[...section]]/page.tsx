import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ProDashboard } from "@/components/dashboard/ProViews";

export default async function ProPage({ params }: { params: Promise<{ section?: string[] }> }) {
  const user = await getCurrentUser();
  if (!user || user.status !== "active") redirect("/login?next=/pro");
  if (user.role !== "professional") redirect(user.role === "admin" ? "/admin" : "/account");
  const { section = [] } = await params;
  return <ProDashboard section={section} user={{ id: user.id, fullName: user.fullName, role: user.role, phone: user.phone, phoneVerified: user.phoneVerified, avatarUrl: user.avatarUrl }} />;
}
