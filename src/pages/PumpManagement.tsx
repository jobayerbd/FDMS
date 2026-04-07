import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, setDoc, getDocs, serverTimestamp, query, orderBy, limit, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Pump, FuelStock, UserProfile, FuelLoading } from '../types';
import { useAuth } from '../App';
import { 
  Plus, 
  Search, 
  MoreVertical, 
  Trash2, 
  Edit2, 
  Fuel, 
  MapPin, 
  User, 
  Phone,
  X,
  Save,
  Loader2,
  Settings,
  Users,
  ShieldCheck,
  UserPlus,
  History,
  ArrowDownCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

export function PumpManagement() {
  const { profile } = useAuth();
  const [pumps, setPumps] = useState<Pump[]>([]);
  const [stocks, setStocks] = useState<Record<string, FuelStock[]>>({});
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingPumpId, setEditingPumpId] = useState<string | null>(null);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isAddStaffModalOpen, setIsAddStaffModalOpen] = useState(false);
  const [isLoadingHistoryOpen, setIsLoadingHistoryOpen] = useState(false);
  const [selectedPump, setSelectedPump] = useState<Pump | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState<FuelLoading[]>([]);

  // Form states
  const [pumpForm, setPumpForm] = useState({ name: '', location: '', owner: '', contact: '', latitude: 24.3167, longitude: 89.7833 });
  const [stockForm, setStockForm] = useState({ fuelType: 'Octane', amount: 0 });
  const [userForm, setUserForm] = useState({ role: 'operator' as 'admin' | 'pumpOwner' | 'operator', assignedPumpId: '' });
  const [addStaffForm, setAddStaffForm] = useState({ email: '', name: '', role: 'operator' as 'admin' | 'pumpOwner' | 'operator', assignedPumpId: '' });

  useEffect(() => {
    const unsubPumps = onSnapshot(collection(db, 'pumps'), (snapshot) => {
      const pumpsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pump));
      
      // If pumpOwner, only show their assigned pump (if any)
      // Actually, usually admin sees all, pumpOwner might see all or just theirs.
      // The request says pumpOwner can add pump load, log transaction, add operator.
      // Let's filter pumps for pumpOwner if we want to be strict, but usually management console shows what they can manage.
      if (profile?.role === 'pumpOwner' && profile.assignedPumpId) {
        setPumps(pumpsData.filter(p => p.id === profile.assignedPumpId));
      } else {
        setPumps(pumpsData);
      }
      
      pumpsData.forEach(pump => {
        onSnapshot(collection(db, `pumps/${pump.id}/stocks`), (stockSnap) => {
          setStocks(prev => ({
            ...prev,
            [pump.id]: stockSnap.docs.map(s => ({ id: s.id, ...s.data() } as FuelStock))
          }));
        });
      });
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    });

    return () => {
      unsubPumps();
      unsubUsers();
    };
  }, [profile]);

  const handleAddPump = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profile?.role !== 'admin') return;
    setLoading(true);
    try {
      if (isEditing && editingPumpId) {
        await updateDoc(doc(db, 'pumps', editingPumpId), pumpForm);
      } else {
        await addDoc(collection(db, 'pumps'), pumpForm);
      }
      setIsModalOpen(false);
      setIsEditing(false);
      setEditingPumpId(null);
      setPumpForm({ name: '', location: '', owner: '', contact: '', latitude: 24.3167, longitude: 89.7833 });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'pumps');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPump || !profile) return;
    // Both admin and pumpOwner can update stock
    setLoading(true);
    try {
      const stockRef = doc(db, `pumps/${selectedPump.id}/stocks`, stockForm.fuelType);
      const existingStock = stocks[selectedPump.id]?.find(s => s.fuelType === stockForm.fuelType);
      
      if (existingStock) {
        await updateDoc(stockRef, {
          totalReceived: existingStock.totalReceived + stockForm.amount,
          currentStock: existingStock.currentStock + stockForm.amount
        });
      } else {
        await setDoc(stockRef, {
          pumpId: selectedPump.id,
          fuelType: stockForm.fuelType,
          totalReceived: stockForm.amount,
          currentStock: stockForm.amount
        });
      }

      // Log the loading transaction
      await addDoc(collection(db, 'loadings'), {
        pumpId: selectedPump.id,
        fuelType: stockForm.fuelType,
        amount: stockForm.amount,
        timestamp: serverTimestamp(),
        addedBy: profile.uid
      });

      setIsStockModalOpen(false);
      setStockForm({ fuelType: 'Octane', amount: 0 });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `pumps/${selectedPump.id}/stocks`);
    } finally {
      setLoading(false);
    }
  };

  const fetchLoadingHistory = (pumpId: string) => {
    const q = query(
      collection(db, 'loadings'),
      where('pumpId', '==', pumpId),
      orderBy('timestamp', 'desc'),
      limit(20)
    );

    return onSnapshot(q, (snapshot) => {
      setLoadingHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FuelLoading)));
    });
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setLoading(true);
    try {
      const userRef = doc(db, 'users', selectedUser.uid);
      await updateDoc(userRef, {
        role: userForm.role,
        assignedPumpId: userForm.assignedPumpId || null
      });
      setIsUserModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${selectedUser.uid}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // We use the email as the ID for pre-assigned users
      const userRef = doc(db, 'users', addStaffForm.email.toLowerCase().trim());
      await setDoc(userRef, {
        email: addStaffForm.email.toLowerCase().trim(),
        name: addStaffForm.name,
        role: addStaffForm.role,
        assignedPumpId: addStaffForm.assignedPumpId || null,
        isPreAssigned: true
      });
      setIsAddStaffModalOpen(false);
      setAddStaffForm({ email: '', name: '', role: 'operator', assignedPumpId: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'users');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    const isAuthorized = profile?.role === 'admin' || profile?.role === 'pumpOwner';
    if (!isAuthorized) return;
    if (!confirm('Remove this staff member?')) return;
    try {
      await deleteDoc(doc(db, 'users', uid));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
    }
  };

  const handleDeletePump = async (id: string) => {
    if (profile?.role !== 'admin') return;
    if (!confirm('Delete this pump?')) return;
    try {
      await deleteDoc(doc(db, 'pumps', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `pumps/${id}`);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-4 pb-24">
      {/* App Header */}
      <div className="flex items-center justify-between px-2 py-1">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-1.5 rounded-lg shadow-md shadow-blue-100">
            <Settings className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900 leading-none">Management</h2>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{profile?.role === 'admin' ? 'Admin Console' : 'Owner Console'}</p>
          </div>
        </div>
        {profile?.role === 'admin' && (
          <button 
            onClick={() => {
              setIsEditing(false);
              setEditingPumpId(null);
              setPumpForm({ name: '', location: '', owner: '', contact: '', latitude: 24.3167, longitude: 89.7833 });
              setIsModalOpen(true);
            }}
            className="bg-blue-600 text-white p-2 rounded-xl shadow-lg shadow-blue-100 active:scale-95 transition-transform"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Pump Cards - Compact */}
      <div className="px-2 space-y-3">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Fuel Pumps</h3>
        {pumps.map((pump) => (
          <motion.div 
            layout
            key={pump.id}
            className="bg-white rounded-[1.5rem] border border-slate-50 shadow-sm overflow-hidden"
          >
            <div className="p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-50 p-2 rounded-lg">
                    <Fuel className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 leading-tight">{pump.name}</h3>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-slate-400 text-[9px] font-bold">
                        <MapPin className="h-2.5 w-2.5" />
                        {pump.location}
                      </div>
                      {pump.latitude && pump.longitude && (
                        <a 
                          href={`https://www.google.com/maps/search/?api=1&query=${pump.latitude},${pump.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[8px] font-black text-blue-600 uppercase hover:underline"
                        >
                          View Map
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button 
                    onClick={() => {
                      setSelectedPump(pump);
                      setIsLoadingHistoryOpen(true);
                      fetchLoadingHistory(pump.id);
                    }}
                    className="p-1.5 text-slate-300 hover:text-blue-600 transition-colors"
                  >
                    <History className="h-4 w-4" />
                  </button>
                  {profile?.role === 'admin' && (
                    <button 
                      onClick={() => {
                        setIsEditing(true);
                        setEditingPumpId(pump.id);
                        setPumpForm({
                          name: pump.name,
                          location: pump.location,
                          owner: pump.owner || '',
                          contact: pump.contact || '',
                          latitude: pump.latitude || 24.3167,
                          longitude: pump.longitude || 89.7833
                        });
                        setIsModalOpen(true);
                      }}
                      className="p-1.5 text-slate-300 hover:text-blue-600 transition-colors"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                  )}
                  <button 
                    onClick={() => { setSelectedPump(pump); setIsStockModalOpen(true); }}
                    className="p-1.5 text-slate-300 hover:text-blue-600 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  {profile?.role === 'admin' && (
                    <button 
                      onClick={() => handleDeletePump(pump.id)}
                      className="p-1.5 text-slate-300 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-1.5">
                {['Octane', 'Petrol', 'Diesel'].map(type => {
                  const stock = stocks[pump.id]?.find(s => s.fuelType === type);
                  return (
                    <div key={type} className="bg-slate-50/50 p-2 rounded-xl text-center border border-slate-100">
                      <p className="text-[7px] uppercase font-black text-slate-400 mb-0.5">{type}</p>
                      <p className="text-[10px] font-black text-slate-700">{stock?.currentStock || 0}L</p>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-[8px] font-bold text-slate-400">
                    <User className="h-2.5 w-2.5" />
                    {pump.owner || 'N/A'}
                  </div>
                  <div className="flex items-center gap-1 text-[8px] font-bold text-slate-400">
                    <Phone className="h-2.5 w-2.5" />
                    {pump.contact || 'N/A'}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* User Management Section */}
      <div className="px-2 space-y-3 mt-6">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Staff Management</h3>
          {(profile?.role === 'admin' || (profile?.role === 'pumpOwner' && profile.assignedPumpId)) && (
            <button 
              onClick={() => {
                setAddStaffForm({
                  email: '',
                  name: '',
                  role: profile?.role === 'pumpOwner' ? 'operator' : 'operator',
                  assignedPumpId: profile?.role === 'pumpOwner' ? profile.assignedPumpId! : ''
                });
                setIsAddStaffModalOpen(true);
              }}
              className="flex items-center gap-1 text-[9px] font-black text-blue-600 uppercase bg-blue-50 px-2 py-1 rounded-lg"
            >
              <UserPlus className="h-2.5 w-2.5" /> Add Staff
            </button>
          )}
        </div>
        <div className="space-y-2">
          {users.filter(u => {
            if (profile?.role === 'admin') return true;
            if (profile?.role === 'pumpOwner') {
              // Show operators assigned to their pump
              return u.role === 'operator' && u.assignedPumpId === profile.assignedPumpId;
            }
            return false;
          }).map((u) => (
            <div key={u.uid} className="bg-white p-3 rounded-2xl border border-slate-50 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className="bg-slate-50 p-2 rounded-xl">
                  <User className="h-4 w-4 text-slate-400" />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-900 leading-none">{u.name || u.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn(
                      "text-[7px] font-black uppercase px-1.5 py-0.5 rounded-md",
                      u.role === 'admin' ? "bg-red-50 text-red-600" :
                      u.role === 'pumpOwner' ? "bg-blue-50 text-blue-600" :
                      "bg-slate-50 text-slate-600"
                    )}>
                      {u.role}
                    </span>
                    {u.isPreAssigned && (
                      <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-600">
                        Pending Join
                      </span>
                    )}
                    {u.assignedPumpId && (
                      <span className="text-[7px] font-bold text-slate-400 uppercase">
                        • {pumps.find(p => p.id === u.assignedPumpId)?.name || '...'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-1">
                <button 
                  onClick={() => {
                    setSelectedUser(u);
                    setUserForm({ role: u.role, assignedPumpId: u.assignedPumpId || '' });
                    setIsUserModalOpen(true);
                  }}
                  className="p-2 text-slate-300 hover:text-blue-600 transition-colors"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                {(profile?.role === 'admin' || (profile?.role === 'pumpOwner' && u.role === 'operator' && u.assignedPumpId === profile.assignedPumpId)) && (
                  <button 
                    onClick={() => handleDeleteUser(u.uid)}
                    className="p-2 text-slate-300 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
          {profile?.role === 'pumpOwner' && (
            <p className="text-[8px] text-slate-400 px-2 font-bold italic">
              * As a Pump Owner, you can manage operators for your pump.
            </p>
          )}
        </div>
      </div>

      {/* Register Pump Modal - Compact */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-white rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-5 border-b border-slate-50 flex items-center justify-between">
                <h3 className="text-base font-black text-slate-900">{isEditing ? 'Edit Pump' : 'Register Pump'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-300">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleAddPump} className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Pump Name</label>
                  <input 
                    required
                    type="text"
                    value={pumpForm.name}
                    onChange={e => setPumpForm({ ...pumpForm, name: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white outline-none transition-all text-sm font-bold"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Location Name</label>
                  <input 
                    required
                    type="text"
                    value={pumpForm.location}
                    onChange={e => setPumpForm({ ...pumpForm, location: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white outline-none transition-all text-sm font-bold"
                    placeholder="e.g. Islampur Bazar"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Latitude</label>
                    <input 
                      type="number"
                      step="any"
                      value={pumpForm.latitude}
                      onChange={e => setPumpForm({ ...pumpForm, latitude: parseFloat(e.target.value) })}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white outline-none transition-all text-sm font-bold"
                      placeholder="24.3167"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Longitude</label>
                    <input 
                      type="number"
                      step="any"
                      value={pumpForm.longitude}
                      onChange={e => setPumpForm({ ...pumpForm, longitude: parseFloat(e.target.value) })}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white outline-none transition-all text-sm font-bold"
                      placeholder="89.7833"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Owner</label>
                    <input 
                      type="text"
                      value={pumpForm.owner}
                      onChange={e => setPumpForm({ ...pumpForm, owner: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white outline-none transition-all text-sm font-bold"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Contact</label>
                    <input 
                      type="text"
                      value={pumpForm.contact}
                      onChange={e => setPumpForm({ ...pumpForm, contact: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white outline-none transition-all text-sm font-bold"
                    />
                  </div>
                </div>
                <button 
                  disabled={loading}
                  type="submit"
                  className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-blue-100 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                  {isEditing ? 'Update Pump' : 'Register Pump'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Update Stock Modal - Compact */}
      <AnimatePresence>
        {isStockModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-white rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-5 border-b border-slate-50 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-slate-900">Update Stock</h3>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{selectedPump?.name}</p>
                </div>
                <button onClick={() => setIsStockModalOpen(false)} className="text-slate-300">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleUpdateStock} className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Fuel Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['Octane', 'Petrol', 'Diesel'].map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setStockForm({ ...stockForm, fuelType: type })}
                        className={cn(
                          "py-2.5 rounded-xl border-2 text-[10px] font-black transition-all",
                          stockForm.fuelType === type 
                            ? "bg-blue-600 border-blue-600 text-white" 
                            : "bg-slate-50 border-transparent text-slate-500"
                        )}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Received Amount (L)</label>
                  <input 
                    required
                    type="number"
                    min="1"
                    value={stockForm.amount}
                    onChange={e => setStockForm({ ...stockForm, amount: parseInt(e.target.value) })}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white outline-none transition-all text-xl font-black"
                  />
                </div>
                <button 
                  disabled={loading}
                  type="submit"
                  className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-blue-100 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                  Add to Stock
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Add Staff Modal - Compact */}
      <AnimatePresence>
        {isAddStaffModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-white rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-5 border-b border-slate-50 flex items-center justify-between">
                <h3 className="text-base font-black text-slate-900">Add New Staff</h3>
                <button onClick={() => setIsAddStaffModalOpen(false)} className="text-slate-300">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleAddStaff} className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Email Address</label>
                  <input 
                    required
                    type="email"
                    value={addStaffForm.email}
                    onChange={e => setAddStaffForm({ ...addStaffForm, email: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white outline-none transition-all text-sm font-bold"
                    placeholder="staff@example.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Full Name</label>
                  <input 
                    required
                    type="text"
                    value={addStaffForm.name}
                    onChange={e => setAddStaffForm({ ...addStaffForm, name: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white outline-none transition-all text-sm font-bold"
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Role</label>
                  <div className="grid grid-cols-2 gap-2">
                    {profile?.role === 'admin' ? (
                      ['pumpOwner', 'operator'].map(role => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => setAddStaffForm({ ...addStaffForm, role: role as any })}
                          className={cn(
                            "py-2.5 rounded-xl border-2 text-[10px] font-black transition-all",
                            addStaffForm.role === role 
                              ? "bg-blue-600 border-blue-600 text-white" 
                              : "bg-slate-50 border-transparent text-slate-500"
                          )}
                        >
                          {role === 'pumpOwner' ? 'Pump Owner' : 'Operator'}
                        </button>
                      ))
                    ) : (
                      <div className="py-2.5 px-4 rounded-xl bg-slate-50 border-2 border-transparent text-[10px] font-black text-slate-500">
                        Operator
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Assign to Pump</label>
                  {profile?.role === 'admin' ? (
                    <select 
                      value={addStaffForm.assignedPumpId}
                      onChange={e => setAddStaffForm({ ...addStaffForm, assignedPumpId: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white outline-none transition-all text-sm font-bold"
                    >
                      <option value="">No Assignment</option>
                      {pumps.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="py-3 px-4 rounded-xl bg-slate-50 border-2 border-transparent text-sm font-bold text-slate-500">
                      {pumps.find(p => p.id === profile?.assignedPumpId)?.name || 'Your Pump'}
                    </div>
                  )}
                </div>
                <button 
                  disabled={loading}
                  type="submit"
                  className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-blue-100 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserPlus className="h-5 w-5" />}
                  Add Staff Member
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Loading History Modal */}
      <AnimatePresence>
        {isLoadingHistoryOpen && (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-white rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-5 border-b border-slate-50 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-base font-black text-slate-900">Loading History</h3>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{selectedPump?.name}</p>
                </div>
                <button onClick={() => setIsLoadingHistoryOpen(false)} className="text-slate-300">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loadingHistory.length === 0 ? (
                  <div className="text-center py-10">
                    <History className="h-10 w-10 text-slate-100 mx-auto mb-2" />
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No loading history yet</p>
                  </div>
                ) : (
                  loadingHistory.map((load) => (
                    <div key={load.id} className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-white p-2 rounded-xl shadow-sm">
                          <ArrowDownCircle className="h-4 w-4 text-emerald-500" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-900 leading-none">{load.fuelType}</p>
                          <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">
                            {load.timestamp?.toDate ? format(load.timestamp.toDate(), 'MMM d, h:mm a') : 'Just now'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black text-emerald-600">+{load.amount}L</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Update User Modal - Compact */}
      <AnimatePresence>
        {isUserModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-white rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-5 border-b border-slate-50 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-slate-900">Manage Staff</h3>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{selectedUser?.name || selectedUser?.email}</p>
                </div>
                <button onClick={() => setIsUserModalOpen(false)} className="text-slate-300">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleUpdateUser} className="p-5 space-y-4">
                {profile?.role === 'admin' && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Role</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['admin', 'pumpOwner', 'operator'].map(role => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => setUserForm({ ...userForm, role: role as any })}
                          className={cn(
                            "py-2.5 rounded-xl border-2 text-[10px] font-black transition-all",
                            userForm.role === role 
                              ? "bg-blue-600 border-blue-600 text-white" 
                              : "bg-slate-50 border-transparent text-slate-500"
                          )}
                        >
                          {role}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Assign to Pump</label>
                  <select 
                    value={userForm.assignedPumpId}
                    onChange={e => setUserForm({ ...userForm, assignedPumpId: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white outline-none transition-all text-sm font-bold"
                  >
                    <option value="">No Assignment</option>
                    {pumps.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <button 
                  disabled={loading}
                  type="submit"
                  className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-blue-100 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
                  Update Permissions
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
