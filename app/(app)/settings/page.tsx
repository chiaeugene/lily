import { redirect } from "next/navigation";
import { repo } from "@/lib/repo";
import { listUsers } from "@/lib/tenant";
import { getSession } from "@/lib/currentUser";
import { listEmployees } from "@/lib/payroll";
import { PageHeader } from "@/components/ui";
import SettingsClient from "@/components/SettingsClient";
import CatalogClient from "@/components/CatalogClient";
import UsersClient from "@/components/UsersClient";
import EmployeesClient from "@/components/EmployeesClient";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [companies, products, rules, customers, users, employees] = await Promise.all([
    repo.listCompanies(),
    repo.listProducts(),
    repo.listMarginRules(),
    repo.listCustomers(),
    listUsers(session.tenant.id),
    listEmployees(),
  ]);

  return (
    <>
      <PageHeader title="Settings" sub="Customers, products, company details and the margins that drive the cascade" />
      <div className="p-4 md:p-8 max-w-[1200px] w-full mx-auto space-y-6">
        <UsersClient users={users} currentUserId={session.user.id} />
        <EmployeesClient employees={employees} />
        <CatalogClient customers={customers} products={products} />
        <SettingsClient companies={companies} products={products} rules={rules} />
      </div>
    </>
  );
}
