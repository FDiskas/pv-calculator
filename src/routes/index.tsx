/** biome-ignore-all lint/a11y/noLabelWithoutControl: Just cause */
/** biome-ignore-all lint/style/noNonNullAssertion: Just cause */
/** biome-ignore-all lint/suspicious/noNonNullAssertedOptionalChain: Just cause */
import { createFileRoute } from '@tanstack/react-router';
import { useState, useMemo, useEffect } from 'react';
import { 
  Calculator, 
  Battery, 
  Zap, 
  TrendingUp, 
  CheckCircle2, 
  AlertCircle,
  BarChart3,
  Euro,
  Info
} from 'lucide-react';
import { 
  type MonthlyInput,
  evaluatePlans, 
  ESO_PRICES,
  getBatteryRecommendation 
} from '../lib/calculator';
import { cn } from '../lib/utils';

export const Route = createFileRoute("/")({ component: App });

const MONTHS = [
  'April', 'May', 'June', 'July', 'August', 'September', 
  'October', 'November', 'December', 'January', 'February', 'March'
];

const STORAGE_KEY = 'electricity_planner_data';

const DEFAULT_MONTHLY_INPUTS: MonthlyInput[] = MONTHS.map(month => ({
  month,
  sentToGrid: 500,
  purchasedFromGrid: 100,
  reclaimedFromGrid: 500,
}));

