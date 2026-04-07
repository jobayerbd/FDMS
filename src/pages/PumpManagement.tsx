import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, setDoc, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Pump, FuelStock, UserProfile } from '../types';
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
  UserPlus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export function PumpManagement() {
  const { profile } = useAuth();
  const [pumps, setPumps] = useState<Pump[]>([]);
  const [stocks, setStocks] = useState<Record<string, FuelStock[]>>({});
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isAddStaffModalOpen, setIsAddStaffModalOpen] = useState(false);
  const [selectedPump, setSelectedPump] = useState<Pump | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);

  // Form states
  const [pumpForm, setPumpForm] = useState({ name: '', location: '', owner: '', contact: '' });
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
      await addDoc(collection(db, 'pumps'), pumpForm);
      setIsModalOpen(false);
      setPumpForm({ name: '', location: '', owner: '', contact: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'pumps');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPump) return;
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
      setIsStockModalOpen(false);
      setStockForm({ fuelType: 'Octane', amount: 0 });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `pumps/${selectedPump.id}/stocks`);
    } finally {
      setLoading(false);
    }
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
    if (profile?.role !== 'admin') return;
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
            onClick={() => setIsModalOpen(true)}
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
                    <div className="flex items-center gap-1 text-slate-400 text-[9px] font-bold">
                      <MapPin className="h-2.5 w-2.5" />
                      {pump.location}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
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
          {profile?.role === 'admin' && (
            <button 
              onClick={() => setIsAddStaffModalOpen(true)}
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
                {profile?.role === 'admin' && (
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
                <h3 className="text-base font-black text-slate-900">Register Pump</h3>
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
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Location</label>
                  <input 
                    required
                    type="text"
                    value={pumpForm.location}
                    onChange={e => setPumpForm({ ...pumpForm, location: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white outline-none transition-all text-sm font-bold"
                  />
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
                  Register Pump
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
                    {['pumpOwner', 'operator'].map(role => (
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
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Assign to Pump</label>
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
