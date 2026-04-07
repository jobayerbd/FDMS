import React, { createContext, useContext, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, getDocFromServer, deleteDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { PumpManagement } from './pages/PumpManagement';
import { TransactionLogging } from './pages/TransactionLogging';
import { PublicPortal } from './pages/PublicPortal';
import { Loader2, Fuel } from 'lucide-react';

// Test connection
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

interface UserProfile {
  uid: string;
  email: string;
  role: 'admin' | 'pumpOwner' | 'operator';
  assignedPumpId?: string;
  name?: string;
  isPreAssigned?: boolean;
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const uidRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(uidRef);
          
          if (userDoc.exists()) {
            setProfile({ uid: firebaseUser.uid, ...userDoc.data() } as UserProfile);
          } else {
            // Check if there's a pre-assigned profile by email
            const emailRef = doc(db, 'users', firebaseUser.email!.toLowerCase());
            const emailDoc = await getDoc(emailRef);
            
            if (emailDoc.exists()) {
              const preAssignedData = emailDoc.data();
              // Migrate pre-assigned data to UID-based document
              const newProfile: Omit<UserProfile, 'uid'> = {
                email: firebaseUser.email!,
                role: preAssignedData.role,
                name: preAssignedData.name || firebaseUser.displayName || '',
                assignedPumpId: preAssignedData.assignedPumpId,
              };
              await setDoc(uidRef, newProfile);
              // Clean up the temporary email-based document
              try {
                await deleteDoc(emailRef);
              } catch (e) {
                console.warn('Failed to delete pre-assigned doc:', e);
              }
              setProfile({ uid: firebaseUser.uid, ...newProfile } as UserProfile);
            } else {
              // Create default profile for new users
              const isAdmin = firebaseUser.email === 'op.jobayer@gmail.com';
              const newProfile: Omit<UserProfile, 'uid'> = {
                email: firebaseUser.email!,
                role: isAdmin ? 'admin' : 'operator',
                name: firebaseUser.displayName || '',
              };
              await setDoc(uidRef, newProfile);
              setProfile({ uid: firebaseUser.uid, ...newProfile } as UserProfile);
            }
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="bg-blue-600 p-4 rounded-3xl shadow-2xl shadow-blue-200 animate-pulse">
            <Fuel className="h-10 w-10 text-white" />
          </div>
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading FDMS</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout }}>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/portal" element={<PublicPortal />} />
            <Route
              path="/admin"
              element={
                profile?.role === 'admin' || profile?.role === 'pumpOwner' ? <PumpManagement /> : <Navigate to="/" />
              }
            />
            <Route
              path="/log"
              element={
                profile?.role === 'operator' || profile?.role === 'admin' || profile?.role === 'pumpOwner' ? (
                  <TransactionLogging />
                ) : (
                  <Navigate to="/" />
                )
              }
            />
          </Routes>
        </Layout>
      </Router>
    </AuthContext.Provider>
  );
}
