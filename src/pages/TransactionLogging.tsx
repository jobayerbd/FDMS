import React, { useState, useEffect } from 'react';
import { collection, addDoc, doc, serverTimestamp, query, where, getDocs, limit, orderBy, onSnapshot, increment, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../App';
import { Pump, FuelStock, Transaction as FuelTransaction } from '../types';
import { 
  Fuel, 
  Car, 
  Hash, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  History,
  ArrowRight,
  Search,
  Activity,
  Wifi,
  WifiOff,
  CloudUpload,
  Calculator,
  Delete,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

export function TransactionLogging() {
  const { profile, user } = useAuth();
  const [pumps, setPumps] = useState<Pump[]>([]);
  const [selectedPumpId, setSelectedPumpId] = useState<string>('');
  const [recentTransactions, setRecentTransactions] = useState<FuelTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vehicleHistoryTotal, setVehicleHistoryTotal] = useState<number>(0);
  const [isCheckingHistory, setIsCheckingHistory] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [keypadConfig, setKeypadConfig] = useState<{ isOpen: boolean, field: 'quantity' | 'vehicleNumber' }>({
    isOpen: false,
    field: 'quantity'
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Form state
  const [form, setForm] = useState({
    vehicleNumber: '',
    fuelType: 'Octane' as 'Octane' | 'Petrol' | 'Diesel',
    quantity: ''
  });

  useEffect(() => {
    const fetchPumps = async () => {
      const snap = await getDocs(collection(db, 'pumps'));
      const pumpsData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pump));
      setPumps(pumpsData);
      
      if (profile?.assignedPumpId) {
        setSelectedPumpId(profile.assignedPumpId);
      } else if (pumpsData.length > 0) {
        setSelectedPumpId(pumpsData[0].id);
      }
    };

    fetchPumps();
  }, [profile]);

  useEffect(() => {
    if (!selectedPumpId) return;
    
    const q = query(
      collection(db, 'transactions'),
      where('pumpId', '==', selectedPumpId),
      orderBy('timestamp', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      setRecentTransactions(snap.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        _isPending: doc.metadata.hasPendingWrites 
      } as FuelTransaction & { _isPending?: boolean })));
    }, (err) => {
      console.error("Error listening to transactions:", err);
    });

    return () => unsubscribe();
  }, [selectedPumpId]);

  useEffect(() => {
    const vehicleNum = form.vehicleNumber.trim().toUpperCase();
    if (vehicleNum.length < 3) {
      setVehicleHistoryTotal(0);
      return;
    }

    const fetchVehicleHistory = async () => {
      setIsCheckingHistory(true);
      try {
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        
        const q = query(
          collection(db, 'transactions'),
          where('vehicleNumber', '==', vehicleNum),
          where('timestamp', '>=', threeDaysAgo)
        );
        
        const snap = await getDocs(q);
        const total = snap.docs.reduce((acc, doc) => acc + (doc.data().quantity || 0), 0);
        setVehicleHistoryTotal(total);
      } catch (err) {
        console.error('Error fetching vehicle history:', err);
      } finally {
        setIsCheckingHistory(false);
      }
    };

    const timer = setTimeout(fetchVehicleHistory, 500);
    return () => clearTimeout(timer);
  }, [form.vehicleNumber]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedPumpId || !user) return;
    
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const quantity = parseFloat(form.quantity);
      if (isNaN(quantity) || quantity <= 0) throw new Error("Enter valid quantity");
      if (!form.vehicleNumber.trim()) throw new Error("Enter vehicle number");

      const vehicleRef = doc(db, 'vehicles', form.vehicleNumber.toUpperCase().trim());
      const stockRef = doc(db, `pumps/${selectedPumpId}/stocks`, form.fuelType);
      const transactionRef = doc(collection(db, 'transactions'));

      // Offline-friendly check (uses cache if offline)
      const stockDoc = await getDoc(stockRef);
      if (stockDoc.exists()) {
        const currentStock = stockDoc.data().currentStock;
        if (currentStock < quantity) {
          throw new Error(`Insufficient stock! (${currentStock}L available)`);
        }
      }

      // Perform individual writes (Firestore queues these if offline)
      // 1. Update stock with increment
      await updateDoc(stockRef, {
        currentStock: increment(-quantity)
      });

      // 2. Update vehicle
      await setDoc(vehicleRef, {
        vehicleNumber: form.vehicleNumber.toUpperCase().trim(),
        totalFuelTaken: increment(quantity),
        lastTransactionAt: serverTimestamp()
      }, { merge: true });

      // 3. Create transaction
      await setDoc(transactionRef, {
        vehicleNumber: form.vehicleNumber.toUpperCase().trim(),
        fuelType: form.fuelType,
        quantity: quantity,
        pumpId: selectedPumpId,
        operatorId: user.uid,
        timestamp: serverTimestamp()
      });

      setSuccess(true);
      setForm({ vehicleNumber: '', fuelType: 'Octane', quantity: '' });
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedPump = pumps.find(p => p.id === selectedPumpId);
  const quickQuantities = [5, 10, 20, 50];

  const handleKeypadPress = (val: string) => {
    const field = keypadConfig.field;
    if (val === 'backspace') {
      setForm(prev => ({ ...prev, [field]: prev[field].slice(0, -1) }));
    } else if (val === '.') {
      if (field === 'quantity' && !form.quantity.includes('.')) {
        setForm(prev => ({ ...prev, quantity: prev.quantity + '.' }));
      }
      // Vehicle number usually doesn't have dots, but we can allow it if needed or ignore
    } else {
      setForm(prev => ({ ...prev, [field]: prev[field] + val }));
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-3 pb-24">
      {/* App Header - Compact */}
      <div className="flex items-center justify-between px-2 py-1">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-1.5 rounded-lg shadow-md shadow-blue-100">
            <Fuel className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900 leading-none">Fuel Entry</h2>
            <div className="flex items-center gap-1 mt-0.5">
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{selectedPump?.name || '...'}</p>
              <span className="text-[8px] text-slate-300">•</span>
              <div className={cn(
                "flex items-center gap-0.5 text-[8px] font-black uppercase tracking-tighter",
                isOnline ? "text-emerald-500" : "text-amber-500"
              )}>
                {isOnline ? <Wifi className="h-2 w-2" /> : <WifiOff className="h-2 w-2" />}
                {isOnline ? "Online" : "Offline Mode"}
              </div>
            </div>
          </div>
        </div>
        {profile?.role === 'admin' && (
          <select 
            value={selectedPumpId}
            onChange={e => setSelectedPumpId(e.target.value)}
            className="text-[8px] font-black bg-white border border-slate-200 rounded-md px-1.5 py-0.5 outline-none"
          >
            {pumps.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>

      {/* Main Input Card - Compact */}
      <motion.div 
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[1.5rem] border border-slate-100 shadow-lg shadow-slate-200/30 p-4 space-y-4"
      >
        {/* Vehicle Input */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center px-0.5">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Car className="h-2.5 w-2.5" /> Vehicle
            </label>
            {form.vehicleNumber.trim().length >= 3 && (
              <div className={cn(
                "text-[9px] font-black flex items-center gap-1",
                vehicleHistoryTotal > 50 ? "text-red-500" : "text-blue-600"
              )}>
                {isCheckingHistory ? <Loader2 className="h-2 w-2 animate-spin" /> : <Activity className="h-2 w-2" />}
                3D: {vehicleHistoryTotal.toFixed(1)}L
              </div>
            )}
          </div>
          <div className="relative">
            <input 
              type="text"
              placeholder="REG NUMBER"
              value={form.vehicleNumber}
              onChange={e => setForm({ ...form, vehicleNumber: e.target.value })}
              className="w-full px-4 py-3 pr-12 rounded-xl bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white outline-none transition-all font-mono text-base font-black uppercase placeholder:text-slate-200 text-slate-900"
            />
            <button 
              type="button"
              onClick={() => setKeypadConfig({ isOpen: true, field: 'vehicleNumber' })}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white rounded-lg shadow-sm border border-slate-100 text-blue-600 active:scale-90 transition-transform"
            >
              <Calculator className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Fuel Type Chips - Compact */}
        <div className="space-y-1.5">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider px-0.5">Fuel Type</label>
          <div className="grid grid-cols-3 gap-1.5">
            {['Octane', 'Petrol', 'Diesel'].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setForm({ ...form, fuelType: type as any })}
                className={cn(
                  "py-2 rounded-lg border-2 text-[10px] font-black transition-all",
                  form.fuelType === type 
                    ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-50" 
                    : "bg-slate-50 border-transparent text-slate-500"
                )}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Quantity Input - Compact */}
        <div className="space-y-1.5">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider px-0.5 flex items-center gap-1">
            <Hash className="h-2.5 w-2.5" /> Quantity
          </label>
          <div className="relative">
            <input 
              type="number"
              step="0.01"
              placeholder="0.00"
              value={form.quantity}
              onChange={e => setForm({ ...form, quantity: e.target.value })}
              className="w-full px-4 py-3 pr-12 rounded-xl bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white outline-none transition-all text-2xl font-black text-slate-900 placeholder:text-slate-100"
            />
            <div className="absolute right-12 top-1/2 -translate-y-1/2 text-slate-300 font-black text-lg">L</div>
            <button 
              type="button"
              onClick={() => setKeypadConfig({ isOpen: true, field: 'quantity' })}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white rounded-lg shadow-sm border border-slate-100 text-blue-600 active:scale-90 transition-transform"
            >
              <Calculator className="h-5 w-5" />
            </button>
          </div>
          
          {/* Quick Presets - Compact */}
          <div className="grid grid-cols-4 gap-1.5">
            {quickQuantities.map(q => (
              <button
                key={q}
                type="button"
                onClick={() => setForm({ ...form, quantity: q.toString() })}
                className="py-2 rounded-lg bg-slate-50 text-slate-900 text-[9px] font-black border border-slate-100 active:bg-blue-600 active:text-white transition-colors"
              >
                {q}L
              </button>
            ))}
          </div>
        </div>

        {/* Submit Button - Compact */}
        <div className="pt-1">
          <button 
            onClick={() => handleSubmit()}
            disabled={loading || !form.vehicleNumber || !form.quantity}
            className={cn(
              "w-full py-3.5 rounded-xl font-black text-sm transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-30",
              success ? "bg-emerald-500 text-white shadow-emerald-50" : "bg-blue-600 text-white shadow-blue-100 active:scale-[0.98]"
            )}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : success ? "Confirmed" : "Confirm Entry"}
          </button>
        </div>
      </motion.div>

      {/* Feedback Messages - Compact */}
      <AnimatePresence mode="wait">
        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="mx-2 p-2.5 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-700 text-[9px] font-bold"
          >
            <AlertCircle className="h-3 w-3 shrink-0" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recent Activity - Very Compact */}
      <div className="px-1 space-y-2">
        <div className="flex items-center justify-between px-3">
          <h3 className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Recent Activity</h3>
          <History className="h-2.5 w-2.5 text-slate-300" />
        </div>
        <div className="space-y-1.5 px-1">
          {recentTransactions.map((t: any) => (
            <div 
              key={t.id} 
              className={cn(
                "bg-white p-2.5 rounded-xl border flex items-center justify-between shadow-sm transition-all",
                t._isPending ? "border-amber-100 bg-amber-50/30" : "border-slate-50"
              )}
            >
              <div className="flex items-center gap-2.5">
                <div className="bg-slate-50 p-1.5 rounded-lg">
                  <Car className="h-2.5 w-2.5 text-slate-400" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-[10px] font-black text-slate-900 font-mono leading-none">{t.vehicleNumber}</p>
                    {t._isPending && (
                      <div className="flex items-center gap-0.5 bg-amber-100 text-amber-700 px-1 py-0.5 rounded text-[6px] font-black uppercase">
                        <CloudUpload className="h-1.5 w-1.5" /> Pending Sync
                      </div>
                    )}
                  </div>
                  <p className="text-[7px] text-slate-400 font-bold uppercase mt-0.5">
                    {t.timestamp?.toDate ? format(t.timestamp.toDate(), 'h:mm a') : 'Just now'} • {t.fuelType}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-black text-blue-600 leading-none">{t.quantity}L</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Numeric Keypad Modal */}
      <AnimatePresence>
        {keypadConfig.isOpen && (
          <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/40 backdrop-blur-sm p-0">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-white rounded-t-[2.5rem] w-full max-w-md p-6 pb-10 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Input {keypadConfig.field === 'quantity' ? 'Quantity' : 'Vehicle Number'}
                  </span>
                  <span className="text-3xl font-black text-blue-600">
                    {form[keypadConfig.field] || (keypadConfig.field === 'quantity' ? '0' : '---')}
                    {keypadConfig.field === 'quantity' && <span className="text-slate-300 ml-1">L</span>}
                  </span>
                </div>
                <button 
                  onClick={() => setKeypadConfig(prev => ({ ...prev, isOpen: false }))}
                  className="p-3 bg-slate-50 rounded-2xl text-slate-400 active:scale-95 transition-transform"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, keypadConfig.field === 'quantity' ? '.' : '', 0, 'backspace'].map((key, idx) => {
                  if (key === '' && keypadConfig.field === 'vehicleNumber') return <div key={`empty-${idx}`} />;
                  return (
                    <button
                      key={key || `key-${idx}`}
                      type="button"
                      onClick={() => handleKeypadPress(key.toString())}
                      className={cn(
                        "h-16 rounded-2xl flex items-center justify-center text-xl font-black transition-all active:scale-95",
                        key === 'backspace' 
                          ? "bg-red-50 text-red-500" 
                          : "bg-slate-50 text-slate-900 hover:bg-slate-100"
                      )}
                    >
                      {key === 'backspace' ? <Delete className="h-6 w-6" /> : key}
                    </button>
                  );
                })}
              </div>

              <button 
                onClick={() => setKeypadConfig(prev => ({ ...prev, isOpen: false }))}
                className="w-full mt-6 py-4 bg-blue-600 text-white rounded-2xl font-black text-base shadow-xl shadow-blue-100 active:scale-[0.98] transition-all"
              >
                Done
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
