import React from "react";
import { Plus, Wallet, FileText, PieChart, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { useDatabase } from "../database/DatabaseContext";

export function FinanceView() {
  const db = useDatabase();
  const { totalRevenue, totalExpenses, netProfit, expenses, settings } = db;

  const netBalance = totalRevenue - totalExpenses;

  return (
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200 border-b border-slate-200 bg-white">
        <FinanceCard 
          label="Total Amount Collected" 
          amount={totalRevenue} 
          icon={<ArrowUpCircle className="w-8 h-8 text-green-500" />}
          description="From all vehicle types"
        />
        <FinanceCard 
          label="Total Expenses" 
          amount={totalExpenses} 
          icon={<ArrowDownCircle className="w-8 h-8 text-red-400" />}
          description="Hosting, paper, maintenance"
        />
        <FinanceCard 
          label="Net Balance" 
          amount={netBalance} 
          icon={<Wallet className="w-8 h-8 text-[#1E7F5C]" />}
          description="Collected minus expenses"
          isMain
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 flex-1 bg-white">
        {/* Expenses Table */}
        <div className="p-8 lg:p-12">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-black text-slate-800 uppercase">Expense Logs</h3>
            <button className="flex items-center gap-2 text-[#1E7F5C] font-black text-sm hover:underline">
              <Plus className="w-4 h-4" /> ADD EXPENSE
            </button>
          </div>
          <div className="space-y-4">
            {expenses.map(item => (
              <div key={item.id} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white flex items-center justify-center text-slate-400 border border-slate-100">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">{item.label}</p>
                    <p className="text-xs text-slate-400 font-bold uppercase">{item.category} &bull; {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                  </div>
                </div>
                <p className="font-black text-red-400">-₱{item.amount.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing Strategy */}
        <div className="p-8 lg:p-12">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-black text-slate-800 uppercase">Pricing Tiers</h3>
            <PieChart className="w-6 h-6 text-slate-300" />
          </div>
          <div className="grid grid-cols-1 gap-4">
            <PriceTile label="Car Parking" price={settings.carPrice} color="bg-green-100 text-green-700" />
            <PriceTile label="Motorcycle" price={settings.motorcyclePrice} color="bg-orange-100 text-orange-700" />
            <PriceTile label="E-Bike" price={settings.ebikePrice} color="bg-indigo-100 text-indigo-700" />
          </div>
          <div className="mt-8 p-6 bg-slate-50 border border-dashed border-slate-200">
            <p className="text-sm font-bold text-slate-500 text-center italic">
              "To update pricing, go to the Settings tab"
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FinanceCard({ label, amount, icon, description, isMain }: any) {
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
        <p className="text-4xl lg:text-5xl font-black">₱{amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        <p className={`text-xs mt-2 font-medium ${
          isMain ? "text-white/40" : "text-slate-300"
        }`}>{description}</p>
      </div>
    </div>
  );
}

function PriceTile({ label, price, color }: any) {
  return (
    <div className="flex items-center justify-between p-4 border border-slate-100">
      <div className="flex items-center gap-3">
        <div className={`px-3 py-1 text-xs font-black uppercase ${color}`}>
          {label}
        </div>
      </div>
      <p className="font-black text-slate-800 text-lg">₱{price.toFixed(2)}</p>
    </div>
  );
}