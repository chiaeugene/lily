import { isDemoMode } from "./env";
import { getSupabaseAdmin } from "./supabase";
import type { Employee, Payslip, PayrollRun } from "./types";

// ── Statutory contribution rates ────────────────────────────────────────────
// STANDARD FLAT-RATE APPROXIMATIONS, not the official tiered KWSP/PERKESO
// wage-band tables. Close enough for a demo / rough estimate — verify against
// the official tables (or your accountant) before running real payroll.
const EPF_EMPLOYEE_RATE = 0.11;
const EPF_EMPLOYER_RATE_LOW = 0.13; // wage <= RM5,000
const EPF_EMPLOYER_RATE_HIGH = 0.12; // wage > RM5,000
const SOCSO_EMPLOYEE_RATE = 0.005;
const SOCSO_EMPLOYER_RATE = 0.0175;
const SOCSO_WAGE_CEILING = 6000;
const EIS_RATE = 0.002; // both employee and employer
const EIS_WAGE_CEILING = 6000;

export function calcStatutory(basicSalary: number, allowances: number) {
  const wage = basicSalary + allowances;
  const epfEmployee = round2(wage * EPF_EMPLOYEE_RATE);
  const epfEmployer = round2(wage * (wage <= 5000 ? EPF_EMPLOYER_RATE_LOW : EPF_EMPLOYER_RATE_HIGH));
  const socsoWage = Math.min(wage, SOCSO_WAGE_CEILING);
  const socsoEmployee = round2(socsoWage * SOCSO_EMPLOYEE_RATE);
  const socsoEmployer = round2(socsoWage * SOCSO_EMPLOYER_RATE);
  const eisWage = Math.min(wage, EIS_WAGE_CEILING);
  const eisEmployee = round2(eisWage * EIS_RATE);
  const eisEmployer = round2(eisWage * EIS_RATE);
  return { epfEmployee, epfEmployer, socsoEmployee, socsoEmployer, eisEmployee, eisEmployer };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Held on globalThis so edits persist across dev HMR reloads (same pattern as lib/staff.ts).
const g = globalThis as unknown as { __lilyEmployees?: Employee[]; __lilyPayrollRuns?: PayrollRun[] };
const DEMO_EMPLOYEES: Employee[] = g.__lilyEmployees ?? (g.__lilyEmployees = []);
const DEMO_RUNS: PayrollRun[] = g.__lilyPayrollRuns ?? (g.__lilyPayrollRuns = []);

// ── Employees ────────────────────────────────────────────────────────────────

export async function listEmployees(): Promise<Employee[]> {
  if (isDemoMode) return DEMO_EMPLOYEES;
  const { data } = await getSupabaseAdmin().from("employees").select("*").order("name");
  return (data ?? []).map(rowToEmployee);
}

export async function upsertEmployee(e: Partial<Employee> & { name: string }): Promise<Employee> {
  if (isDemoMode) {
    const id = e.id || `emp-${Date.now().toString(36)}`;
    const rec: Employee = {
      id,
      name: e.name,
      icNo: e.icNo,
      position: e.position,
      bankName: e.bankName,
      bankAccount: e.bankAccount,
      epfNo: e.epfNo,
      socsoNo: e.socsoNo,
      basicSalary: e.basicSalary ?? 0,
      active: e.active ?? true,
    };
    const i = DEMO_EMPLOYEES.findIndex((x) => x.id === id);
    if (i >= 0) DEMO_EMPLOYEES[i] = rec;
    else DEMO_EMPLOYEES.push(rec);
    return rec;
  }
  const db = getSupabaseAdmin();
  const row = {
    id: e.id || undefined,
    name: e.name,
    ic_no: e.icNo ?? null,
    position: e.position ?? null,
    bank_name: e.bankName ?? null,
    bank_account: e.bankAccount ?? null,
    epf_no: e.epfNo ?? null,
    socso_no: e.socsoNo ?? null,
    basic_salary: e.basicSalary ?? 0,
    active: e.active ?? true,
  };
  const { data, error } = await db.from("employees").upsert(row).select().single();
  if (error) throw new Error(error.message);
  return rowToEmployee(data);
}

export async function setEmployeeActive(id: string, active: boolean): Promise<void> {
  if (isDemoMode) {
    const e = DEMO_EMPLOYEES.find((x) => x.id === id);
    if (e) e.active = active;
    return;
  }
  await getSupabaseAdmin().from("employees").update({ active }).eq("id", id);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToEmployee(r: any): Employee {
  return {
    id: r.id,
    name: r.name,
    icNo: r.ic_no ?? undefined,
    position: r.position ?? undefined,
    bankName: r.bank_name ?? undefined,
    bankAccount: r.bank_account ?? undefined,
    epfNo: r.epf_no ?? undefined,
    socsoNo: r.socso_no ?? undefined,
    basicSalary: Number(r.basic_salary),
    active: r.active,
  };
}

// ── Payroll runs ─────────────────────────────────────────────────────────────

export async function listPayrollRuns(): Promise<PayrollRun[]> {
  if (isDemoMode) return [...DEMO_RUNS].sort((a, b) => b.month.localeCompare(a.month));
  const db = getSupabaseAdmin();
  const { data: runs } = await db.from("payroll_runs").select("*").order("month", { ascending: false });
  const out: PayrollRun[] = [];
  for (const r of runs ?? []) {
    const { data: slips } = await db.from("payslips").select("*").eq("payroll_run_id", r.id);
    out.push({ id: r.id, month: r.month, createdAt: r.created_at, payslips: (slips ?? []).map(rowToPayslip) });
  }
  return out;
}

export async function getPayrollRun(id: string): Promise<PayrollRun | undefined> {
  if (isDemoMode) return DEMO_RUNS.find((r) => r.id === id);
  const db = getSupabaseAdmin();
  const { data: r } = await db.from("payroll_runs").select("*").eq("id", id).single();
  if (!r) return undefined;
  const { data: slips } = await db.from("payslips").select("*").eq("payroll_run_id", id);
  return { id: r.id, month: r.month, createdAt: r.created_at, payslips: (slips ?? []).map(rowToPayslip) };
}

// Runs payroll for every active employee for the given month ("2026-07").
// Allowances/deductions/PCB default to 0 — edit individual payslips after.
export async function runPayroll(month: string, actor: string): Promise<PayrollRun> {
  const employees = (await listEmployees()).filter((e) => e.active);
  const id = `PR-${month.replace("-", "").slice(2)}`;
  const createdAt = new Date().toISOString();

  const payslips: Payslip[] = employees.map((e) => {
    const stat = calcStatutory(e.basicSalary, 0);
    const netPay = round2(
      e.basicSalary - stat.epfEmployee - stat.socsoEmployee - stat.eisEmployee,
    );
    return {
      id: `${id}-${e.id}`,
      payrollRunId: id,
      employeeId: e.id,
      employeeName: e.name,
      basicSalary: e.basicSalary,
      allowances: 0,
      deductions: 0,
      ...stat,
      pcb: 0,
      netPay,
      paidStatus: "unpaid",
    };
  });

  if (isDemoMode) {
    const run: PayrollRun = { id, month, createdAt, payslips };
    DEMO_RUNS.unshift(run);
    return run;
  }

  const db = getSupabaseAdmin();
  await db.from("payroll_runs").insert({ id, month, created_at: createdAt });
  if (payslips.length) {
    await db.from("payslips").insert(
      payslips.map((p) => ({
        id: p.id,
        payroll_run_id: p.payrollRunId,
        employee_id: p.employeeId,
        employee_name: p.employeeName,
        basic_salary: p.basicSalary,
        allowances: p.allowances,
        deductions: p.deductions,
        epf_employee: p.epfEmployee,
        epf_employer: p.epfEmployer,
        socso_employee: p.socsoEmployee,
        socso_employer: p.socsoEmployer,
        eis_employee: p.eisEmployee,
        eis_employer: p.eisEmployer,
        pcb: p.pcb,
        net_pay: p.netPay,
        paid_status: p.paidStatus,
      })),
    );
  }
  void actor; // logged by the caller via repo's shared audit log
  return { id, month, createdAt, payslips };
}

export async function markPayslipPaid(payslipId: string, paid: boolean): Promise<void> {
  if (isDemoMode) {
    for (const run of DEMO_RUNS) {
      const p = run.payslips.find((x) => x.id === payslipId);
      if (p) {
        p.paidStatus = paid ? "paid" : "unpaid";
        p.paidAt = paid ? new Date().toISOString() : undefined;
      }
    }
    return;
  }
  await getSupabaseAdmin()
    .from("payslips")
    .update({ paid_status: paid ? "paid" : "unpaid", paid_at: paid ? new Date().toISOString() : null })
    .eq("id", payslipId);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToPayslip(r: any): Payslip {
  return {
    id: r.id,
    payrollRunId: r.payroll_run_id,
    employeeId: r.employee_id,
    employeeName: r.employee_name,
    basicSalary: Number(r.basic_salary),
    allowances: Number(r.allowances),
    deductions: Number(r.deductions),
    epfEmployee: Number(r.epf_employee),
    epfEmployer: Number(r.epf_employer),
    socsoEmployee: Number(r.socso_employee),
    socsoEmployer: Number(r.socso_employer),
    eisEmployee: Number(r.eis_employee),
    eisEmployer: Number(r.eis_employer),
    pcb: Number(r.pcb),
    netPay: Number(r.net_pay),
    paidStatus: (r.paid_status as "unpaid" | "paid") ?? "unpaid",
    paidAt: r.paid_at ?? undefined,
  };
}
