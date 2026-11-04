import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { CustomerDashboard } from "@/components/dashboard/Views";

export default async function AccountPage({ params }: { params: Promise<{ section?: string[] }> }) {
  const user = await getCurrentUser();
  if (!user || user.status !== "active") redirect("/login?next=/account");
  if (user.role !== "customer") redirect(user.role === "admin" ? "/admin" : "/pro");
  const { section = [] } = await params;
  return <CustomerDashboard section={section} user={{ id: user.id, fullName: user.fullName, role: user.role, phone: user.phone, phoneVerified: user.phoneVerified, avatarUrl: user.avatarUrl }} />;
}
