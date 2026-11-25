import { notFound } from "next/navigation";
import { AdminCompanyView } from "@/app/_components/admin-company-view";
import { groupCompanies } from "@/lib/admin-companies";
import { todayInMalaysia } from "@/lib/format";
import { getAdminClients } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export default async function AdminCompanyPage({ params }: PageProps<"/admin/companies/[key]">) {
  const { key } = await params;
  const companies = groupCompanies(await getAdminClients(), todayInMalaysia());
  const company = companies.find((entry) => entry.key === key);
  if (!company) notFound();
  return <AdminCompanyView company={company} />;
}
