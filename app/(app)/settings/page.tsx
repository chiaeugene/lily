import { redirect } from "next/navigation";
import { repo } from "@/lib/repo";
import { getTenantCompanies } from "@/lib/tenantCompanies";
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

  // The tenant's OWN companies — repo.listCompanies() returns the static Tien
  // Ngai trio and was showing every tenant three businesses that aren't theirs.
  const [companies, products, rules, customers, users, employees] = await Promise.all([
    getTenantCompanies(),
    repo.listProducts(),
    repo.listMarginRules(),
    repo.listCustomers(),
    listUsers(session.tenant.id),
    listEmployees(),
  ]);

  return (
    <>
      <PageHeader
        title="Settings"
        sub={
          companies.length > 1
            ? "Customers, products, company details and the margins that drive the cascade"
            : "Customers, products, staff and your company details"
        }
      />
      <div className="p-4 md:p-8 max-w-[1200px] w-full mx-auto space-y-6">
        <UsersClient users={users} currentUserId={session.user.id} />
        <EmployeesClient employees={employees} />
        <CatalogClient customers={customers} products={products} />
        <SettingsClient companies={companies} products={products} rules={rules} />
      </div>
    </>
  );
}
