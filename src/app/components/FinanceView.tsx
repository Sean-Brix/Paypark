import React, { useState } from "react";
import {
  Plus,
  Wallet,
  FileText,
  PieChart,
  ArrowUpCircle,
  ArrowDownCircle,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useDatabase } from "../context/DatabaseContext";

const EXPENSE_CATEGORIES = [
  "Maintenance",
  "Supplies",
  "Utilities",
  "Operations",
  "Other",
] as const;

type ExpenseFormState = {
  label: string;
  amount: string;
  category: string;
  date: string;
  description: string;
};

function getTodayDateValue() {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function createInitialExpenseForm(): ExpenseFormState {
  return {
    label: "",
    amount: "",
    category: EXPENSE_CATEGORIES[0],
    date: getTodayDateValue(),
    description: "",
  };
}

function formatCurrency(amount: number) {
  return `${"\u20B1"}${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function FinanceView() {
  const db = useDatabase();
  const { totalRevenue, totalExpenses, netProfit, expenses, settings, addExpense } = db;
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [isSavingExpense, setIsSavingExpense] = useState(false);
  const [expenseForm, setExpenseForm] = useState<ExpenseFormState>(() => createInitialExpenseForm());

  const handleExpenseFormChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;
    setExpenseForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const openExpenseDialog = () => {
    setExpenseForm(createInitialExpenseForm());
    setIsExpenseDialogOpen(true);
  };

  const closeExpenseDialog = () => {
    if (!isSavingExpense) {
      setIsExpenseDialogOpen(false);
    }
  };

  const handleExpenseSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedLabel = expenseForm.label.trim();
    const parsedAmount = Number.parseFloat(expenseForm.amount);

    if (!trimmedLabel) {
      toast.error("Expense label is required.");
      return;
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Enter a valid expense amount.");
      return;
    }

    setIsSavingExpense(true);

    try {
      await addExpense({
        label: trimmedLabel,
        amount: parsedAmount,
        category: expenseForm.category,
        date: expenseForm.date,
        description: expenseForm.description.trim(),
      });

      toast.success("Expense added successfully.");
      setIsExpenseDialogOpen(false);
      setExpenseForm(createInitialExpenseForm());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create expense.");
    } finally {
      setIsSavingExpense(false);
    }
  };

  return (
    <>
      <div className="flex flex-col h-full">
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200 border-b border-slate-200 bg-white">
          <FinanceCard
            label="Total Amount Collected"
            amount={totalRevenue}
            icon={<ArrowUpCircle className="w-8 h-8 text-green-500" />}
            description="From all completed transactions"
          />
          <FinanceCard
            label="Total Expenses"
            amount={totalExpenses}
            icon={<ArrowDownCircle className="w-8 h-8 text-red-400" />}
            description="Hosting, paper, maintenance"
          />
          <FinanceCard
            label="Net Balance"
            amount={netProfit}
            icon={<Wallet className="w-8 h-8 text-[#1E7F5C]" />}
            description="Collected minus expenses"
            isMain
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 flex-1 bg-white">
          <div className="p-8 lg:p-12">
            <div className="flex justify-between items-center mb-8 gap-4">
              <h3 className="text-xl font-black text-slate-800 uppercase">Expense Logs</h3>
              <button
                type="button"
                onClick={openExpenseDialog}
                className="flex items-center gap-2 text-[#1E7F5C] font-black text-sm hover:underline"
              >
                <Plus className="w-4 h-4" /> ADD EXPENSE
              </button>
            </div>

            <div className="space-y-4">
              {expenses.length === 0 ? (
                <div className="border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                  <p className="text-sm font-black uppercase tracking-widest text-slate-400">No expenses recorded yet</p>
                  <p className="mt-2 text-sm text-slate-500">Use the add expense button to log your first expense.</p>
                </div>
              ) : (
                expenses.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-4 p-4 bg-slate-50 border border-slate-100">
                    <div className="flex items-start gap-4 min-w-0">
                      <div className="w-12 h-12 shrink-0 bg-white flex items-center justify-center text-slate-400 border border-slate-100">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800">{item.label}</p>
                        <p className="text-xs text-slate-400 font-bold uppercase">
                          {item.category} &bull; {new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                        {item.description ? (
                          <p className="mt-1 text-sm text-slate-500 line-clamp-1">{item.description}</p>
                        ) : null}
                      </div>
                    </div>
                    <p className="font-black text-red-400 shrink-0">-{formatCurrency(item.amount)}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="p-8 lg:p-12">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-black text-slate-800 uppercase">Pricing Tiers</h3>
              <PieChart className="w-6 h-6 text-slate-300" />
            </div>
            <div className="grid grid-cols-1 gap-4">
              <PriceTile label="Car Parking" price={settings?.carPrice ?? 0} color="bg-green-100 text-green-700" />
              <PriceTile label="Motorcycle" price={settings?.motorcyclePrice ?? 0} color="bg-orange-100 text-orange-700" />
              <PriceTile label="E-Bike" price={settings?.ebikePrice ?? 0} color="bg-indigo-100 text-indigo-700" />
            </div>
            <div className="mt-8 p-6 bg-slate-50 border border-dashed border-slate-200">
              <p className="text-sm font-bold text-slate-500 text-center italic">
                "To update pricing, go to the Settings tab"
              </p>
            </div>
          </div>
        </div>
      </div>

      {isExpenseDialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-6"
          onClick={closeExpenseDialog}
        >
          <div
            className="w-full max-w-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-8 py-6">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-[#1E7F5C]">Finance</p>
                <h3 className="text-2xl font-black text-slate-800 uppercase">Add Expense</h3>
              </div>
              <button
                type="button"
                onClick={closeExpenseDialog}
                className="flex h-11 w-11 items-center justify-center border border-slate-200 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExpenseSubmit} className="space-y-6 px-8 py-8">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Expense Label</label>
                <input
                  type="text"
                  name="label"
                  value={expenseForm.label}
                  onChange={handleExpenseFormChange}
                  placeholder="Receipt paper refill"
                  className="w-full border-2 border-slate-100 bg-slate-50 px-5 py-4 font-bold text-slate-700 outline-none transition-all focus:border-[#1E7F5C]"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Amount</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    name="amount"
                    value={expenseForm.amount}
                    onChange={handleExpenseFormChange}
                    placeholder="0.00"
                    className="w-full border-2 border-slate-100 bg-slate-50 px-5 py-4 font-bold text-slate-700 outline-none transition-all focus:border-[#1E7F5C]"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Category</label>
                  <select
                    name="category"
                    value={expenseForm.category}
                    onChange={handleExpenseFormChange}
                    className="w-full border-2 border-slate-100 bg-slate-50 px-5 py-4 font-bold text-slate-700 outline-none transition-all focus:border-[#1E7F5C]"
                  >
                    {EXPENSE_CATEGORIES.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Date</label>
                  <input
                    type="date"
                    name="date"
                    value={expenseForm.date}
                    onChange={handleExpenseFormChange}
                    className="w-full border-2 border-slate-100 bg-slate-50 px-5 py-4 font-bold text-slate-700 outline-none transition-all focus:border-[#1E7F5C]"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Description</label>
                <textarea
                  name="description"
                  value={expenseForm.description}
                  onChange={handleExpenseFormChange}
                  placeholder="Optional notes about this expense"
                  rows={4}
                  className="w-full resize-none border-2 border-slate-100 bg-slate-50 px-5 py-4 font-medium text-slate-700 outline-none transition-all focus:border-[#1E7F5C]"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeExpenseDialog}
                  disabled={isSavingExpense}
                  className="px-6 py-4 border-2 border-slate-200 text-slate-500 font-black text-sm hover:border-slate-300 hover:text-slate-700 transition-all disabled:opacity-50"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={isSavingExpense}
                  className="px-6 py-4 bg-[#1E7F5C] text-white font-black text-sm shadow-lg shadow-green-900/20 hover:bg-[#166347] transition-all disabled:opacity-50"
                >
                  {isSavingExpense ? "SAVING..." : "SAVE EXPENSE"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

function FinanceCard({
  label,
  amount,
  icon,
  description,
  isMain,
}: {
  label: string;
  amount: number;
  icon: React.ReactNode;
  description: string;
  isMain?: boolean;
}) {
  return (
    <div className={`p-8 lg:p-12 flex flex-col justify-between h-56 transition-colors ${
      isMain ? "bg-[#1E7F5C] text-white" : "bg-white hover:bg-slate-50/50"
    }`}>
      <div className="flex justify-between items-start">
        {icon}
        <div className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
          isMain ? "bg-white/20 text-white" : "bg-slate-50 text-slate-400 border border-slate-200"
        }`}>
          Updated Now
        </div>
      </div>
      <div>
        <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${
          isMain ? "text-white/60" : "text-slate-400"
        }`}>{label}</p>
        <p className="text-4xl lg:text-5xl font-black">{formatCurrency(amount)}</p>
        <p className={`text-xs mt-2 font-medium ${
          isMain ? "text-white/40" : "text-slate-300"
        }`}>{description}</p>
      </div>
    </div>
  );
}

function PriceTile({
  label,
  price,
  color,
}: {
  label: string;
  price: number;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between p-4 border border-slate-100">
      <div className="flex items-center gap-3">
        <div className={`px-3 py-1 text-xs font-black uppercase ${color}`}>
          {label}
        </div>
      </div>
      <p className="font-black text-slate-800 text-lg">{formatCurrency(price)}</p>
    </div>
  );
}
