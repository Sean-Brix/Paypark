import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Car, Bike, Zap, ArrowLeft, Printer, CheckCircle2, Coins, Pointer } from "lucide-react";
import { toast } from "sonner";
import schoolLogo from "../../assets/logo.png";
import { useDatabase, type Transaction } from "../context/DatabaseContext";
import { apiClient } from "../api/client";

const iconMap: Record<string, React.ElementType> = { Car, Bike, Zap };

type KioskState = "idle" | "selecting" | "paying" | "printing" | "thankyou";

export function KioskView() {
  const db = useDatabase();
  const [state, setState] = useState<KioskState>("idle");
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [price, setPrice] = useState(0);
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);
  const [paymentStartedAt, setPaymentStartedAt] = useState<number | null>(null);
  const [insertedAmount, setInsertedAmount] = useState(0);

  const [themeIndex, setThemeIndex] = useState(0);

  const themes = [
    { bg: "#F5F7F6", primary: "#1E7F5C", secondary: "#F4B740", accent: "rgba(30, 127, 92, 0.4)" },
    { bg: "#F1F5F9", primary: "#1E3A8A", secondary: "#3B82F6", accent: "rgba(30, 58, 138, 0.4)" },
    { bg: "#FAF7ED", primary: "#78350F", secondary: "#D97706", accent: "rgba(120, 53, 15, 0.4)" }
  ];

  const currentTheme = themes[themeIndex];

  useEffect(() => {
    if (state !== "idle") {
      setThemeIndex(0);
      return;
    }
    
    const interval = setInterval(() => {
      setThemeIndex((prev) => (prev + 1) % themes.length);
    }, 15000);
    
    return () => clearInterval(interval);
  }, [state, themes.length]);

  const startSession = () => setState("selecting");
  
  const selectVehicle = async (type: string, amount: number) => {
    try {
      const payment = await apiClient.sendPaymentWebhook({
        kioskId: "KIOSK-001",
        vehicleType: type,
        targetAmount: amount,
      });

      setSelectedVehicle(type);
      setPrice(amount);
      setLastTransaction(null);
      setPaymentStartedAt(Date.now());
      setInsertedAmount(Number(payment.totalInserted || 0));
      setState("paying");
    } catch {
      toast.error("Unable to start payment session. Please try again.");
    }
  };

  useEffect(() => {
    if (state !== "paying") {
      return;
    }

    let isCancelled = false;
    const startedAt = paymentStartedAt ?? Date.now();
    const timeoutMs = 120000;
    const pollIntervalMs = 1500;
    const timeoutAt = startedAt + timeoutMs;

    const finalizeSuccess = (tx: Transaction) => {
      setLastTransaction(tx);
      setState("printing");

      setTimeout(() => {
        setState("thankyou");

        setTimeout(() => {
          setState("idle");
          setSelectedVehicle(null);
          setLastTransaction(null);
          setPaymentStartedAt(null);
          setInsertedAmount(0);
        }, 5000);
      }, 7000);
    };

    const pollForWebhookPayment = async () => {
      if (isCancelled || Date.now() >= timeoutAt) {
        if (!isCancelled) {
          toast.error("Payment timeout. No webhook signal received.");
          setState("selecting");
        }
        return;
      }

      try {
        const result = await apiClient.getTransactions(1, 20, {
          type: selectedVehicle || undefined,
          dateFrom: new Date(startedAt - 2000).toISOString(),
        });

        const current = result.transactions.find((tx) => {
          const txTime = new Date(tx.timestamp).getTime();
          return txTime >= startedAt - 2000;
        });

        if (current) {
          const total = Number(current.amount || 0);
          setInsertedAmount(total);

          const isPaid = current.status === "Success" || total >= price;
          if (isPaid) {
            finalizeSuccess(current);
            return;
          }
        } else {
          setInsertedAmount(0);
        }

        if (insertedAmount >= price) {
          const fallbackTx: Transaction = {
            id: crypto.randomUUID(),
            kioskId: "KIOSK-001",
            type: selectedVehicle || "Unknown",
            amount: insertedAmount,
            status: "Success",
            controlNumber: "ESP-PAYMENT",
            timestamp: new Date().toISOString(),
            notes: "",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          finalizeSuccess(fallbackTx);
          return;
        }
      } catch {
        // Keep polling through temporary network errors.
      }

      if (!isCancelled) {
        setTimeout(pollForWebhookPayment, pollIntervalMs);
      }
    };

    pollForWebhookPayment();

    return () => {
      isCancelled = true;
    };
  }, [state, selectedVehicle, price, paymentStartedAt, insertedAmount]);

  const enabledVehicles = db.vehicles.filter(v => v.enabled);

  const getPriceForVehicle = (priceKey: string): number => {
    return (db.settings as any)[priceKey] ?? 0;
  };

  return (
    <motion.div 
      animate={{ backgroundColor: currentTheme.bg }}
      transition={{ duration: 1 }}
      className="relative w-full h-full flex flex-col items-center justify-center p-[3vmin] overflow-hidden"
    >
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          animate={{ x: [0, 80, -40, 0], y: [0, -60, 40, 0], scale: [1, 1.15, 0.95, 1] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-[10%] -left-[5%] w-[70%] h-[70%] rounded-full blur-[100px] opacity-25"
          style={{ backgroundColor: currentTheme.primary }}
        />
        <motion.div 
          animate={{ x: [0, -100, 50, 0], y: [0, 80, -30, 0], scale: [1, 1.1, 1.15, 1] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear", delay: 1 }}
          className="absolute -bottom-[15%] -right-[5%] w-[80%] h-[80%] rounded-full blur-[120px] opacity-20"
          style={{ backgroundColor: currentTheme.secondary }}
        />
        
        <div className="absolute inset-0 z-0 overflow-hidden">
          {[...Array(10)].map((_, i) => {
            const Icon = [Car, Bike, Zap, Coins][i % 4];
            const size = 30 + (i * 8);
            return (
              <motion.div
                key={`bg-icon-${i}`}
                className="absolute"
                style={{ left: `${(i * 19) % 100}%`, top: `${(i * 27) % 100}%`, color: currentTheme.primary, opacity: 0.04 }}
                animate={{ y: [0, -30, 0], x: [0, 15, 0], rotate: [0, 180, 360] }}
                transition={{ duration: 20 + i, repeat: Infinity, ease: "linear", delay: i * 0.7 }}
              >
                <Icon size={size} />
              </motion.div>
            );
          })}

          {[...Array(6)].map((_, i) => (
            <motion.div
              key={`bg-shape-${i}`}
              className="absolute rounded-full"
              style={{ 
                width: 80 + (i * 30), height: 80 + (i * 30),
                left: `${(i * 17) % 100}%`, top: `${(i * 37) % 100}%`,
                background: `linear-gradient(135deg, ${currentTheme.primary}08, ${currentTheme.secondary}08)`,
                border: `1px solid ${currentTheme.primary}15`,
              }}
              animate={{ y: [0, 50, 0], x: [0, -30, 0], rotate: [0, -180, 0], scale: [1, 1.1, 1] }}
              transition={{ duration: 15 + i, repeat: Infinity, ease: "linear", delay: i * 0.4 }}
            />
          ))}

          <div className="absolute inset-0 opacity-[0.1]">
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={`dot-${i}`}
                className="absolute w-1 h-1 rounded-full bg-white"
                style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%` }}
                animate={{ opacity: [0.2, 1, 0.2], scale: [1, 2, 1], y: [0, -100] }}
                transition={{ duration: 5 + Math.random() * 5, repeat: Infinity, ease: "linear", delay: Math.random() * 5 }}
              />
            ))}
          </div>
        </div>

        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
             style={{ backgroundImage: `radial-gradient(${currentTheme.primary} 1.5px, transparent 0)`, backgroundSize: '40px 40px' }} />
      </div>

      <AnimatePresence mode="wait">
        {/* ── IDLE ─────────────────────────────────────────────── */}
        {state === "idle" && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 flex flex-col items-center justify-center text-center cursor-pointer w-full h-full"
            onClick={startSession}
          >
            <div className="flex items-center justify-center mb-[3vmin]">
              <motion.img
                src={schoolLogo}
                alt="School Logo"
                className="w-[clamp(6rem,15vmin,12rem)] h-[clamp(6rem,15vmin,12rem)] rounded-full object-cover shadow-2xl ring-6 ring-white/20"
                animate={{ scale: [1, 1.03, 1] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
            
            <motion.h1 
              animate={{ color: currentTheme.primary }}
              className="font-black mb-1 transition-colors duration-1000 drop-shadow-sm"
              style={{ fontSize: "clamp(2rem, 6vmin, 4.5rem)" }}
            >
              CVSU-CCAT
            </motion.h1>
            <motion.h1 
              animate={{ color: currentTheme.primary }}
              className="font-black mb-[2vmin] transition-colors duration-1000 drop-shadow-sm"
              style={{ fontSize: "clamp(2rem, 6vmin, 4.5rem)" }}
            >
              PAY-PARKING
            </motion.h1>
            
            <p 
              className="text-slate-500 font-medium opacity-80 uppercase tracking-[0.2em] mb-[4vmin]"
              style={{ fontSize: "clamp(0.75rem, 2vmin, 1.25rem)" }}
            >
              Convenient &bull; Secure &bull; Professional
            </p>
            
            <div className="flex flex-col items-center">
              <motion.div 
                animate={{ color: currentTheme.primary, scale: [1, 1.05, 1] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="mb-[2vmin]"
              >
                <Pointer style={{ width: "clamp(2.5rem, 6vmin, 5rem)", height: "clamp(2.5rem, 6vmin, 5rem)" }} className="-rotate-12" />
              </motion.div>
              
              <motion.div
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="px-[3vmin] py-[1vmin] rounded-full border-2 border-dashed font-black tracking-widest uppercase"
                style={{ 
                  color: currentTheme.primary,
                  borderColor: `${currentTheme.primary}40`,
                  fontSize: "clamp(0.75rem, 2vmin, 1.25rem)",
                }}
              >
                Touch Anywhere to Start
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* ── SELECTING ───────────────────────────────────────── */}
        {state === "selecting" && (
          <motion.div
            key="selecting"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full h-full flex flex-col relative z-10 px-[2vmin]"
          >
            <div className="flex justify-between items-center mb-[3vmin] shrink-0">
              <motion.button 
                whileHover={{ x: -5 }}
                onClick={() => setState("idle")}
                className="flex items-center gap-[1vmin] px-[2vmin] py-[1.2vmin] rounded-2xl bg-white shadow-sm text-slate-400 hover:text-[#1E7F5C] transition-all font-black tracking-[0.2em] border border-slate-100"
                style={{ fontSize: "clamp(0.6rem, 1.2vmin, 0.85rem)" }}
              >
                <ArrowLeft style={{ width: "clamp(0.875rem, 1.5vmin, 1.25rem)", height: "clamp(0.875rem, 1.5vmin, 1.25rem)" }} /> CANCEL
              </motion.button>
              <div className="text-center">
                <h2 
                  className="font-black text-slate-800 tracking-tight uppercase"
                  style={{ fontSize: "clamp(1.25rem, 4vmin, 2.75rem)" }}
                >
                  Vehicle Selection
                </h2>
                <div className="flex justify-center gap-1.5 mt-[0.5vmin]">
                  <div className="h-[0.4vmin] min-h-[2px] w-[4vmin] bg-[#1E7F5C] rounded-full" />
                  <div className="h-[0.4vmin] min-h-[2px] w-[1.5vmin] bg-[#F4B740] rounded-full" />
                </div>
              </div>
              <div style={{ width: "clamp(4rem, 8vmin, 8rem)" }} />
            </div>

            <div 
              className="grid gap-[2vmin] flex-1 min-h-0"
              style={{ gridTemplateColumns: `repeat(${enabledVehicles.length}, 1fr)` }}
            >
              {enabledVehicles.map((vehicle) => {
                const Icon = iconMap[vehicle.icon] || Car;
                const vehiclePrice = getPriceForVehicle(vehicle.priceKey);
                return (
                  <motion.button
                    key={vehicle.id}
                    whileHover={{ y: -8, scale: 1.01 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => selectVehicle(vehicle.type, vehiclePrice)}
                    className="relative group bg-white rounded-[clamp(1rem,3vmin,2.5rem)] p-[3vmin] flex flex-col items-center justify-between shadow-xl border-2 border-transparent hover:border-[#1E7F5C]/10 transition-all overflow-hidden"
                  >
                    <div 
                      className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-[0.03] group-hover:scale-150 transition-transform duration-700"
                      style={{ backgroundColor: vehicle.color }}
                    />
                    
                    <div 
                      className="rounded-[clamp(0.75rem,2vmin,1.5rem)] flex items-center justify-center mb-[2vmin] shadow-lg group-hover:scale-110 transition-transform duration-500"
                      style={{ 
                        backgroundColor: `${vehicle.color}15`, color: vehicle.color,
                        width: "clamp(3.5rem, 8vmin, 7rem)", height: "clamp(3.5rem, 8vmin, 7rem)",
                      }}
                    >
                      <Icon style={{ width: "clamp(1.75rem, 4vmin, 3.5rem)", height: "clamp(1.75rem, 4vmin, 3.5rem)" }} />
                    </div>
                    
                    <div className="text-center mb-[2vmin]">
                      <span 
                        className="block font-black text-slate-800 mb-0.5 tracking-tight uppercase"
                        style={{ fontSize: "clamp(1rem, 3vmin, 2rem)" }}
                      >
                        {vehicle.label}
                      </span>
                      <span 
                        className="text-slate-400 font-bold tracking-[0.2em] uppercase"
                        style={{ fontSize: "clamp(0.5rem, 1vmin, 0.7rem)" }}
                      >
                        {vehicle.sub}
                      </span>
                    </div>

                    <div className="w-full bg-slate-50 rounded-[clamp(0.75rem,2vmin,1.5rem)] p-[2vmin] group-hover:bg-white group-hover:shadow-inner transition-all border border-slate-100/50">
                      <p 
                        className="font-black text-slate-400 mb-0.5 uppercase tracking-widest"
                        style={{ fontSize: "clamp(0.45rem, 0.9vmin, 0.65rem)" }}
                      >
                        Entry Fee
                      </p>
                      <div className="font-black" style={{ color: vehicle.color, fontSize: "clamp(1.5rem, 5vmin, 3.5rem)" }}>
                        <span style={{ fontSize: "0.5em", marginRight: "0.15em" }}>&#8369;</span>{vehiclePrice}
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
            
            <div className="mt-[2vmin] mb-[1vmin] flex items-center justify-center gap-[1vmin] text-slate-300 shrink-0">
              <div className="w-[4vmin] h-[1px] bg-slate-200" />
              <p 
                className="font-black uppercase tracking-[0.4em] text-slate-400"
                style={{ fontSize: "clamp(0.45rem, 0.9vmin, 0.65rem)" }}
              >
                Secure Entry Kiosk
              </p>
              <div className="w-[4vmin] h-[1px] bg-slate-200" />
            </div>
          </motion.div>
        )}

        {/* ── PAYING ──────────────────────────────────────────── */}
        {state === "paying" && (
          <motion.div
            key="paying"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="flex flex-col items-center justify-center text-center relative z-10"
          >
            <div 
              className="rounded-full bg-slate-100 flex items-center justify-center mb-[4vmin] relative"
              style={{ width: "clamp(6rem, 14vmin, 12rem)", height: "clamp(6rem, 14vmin, 12rem)" }}
            >
              <Coins style={{ width: "clamp(3rem, 7vmin, 6rem)", height: "clamp(3rem, 7vmin, 6rem)" }} className="text-[#F4B740]" />
              <motion.div 
                className="absolute inset-0 border-4 border-[#1E7F5C] rounded-full border-t-transparent"
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              />
            </div>
            <h2 
              className="font-black text-slate-800 mb-[1.5vmin] uppercase"
              style={{ fontSize: "clamp(1.5rem, 4vmin, 3rem)" }}
            >
              WAITING FOR COINS
            </h2>
            <p 
              className="text-slate-500 mb-[2vmin]"
              style={{ fontSize: "clamp(0.875rem, 2vmin, 1.25rem)" }}
            >
              Please insert exact amount:
            </p>
            <div className="font-black text-[#1E7F5C]" style={{ fontSize: "clamp(2.5rem, 8vmin, 5.5rem)" }}>
              &#8369;{price.toFixed(2)}
            </div>
            <div className="mt-[1.5vmin] text-slate-600 font-bold" style={{ fontSize: "clamp(0.85rem, 1.8vmin, 1.1rem)" }}>
              Inserted: <span className="text-[#1E7F5C]">&#8369;{insertedAmount.toFixed(2)}</span>
            </div>
            <div className="mt-[0.5vmin] text-slate-500" style={{ fontSize: "clamp(0.75rem, 1.4vmin, 0.95rem)" }}>
              Remaining: &#8369;{Math.max(0, price - insertedAmount).toFixed(2)}
            </div>
            <p className="mt-[4vmin] text-slate-400 italic" style={{ fontSize: "clamp(0.7rem, 1.3vmin, 0.9rem)" }}>
              Do not leave until receipt is printed.
            </p>
          </motion.div>
        )}

        {/* ── PRINTING ────────────────────────────────────────── */}
        {state === "printing" && (
          <motion.div
            key="printing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-2 gap-[4vmin] items-center w-full h-full px-[4vmin] relative z-10"
          >
            <div className="flex flex-col items-start text-left justify-center">
              <div 
                className="bg-green-100 text-[#1E7F5C] rounded-full flex items-center justify-center mb-[2vmin]"
                style={{ width: "clamp(3.5rem, 7vmin, 6rem)", height: "clamp(3.5rem, 7vmin, 6rem)" }}
              >
                <CheckCircle2 style={{ width: "clamp(2rem, 4vmin, 3.5rem)", height: "clamp(2rem, 4vmin, 3.5rem)" }} />
              </div>
              <h2 
                className="font-black text-slate-800 mb-[1.5vmin] uppercase leading-tight"
                style={{ fontSize: "clamp(1.5rem, 4.5vmin, 3.5rem)" }}
              >
                PAYMENT<br/>SUCCESSFUL
              </h2>
              <div 
                className="flex items-center gap-[1vmin] text-slate-500 font-bold mb-[3vmin]"
                style={{ fontSize: "clamp(0.875rem, 2vmin, 1.5rem)" }}
              >
                <Printer style={{ width: "clamp(1rem, 2vmin, 1.5rem)", height: "clamp(1rem, 2vmin, 1.5rem)" }} className="animate-bounce" />
                PRINTING RECEIPT...
              </div>
              <div className="bg-black/5 p-[2.5vmin] rounded-2xl w-full border border-black/5">
                <p className="text-slate-400 font-bold mb-0.5" style={{ fontSize: "clamp(0.5rem, 1vmin, 0.75rem)" }}>VEHICLE TYPE</p>
                <p className="font-black text-[#1E7F5C] mb-[1.5vmin]" style={{ fontSize: "clamp(1rem, 2.5vmin, 1.75rem)" }}>{selectedVehicle}</p>
                <p className="text-slate-400 font-bold mb-0.5" style={{ fontSize: "clamp(0.5rem, 1vmin, 0.75rem)" }}>AMOUNT PAID</p>
                <p className="font-black text-slate-800" style={{ fontSize: "clamp(1rem, 2.5vmin, 1.75rem)" }}>&#8369;{price.toFixed(2)}</p>
              </div>
            </div>

            <div className="flex justify-center items-center">
              <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5, type: "spring" }}
                className="bg-white shadow-2xl rounded-sm rotate-2 relative font-mono text-slate-800 border-t-6 border-slate-100"
                style={{ width: "clamp(14rem, 22vmin, 22rem)", padding: "clamp(1rem, 2.5vmin, 2rem)" }}
              >
                {/* Receipt Header */}
                <div className="text-center mb-[1.5vmin]">
                  <div className="flex items-center justify-center gap-[0.75vmin] mb-[0.75vmin]">
                    <div 
                      className="bg-[#1E7F5C] rounded-lg flex items-center justify-center text-white font-black"
                      style={{ width: "clamp(1.5rem, 3vmin, 2.5rem)", height: "clamp(1.5rem, 3vmin, 2.5rem)", fontSize: "clamp(0.75rem, 1.5vmin, 1.25rem)" }}
                    >
                      P
                    </div>
                    <h3 
                      className="font-black tracking-tight text-slate-900"
                      style={{ fontSize: "clamp(0.875rem, 1.8vmin, 1.25rem)" }}
                    >
                        {db.settings?.receiptHeader || "PAY-PARK"}
                    </h3>
                  </div>
                  <div className="border-b-2 border-dashed border-slate-200 w-full my-[0.5vmin]" />
                </div>

                {/* Receipt Body */}
                <div className="space-y-[1vmin]">
                  <div className="flex justify-between items-center bg-slate-50 p-[0.5vmin] rounded">
                    <span className="font-bold text-slate-500" style={{ fontSize: "clamp(0.5rem, 0.9vmin, 0.65rem)" }}>VEHICLE:</span>
                    <span className="font-black uppercase" style={{ fontSize: "clamp(0.55rem, 1vmin, 0.75rem)" }}>{selectedVehicle}</span>
                  </div>

                  <div className="flex justify-between items-center px-[0.5vmin]">
                    <span className="font-bold text-slate-500" style={{ fontSize: "clamp(0.5rem, 0.9vmin, 0.65rem)" }}>AMOUNT:</span>
                    <span className="font-black" style={{ fontSize: "clamp(0.65rem, 1.2vmin, 0.875rem)" }}>&#8369;{price.toFixed(2)}</span>
                  </div>
                  
                  <div className="space-y-[0.5vmin] pt-[0.5vmin]">
                    <span className="font-bold text-slate-500 block text-center" style={{ fontSize: "clamp(0.5rem, 0.9vmin, 0.65rem)" }}>CONTROL NUMBER:</span>
                    <p className="font-black tracking-widest bg-slate-50 p-[0.4vmin] rounded text-center" style={{ fontSize: "clamp(0.5rem, 0.9vmin, 0.65rem)" }}>
                      {lastTransaction?.controlNumber || "---"}
                    </p>
                  </div>
                </div>

                {/* Receipt Footer */}
                <div className="text-center mt-[2vmin]">
                  <div className="border-b-2 border-dashed border-slate-200 w-full my-[0.5vmin]" />
                  <p 
                    className="font-black tracking-[0.2em] opacity-80 mt-[0.5vmin] uppercase"
                    style={{ fontSize: "clamp(0.75rem, 1.5vmin, 1.125rem)" }}
                  >
                    THANK YOU
                  </p>
                  <p className="text-slate-400 mt-[0.25vmin]" style={{ fontSize: "clamp(0.4rem, 0.7vmin, 0.5rem)" }}>{db.settings?.receiptFooter || "Drive safely"}</p>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* ── THANK YOU ───────────────────────────────────────── */}
        {state === "thankyou" && (
          <motion.div
            key="thankyou"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="flex flex-col items-center justify-center text-center relative z-10"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.2, 1] }}
              transition={{ duration: 0.8, times: [0, 0.7, 1] }}
              className="bg-[#1E7F5C] rounded-full flex items-center justify-center mb-[4vmin] shadow-2xl"
              style={{ width: "clamp(5rem, 12vmin, 9rem)", height: "clamp(5rem, 12vmin, 9rem)" }}
            >
              <CheckCircle2 style={{ width: "clamp(2.5rem, 6vmin, 4.5rem)", height: "clamp(2.5rem, 6vmin, 4.5rem)" }} className="text-white" />
            </motion.div>
            
            <h2 
              className="font-black text-[#1E7F5C] mb-[1.5vmin] uppercase tracking-tighter"
              style={{ fontSize: "clamp(2rem, 5vmin, 3.5rem)" }}
            >
              THANK YOU!
            </h2>
            <p 
              className="text-slate-600 font-bold mb-[4vmin] max-w-[60vmin] leading-relaxed"
              style={{ fontSize: "clamp(0.875rem, 2vmin, 1.25rem)" }}
            >
              Your transaction is complete. <br/>
              Please drive safely and follow parking rules.
            </p>
            
            <div className="flex items-center justify-center">
              <img 
                src={schoolLogo} 
                alt="School Logo" 
                className="rounded-full object-cover"
                style={{ width: "clamp(3rem, 6vmin, 5rem)", height: "clamp(3rem, 6vmin, 5rem)" }}
              />
            </div>

            <motion.div 
              className="mt-[4vmin] h-1 bg-slate-200 rounded-full overflow-hidden"
              style={{ width: "clamp(8rem, 20vmin, 14rem)" }}
            >
              <motion.div 
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: 5, ease: "linear" }}
                className="h-full bg-[#1E7F5C]"
              />
            </motion.div>
            <p 
              className="mt-[1vmin] text-slate-400 font-bold uppercase tracking-widest"
              style={{ fontSize: "clamp(0.45rem, 0.9vmin, 0.65rem)" }}
            >
              Returning to idle in a moment
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}