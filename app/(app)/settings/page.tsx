import { redirect } from "next/navigation";
import { repo } from "@/lib/repo";
import { getTenantCompanies } from "@/lib/tenantCompanies";
import { listUsers } from "@/lib/tenant";
import { getSession } from "@/lib/currentUser";
import { listEmployees } from "@/lib/payroll";
import { PageHeader, Card } from "@/components/ui";
import SettingsClient from "@/components/SettingsClient";
import CatalogClient from "@/components/CatalogClient";
import UsersClient from "@/components/UsersClient";
import EmployeesClient from "@/components/EmployeesClient";
import { isMyinvoisConfigured, myinvoisEnvLabel } from "@/lib/myinvois";

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

        <Card title="MyInvois e-Invoice (LHDN)">
          <div className="flex items-start gap-3">
            <span
              className={`mt-0.5 h-2.5 w-2.5 rounded-full shrink-0 ${isMyinvoisConfigured() ? "bg-profit" : "bg-warn"}`}
              aria-hidden="true"
            />
            <div className="text-[13px] text-muted space-y-1.5">
              {isMyinvoisConfigured() ? (
                <>
                  <p className="text-ink font-medium">Connected — {myinvoisEnvLabel()}</p>
                  <p>
                    Each invoice card on a transaction page has a <b>Submit e-Invoice</b> action. Validated
                    invoices print with a genuine LHDN mark; unsubmitted invoices carry no e-Invoice marks.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-ink font-medium">Not connected</p>
                  <p>
                    To enable: register an ERP/intermediary on the LHDN MyTax portal, then set{" "}
                    <code className="bg-canvas px-1 rounded">MYINVOIS_CLIENT_ID</code> and{" "}
                    <code className="bg-canvas px-1 rounded">MYINVOIS_CLIENT_SECRET</code> on the server
                    (plus <code className="bg-canvas px-1 rounded">MYINVOIS_ENV=production</code> when going live —
                    the default is the LHDN sandbox).
                  </p>
                  <p>Until then, invoices print without any LHDN marks — no placeholder validation badges.</p>
                </>
              )}
            </div>
          </div>
        </Card>

        <SettingsClient companies={companies} products={products} rules={rules} />
      </div>
    </>
  );
}
