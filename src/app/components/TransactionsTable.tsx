import React from "react";
import { Search, Filter, Download, MoreHorizontal, ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useDatabase } from "../database/DatabaseContext";

export function TransactionsTable() {
  const db = useDatabase();
  const { transactions } = db;

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 p-8 border-b border-slate-200 bg-white">
        <div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Recent Activity</h3>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Real-time ledger updates</p>
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
            <input 
              type="text" 
              placeholder="Search ID..."
              className="w-full bg-slate-50 border border-slate-200 py-3 pl-11 pr-4 focus:ring-2 focus:ring-[#1E7F5C]/10 outline-none font-bold text-sm text-slate-600 placeholder:text-slate-300 transition-all"
            />
          </div>
          <button className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white font-black text-xs uppercase tracking-widest hover:bg-[#1E7F5C] transition-all">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      <div className="bg-white flex-1 overflow-hidden flex flex-col">
        <div className="overflow-y-auto flex-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-300">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white z-10 shadow-sm shadow-slate-100">
              <tr className="border-b border-slate-100">
                <th className="hidden lg:table-cell px-6 lg:px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Transaction</th>
                <th className="px-4 md:px-6 lg:px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Vehicle</th>
                <th className="px-4 md:px-6 lg:px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Revenue</th>
                <th className="hidden xl:table-cell px-6 lg:px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Timestamp</th>
                <th className="hidden md:table-cell px-4 md:px-6 lg:px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Status</th>
                <th className="hidden xl:table-cell px-6 lg:px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Control No.</th>
                <th className="px-4 md:px-6 lg:px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="hidden lg:table-cell px-6 lg:px-10 py-4 lg:py-6">
                    <span className="font-black text-slate-800 tracking-tighter text-sm">#{tx.id.slice(-6)}</span>
                  </td>
                  <td className="px-4 md:px-6 lg:px-10 py-4 lg:py-6">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 md:w-10 md:h-10 flex-shrink-0 flex items-center justify-center ${
                        tx.type === "Car" ? "bg-emerald-50 text-emerald-600" : 
                        tx.type === "Motorcycle" ? "bg-amber-50 text-amber-600" : "bg-indigo-50 text-indigo-600"
                      }`}>
                        <div className="w-1.5 h-1.5 bg-current" />
                      </div>
                      <span className="font-bold text-slate-700 text-sm tracking-tight">{tx.type}</span>
                    </div>
                  </td>
                  <td className="px-4 md:px-6 lg:px-10 py-4 lg:py-6">
                    <span className="font-black text-slate-800 text-sm md:text-lg">₱{tx.amount.toFixed(2)}</span>
                  </td>
                  <td className="hidden xl:table-cell px-6 lg:px-10 py-4 lg:py-6">
                    <div className="text-slate-500 font-bold text-xs uppercase tracking-tight">
                      <p>{new Date(tx.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                      <p className="text-[10px] opacity-40">{new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </td>
                  <td className="hidden md:table-cell px-4 md:px-6 lg:px-10 py-4 lg:py-6">
                    <span className="inline-flex items-center gap-2 px-3 py-1 md:px-4 md:py-1.5 bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-widest border border-emerald-100 whitespace-nowrap">
                      <div className="w-1.5 h-1.5 bg-emerald-500 animate-pulse" />
                      {tx.status}
                    </span>
                  </td>
                  <td className="hidden xl:table-cell px-6 lg:px-10 py-4 lg:py-6">
                    <span className="font-mono text-xs text-slate-400 tracking-tight">{tx.controlNumber}</span>
                  </td>
                  <td className="px-4 md:px-6 lg:px-10 py-4 lg:py-6">
                    <div className="flex justify-center">
                      <button className="w-8 h-8 md:w-10 md:h-10 text-slate-300 hover:bg-[#1E7F5C] hover:text-white transition-all flex items-center justify-center border border-transparent hover:shadow-lg hover:shadow-[#1E7F5C]/20">
                        <ArrowUpRight className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-10 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-6">
          <p className="text-slate-300 font-bold text-xs uppercase tracking-widest">Page 1 of {Math.ceil(transactions.length / 10)} &bull; {transactions.length} records</p>
          <div className="flex items-center gap-4">
            <button className="w-12 h-12 border border-slate-100 flex items-center justify-center text-slate-300 hover:bg-slate-50 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex gap-2">
              <button className="w-12 h-12 bg-[#1E7F5C] text-white font-black text-sm shadow-xl shadow-[#1E7F5C]/20">1</button>
              <button className="w-12 h-12 border border-slate-100 text-slate-400 font-black text-sm hover:bg-slate-50">2</button>
            </div>
            <button className="w-12 h-12 border border-slate-100 flex items-center justify-center text-slate-300 hover:bg-slate-50 transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