function App() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [batterySize, setBatterySize] = useState<number>(5);
  const [electricityPrice, setElectricityPrice] = useState<number>(0.25);
  const [capacityKW, setCapacityKW] = useState<number>(10);
  
  const [monthlyInputs, setMonthlyInputs] = useState<MonthlyInput[]>(DEFAULT_MONTHLY_INPUTS);

  // Load from local storage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (typeof parsed.batterySize === 'number') setBatterySize(parsed.batterySize);
        if (typeof parsed.electricityPrice === 'number') setElectricityPrice(parsed.electricityPrice);
        if (typeof parsed.capacityKW === 'number') setCapacityKW(parsed.capacityKW);
        if (Array.isArray(parsed.monthlyInputs)) setMonthlyInputs(parsed.monthlyInputs);
      } catch (e) {
        console.error('Failed to parse saved data', e);
      }
    }
    setIsLoaded(true);
  }, []);

  // Save to local storage
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        batterySize,
        electricityPrice,
        capacityKW,
        monthlyInputs
      }));
    }
  }, [batterySize, electricityPrice, capacityKW, monthlyInputs, isLoaded]);

  const results = useMemo(() => {
    return evaluatePlans(monthlyInputs, batterySize, electricityPrice, capacityKW);
  }, [monthlyInputs, batterySize, electricityPrice, capacityKW]);

  const batteryRecs = useMemo(() => {
    return getBatteryRecommendation(monthlyInputs, electricityPrice, capacityKW);
  }, [monthlyInputs, electricityPrice, capacityKW]);

  const updateMonthlyInput = (index: number, field: keyof MonthlyInput, value: string) => {
    const numValue = parseFloat(value) || 0;
    const newInputs = [...monthlyInputs];
    newInputs[index] = { ...newInputs[index], [field]: numValue };
    setMonthlyInputs(newInputs);
  };

  const bestPlan = useMemo(() => {
    const plans = results.withBattery;
    return [...plans].sort((a, b) => a.grandTotal - b.grandTotal)[0];
  }, [results]);

  const cheapestNoBattery = useMemo(() => {
    return Math.min(...results.noBattery.map(p => p.grandTotal));
  }, [results]);

  const savingsWithBattery = cheapestNoBattery - bestPlan.grandTotal;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      {/* Hero Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-amber-500 p-2 rounded-lg">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">PV Planner</h1>
          </div>
          <div className="hidden sm:flex items-center gap-6 text-sm font-medium text-slate-500">
            <span className="text-amber-600">Calculator</span>
            <span>Insights</span>
            <span>ESO 2026 Guide</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Sidebar Inputs */}
          <div className="lg:col-span-4 space-y-6">
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-2 mb-6">
                <Calculator className="w-5 h-5 text-amber-500" />
                <h2 className="font-semibold text-lg">General Settings</h2>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Battery Size (kWh)
                  </label>
                  <div className="relative">
                    <Battery className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="number" 
                      value={batterySize}
                      onChange={(e) => setBatterySize(parseFloat(e.target.value) || 0)}
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Electricity Price (€/kWh)
                  </label>
                  <div className="relative">
                    <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="number" 
                      step="0.01"
                      value={electricityPrice}
                      onChange={(e) => setElectricityPrice(parseFloat(e.target.value) || 0)}
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Plant Capacity (kW)
                  </label>
                  <div className="relative">
                    <Zap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="number" 
                      value={capacityKW}
                      onChange={(e) => setCapacityKW(parseFloat(e.target.value) || 0)}
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                <h2 className="font-semibold text-lg">Quick Summary</h2>
              </div>
              
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                  <p className="text-xs font-medium text-emerald-700 uppercase tracking-wider mb-1">Best Plan</p>
                  <p className="text-lg font-bold text-emerald-900">{bestPlan.planName}</p>
                  <p className="text-2xl font-black text-emerald-600 mt-1">{bestPlan.grandTotal.toFixed(2)}€ <span className="text-sm font-normal text-slate-400">/ year</span></p>
                </div>

                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <p className="text-xs font-medium text-blue-700 uppercase tracking-wider mb-1">Battery Savings</p>
                  <p className="text-2xl font-black text-blue-600">{savingsWithBattery.toFixed(2)}€ <span className="text-sm font-normal text-slate-400">/ year</span></p>
                  <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    Compared to no battery scenario
                  </p>
                </div>
              </div>
            </section>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Recommendation Alert */}
            <div className="bg-linear-to-r from-amber-500 to-orange-600 p-6 rounded-3xl text-white shadow-lg shadow-amber-200">
              <div className="flex items-start gap-4">
                <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-1">Optimization Result</h3>
                  <p className="text-white/90 leading-relaxed">
                    Based on your energy profile, we recommend <strong>{bestPlan.planName}</strong>. 
                    {batterySize > 0 ? ` With a ${batterySize}kWh battery, you could save ${savingsWithBattery.toFixed(2)}€ annually.` : ""}
                  </p>
                </div>
              </div>
            </div>

            {/* Plan Comparison Table */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-bold text-slate-800">Plan Comparison (2026 ESO Tariffs)</h2>
                <div className="flex gap-2">
                   <div className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 bg-slate-100 rounded-md text-slate-600">
                     <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                     With Battery
                   </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 font-medium">
                    <tr>
                      <th className="px-6 py-4">Plan Name</th>
                      <th className="px-6 py-4">Reclaim Fee</th>
                      <th className="px-6 py-4">Capacity Fee</th>
                      <th className="px-6 py-4">Purchase Total</th>
                      <th className="px-6 py-4 text-right">Grand Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {results.withBattery.map((plan) => (
                      <tr key={plan.planName} className={cn("hover:bg-slate-50/50 transition-colors", plan.planName === bestPlan.planName && "bg-amber-50/30")}>
                        <td className="px-6 py-4 font-semibold text-slate-700">{plan.planName}</td>
                        <td className="px-6 py-4 text-slate-600">{plan.reclaimCost.toFixed(2)}€</td>
                        <td className="px-6 py-4 text-slate-600">{plan.capacityCost.toFixed(2)}€</td>
                        <td className="px-6 py-4 text-slate-600">{plan.purchaseCost.toFixed(2)}€</td>
                        <td className="px-6 py-4 text-right">
                          <span className={cn("inline-flex px-3 py-1 rounded-full font-bold", plan.planName === bestPlan.planName ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700")}>
                            {plan.grandTotal.toFixed(2)}€
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Monthly Data Input */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="font-bold text-slate-800">Monthly Generation & Consumption</h2>
              </div>
              <div className="p-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-slate-400 font-medium border-b border-slate-100">
                        <th className="pb-4 text-left font-medium">Month</th>
                        <th className="pb-4 text-left font-medium">Sent to Grid (kWh)</th>
                        <th className="pb-4 text-left font-medium">Purchased (kWh)</th>
                        <th className="pb-4 text-left font-medium">Reclaimed (kWh)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {monthlyInputs.map((input, idx) => (
                        <tr key={input.month}>
                          <td className="py-3 font-medium text-slate-600">{input.month}</td>
                          <td className="py-3">
                            <input 
                              type="number" 
                              value={input.sentToGrid}
                              onChange={(e) => updateMonthlyInput(idx, 'sentToGrid', e.target.value)}
                              className="w-24 px-2 py-1 bg-slate-50 border border-slate-100 rounded-md focus:ring-2 focus:ring-amber-500 outline-none"
                            />
                          </td>
                          <td className="py-3">
                            <input 
                              type="number" 
                              value={input.purchasedFromGrid}
                              onChange={(e) => updateMonthlyInput(idx, 'purchasedFromGrid', e.target.value)}
                              className="w-24 px-2 py-1 bg-slate-50 border border-slate-100 rounded-md focus:ring-2 focus:ring-amber-500 outline-none"
                            />
                          </td>
                          <td className="py-3">
                            <input 
                              type="number" 
                              value={input.reclaimedFromGrid}
                              onChange={(e) => updateMonthlyInput(idx, 'reclaimedFromGrid', e.target.value)}
                              className="w-24 px-2 py-1 bg-slate-50 border border-slate-100 rounded-md focus:ring-2 focus:ring-amber-500 outline-none"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* Battery Sizing Guide */}
            <section className="bg-slate-900 rounded-3xl p-8 text-white">
              <div className="flex items-center gap-3 mb-8">
                <BarChart3 className="w-6 h-6 text-amber-400" />
                <h2 className="text-2xl font-bold">Battery Investment Analysis</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {batteryRecs.map((rec) => (
                  <div key={rec.size} className={cn(
                    "p-5 rounded-2xl border transition-all",
                    rec.size === batterySize ? "bg-amber-500 border-amber-400 scale-105 shadow-xl shadow-amber-500/20" : "bg-white/5 border-white/10"
                  )}>
                    <p className="text-sm font-medium opacity-70 mb-1">{rec.size} kWh</p>
                    <p className="text-xl font-black mb-4">{(rec.annualSaving).toFixed(0)}€<span className="text-xs opacity-60 font-normal">/yr</span></p>
                    
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase tracking-wider opacity-50">Recup Period</p>
                      <p className="text-sm font-bold">
                        {rec.yearsToRecup === Infinity ? "No recoup" : `${rec.yearsToRecup.toFixed(1)} years`}
                      </p>
                    </div>

                    {rec.yearsToRecup <= 10 && rec.size > 0 && (
                      <div className="mt-4 pt-4 border-t border-white/10">
                        <span className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded-full font-bold">RECOMENDED</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-8 flex items-start gap-3 p-4 bg-white/5 rounded-2xl border border-white/10">
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-sm text-white/70 leading-relaxed">
                  Battery size recommendation is based on a 10-year recuperation target at {ESO_PRICES.BATTERY_COST_PER_KWH}€/kWh. 
                  Currently, your <strong>{batterySize}kWh</strong> battery {batterySize > 0 && batteryRecs.find(r => r.size === batterySize)?.yearsToRecup! <= 10 ? "is a solid investment" : "might be too large for your current consumption profile"}.
                </p>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-12 text-center text-slate-400 text-sm">
        <p>© 2026 PV Planner Tool • Based on VERT 2026 Regulations</p>
      </footer>
    </div>
  );
}
