import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot, getDocs, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Pump, Transaction, FuelStock } from '../types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { 
  Droplets, 
  TrendingUp, 
  AlertTriangle, 
  History,
  ArrowUpRight,
  ArrowDownRight,
  Search
} from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export function Dashboard() {
  const [pumps, setPumps] = useState<Pump[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stocks, setStocks] = useState<FuelStock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubPumps = onSnapshot(collection(db, 'pumps'), (snapshot) => {
      setPumps(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pump)));
    });

    const unsubTransactions = onSnapshot(
      query(collection(db, 'transactions'), orderBy('timestamp', 'desc'), limit(10)),
      (snapshot) => {
        setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
      }
    );

    const fetchStocks = async () => {
      const allStocks: FuelStock[] = [];
      const pumpsSnap = await getDocs(collection(db, 'pumps'));
      for (const pumpDoc of pumpsSnap.docs) {
        const stocksSnap = await getDocs(collection(db, `pumps/${pumpDoc.id}/stocks`));
        stocksSnap.forEach(s => allStocks.push({ id: s.id, ...s.data() } as FuelStock));
      }
      setStocks(allStocks);
      setLoading(false);
    };

    fetchStocks();

    return () => {
      unsubPumps();
      unsubTransactions();
    };
  }, []);

  const totalDistributed = transactions.reduce((acc, t) => acc + t.quantity, 0);
  
  const stockByFuelType = stocks.reduce((acc, s) => {
    acc[s.fuelType] = (acc[s.fuelType] || 0) + s.currentStock;
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(stockByFuelType).map(([name, value]) => ({ name, value }));
  
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b'];
  const lowStockThreshold = 500;
  const lowStockAlerts = stocks.filter(s => s.currentStock < lowStockThreshold);

  return (
    <div className="max-w-md mx-auto space-y-4 pb-24">
      {/* App Header */}
      <div className="flex items-center justify-between px-2 py-1">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-1.5 rounded-lg shadow-md shadow-blue-100">
            <TrendingUp className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900 leading-none">Dashboard</h2>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Islampur Thana Monitoring</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-full border border-slate-100 shadow-sm">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[8px] font-bold text-slate-600 uppercase tracking-wider">Live</span>
        </div>
      </div>

      {/* Stats Grid - Compact */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard 
          title="Distributed" 
          value={`${totalDistributed.toFixed(0)}L`} 
          icon={TrendingUp}
          color="blue"
        />
        <StatCard 
          title="Active Pumps" 
          value={pumps.length.toString()} 
          icon={Droplets}
          color="emerald"
        />
        <StatCard 
          title="Stock Alerts" 
          value={lowStockAlerts.length.toString()} 
          icon={AlertTriangle}
          color={lowStockAlerts.length > 0 ? "amber" : "slate"}
        />
        <StatCard 
          title="Entries" 
          value={transactions.length.toString()} 
          icon={History}
          color="indigo"
        />
      </div>

      {/* Stock Chart - Compact */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Stock Overview</h3>
          <div className="flex gap-2">
            {['Oct', 'Pet', 'Die'].map((type, i) => (
              <div key={type} className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                <span className="text-[8px] text-slate-500 font-bold">{type}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="h-[180px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 8, fontWeight: 700 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 8, fontWeight: 700 }} />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '10px' }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={30}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Recent Transactions - Compact */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recent Activity</h3>
          <button className="text-[8px] font-black text-blue-600 uppercase tracking-widest">View All</button>
        </div>
        <div className="space-y-2">
          {transactions.map((t) => (
            <div key={t.id} className="bg-white p-3 rounded-2xl border border-slate-50 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className="bg-slate-50 p-2 rounded-lg">
                  <Droplets className="h-3 w-3 text-slate-400" />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-900 font-mono leading-none">{t.vehicleNumber}</p>
                  <p className="text-[8px] text-slate-400 font-bold uppercase mt-1">
                    {t.timestamp?.toDate ? format(t.timestamp.toDate(), 'h:mm a') : '...'} • {t.fuelType}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-blue-600 leading-none">{t.quantity}L</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: any) {
  const colors: any = {
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    indigo: "bg-indigo-50 text-indigo-600",
    slate: "bg-slate-50 text-slate-600",
  };

  return (
    <motion.div 
      whileTap={{ scale: 0.98 }}
      className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3"
    >
      <div className={cn("p-2 rounded-xl shrink-0", colors[color])}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest truncate">{title}</p>
        <h4 className="text-sm font-black text-slate-900 truncate">{value}</h4>
      </div>
    </motion.div>
  );
}
