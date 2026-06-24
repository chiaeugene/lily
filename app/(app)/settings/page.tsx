import { repo } from "@/lib/repo";
import { PageHeader } from "@/components/ui";
import SettingsClient from "@/components/SettingsClient";

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" sub="Company details and the margins that drive the invoice cascade" />
      <div className="p-8 max-w-[1200px] w-full">
        <SettingsClient
          companies={repo.listCompanies()}
          products={repo.listProducts()}
          rules={repo.listMarginRules()}
        />
      </div>
    </>
  );
}
