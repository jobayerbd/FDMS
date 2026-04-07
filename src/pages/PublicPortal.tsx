import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Pump, FuelStock, Vehicle } from '../types';
import { 
  Search, 
  Droplets, 
  MapPin, 
  Activity, 
  Info, 
  Car, 
  History,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

export function PublicPortal() {
  const [pumps, setPumps] = useState<Pump[]>([]);
  const [stocks, setStocks] = useState<Record<string, FuelStock[]>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [vehicleResult, setVehicleResult] = useState<Vehicle | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubPumps = onSnapshot(collection(db, 'pumps'), (snapshot) => {
      const pumpsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pump));
      setPumps(pumpsData);
      
      pumpsData.forEach(pump => {
        onSnapshot(collection(db, `pumps/${pump.id}/stocks`), (stockSnap) => {
          setStocks(prev => ({
            ...prev,
            [pump.id]: stockSnap.docs.map(s => ({ id: s.id, ...s.data() } as FuelStock))
          }));
        });
      });
      setLoading(false);
    });

    return () => unsubPumps();
  }, []);

  const handleVehicleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const q = query(collection(db, 'vehicles'), where('vehicleNumber', '==', searchQuery.toUpperCase().trim()));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setVehicleResult(snap.docs[0].data() as Vehicle);
      } else {
        setVehicleResult(null);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6 pb-24">
      {/* App Header */}
      <div className="flex items-center justify-between px-2 py-1">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-1.5 rounded-lg shadow-md shadow-blue-100">
            <Activity className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900 leading-none">Public Portal</h2>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Transparency First</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-full border border-slate-100 shadow-sm">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[8px] font-bold text-slate-600 uppercase tracking-wider">Live</span>
        </div>
      </div>

      {/* Vehicle Search - Compact */}
      <div className="px-2">
        <form onSubmit={handleVehicleSearch} className="relative group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
          </div>
          <input 
            type="text"
            placeholder="VEHICLE NUMBER"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-24 py-3.5 rounded-2xl bg-white border border-slate-100 shadow-lg shadow-slate-200/40 focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 outline-none transition-all text-sm font-mono uppercase"
          />
          <button 
            type="submit"
            disabled={isSearching}
            className="absolute right-1.5 top-1.5 bottom-1.5 bg-blue-600 text-white px-4 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isSearching ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Search'}
          </button>
        </form>

        <AnimatePresence>
          {searchQuery && vehicleResult !== undefined && (
            <motion.div 
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className="mt-3 bg-white p-4 rounded-2xl border border-slate-50 shadow-sm"
            >
              {vehicleResult ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="bg-emerald-50 p-2 rounded-xl">
                      <Car className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900 font-mono">{vehicleResult.vehicleNumber}</h3>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Vehicle History Found</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-50">
                    <div>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Total Taken</p>
                      <p className="text-lg font-black text-blue-600">{vehicleResult.totalFuelTaken.toFixed(1)}L</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Last Activity</p>
                      <p className="text-[10px] font-black text-slate-700">
                        {vehicleResult.lastTransactionAt?.toDate ? format(vehicleResult.lastTransactionAt.toDate(), 'MMM d, h:mm a') : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : searchQuery.length > 5 && !isSearching && (
                <div className="flex items-center gap-2 text-slate-500 py-1">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  <p className="text-[10px] font-bold">No history found for this vehicle.</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Pump Status Grid - Compact */}
      <div className="px-2 space-y-3">
        <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Pump Availability</h2>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="space-y-3">
            {pumps.map((pump) => (
              <motion.div 
                key={pump.id}
                className="bg-white rounded-2xl border border-slate-50 shadow-sm overflow-hidden"
              >
                <div className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="bg-slate-50 p-2 rounded-lg">
                        <Droplets className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-900">{pump.name}</h3>
                        <div className="flex items-center gap-1 text-slate-400 text-[9px] font-bold">
                          <MapPin className="h-2.5 w-2.5" />
                          {pump.location}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-200" />
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2">
                    {['Octane', 'Petrol', 'Diesel'].map(type => {
                      const stock = stocks[pump.id]?.find(s => s.fuelType === type);
                      const isLow = stock ? stock.currentStock < 500 : true;
                      return (
                        <div key={type} className="p-2 rounded-xl bg-slate-50/50 border border-slate-100 flex flex-col items-center">
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-1">{type}</span>
                          <p className={cn(
                            "text-xs font-black",
                            isLow ? "text-red-600" : "text-slate-900"
                          )}>
                            {stock ? `${stock.currentStock.toFixed(0)}L` : 'N/A'}
                          </p>
                          <div className={cn(
                            "w-1 h-1 rounded-full mt-1",
                            isLow ? "bg-red-500" : "bg-emerald-500"
                          )} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Commitment Note - Compact */}
      <div className="mx-2 bg-blue-600 rounded-3xl p-6 text-white relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-lg font-black mb-2">Transparency Commitment</h2>
          <p className="text-blue-100 text-[10px] font-medium leading-relaxed mb-4">
            FDMS ensures fair distribution and prevents hoarding. Data is monitored in real-time by Islampur Thana administration.
          </p>
          <div className="flex flex-wrap gap-3">
            {['Zero Hoarding', 'Fair Access', 'Public Oversight'].map(text => (
              <div key={text} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-blue-300" />
                <span className="text-[8px] font-black uppercase tracking-widest">{text}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-blue-500 rounded-full blur-2xl opacity-50" />
      </div>
    </div>
  );
}
