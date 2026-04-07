import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../App';
import { 
  LayoutDashboard, 
  Fuel, 
  Settings, 
  LogOut, 
  LogIn, 
  Activity,
  User,
  Menu,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, profile, login, logout } = useAuth();
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, show: true },
    { name: 'Portal', path: '/portal', icon: Activity, show: true },
    { name: 'Log', path: '/log', icon: Fuel, show: profile?.role === 'operator' || profile?.role === 'admin' || profile?.role === 'pumpOwner' },
    { name: 'Admin', path: '/admin', icon: Settings, show: profile?.role === 'admin' || profile?.role === 'pumpOwner' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Desktop Header */}
      <header className="hidden md:block bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Fuel className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900 tracking-tight">
                FDMS <span className="text-blue-600">Islampur</span>
              </span>
            </div>

            <nav className="flex items-center gap-6">
              {navItems.filter(i => i.show).map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "text-sm font-medium transition-colors hover:text-blue-600",
                    location.pathname === item.path ? "text-blue-600" : "text-slate-600"
                  )}
                >
                  {item.name}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-4">
              {user ? (
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-semibold text-slate-900">{profile?.name || user.email}</span>
                    <span className="text-xs text-slate-500 capitalize">{profile?.role}</span>
                  </div>
                  <button
                    onClick={logout}
                    className="p-2 text-slate-500 hover:text-red-600 transition-colors"
                  >
                    <LogOut className="h-5 w-5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={login}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-all shadow-sm"
                >
                  <LogIn className="h-4 w-4" />
                  Login
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Top Bar (Minimal) */}
      <div className="md:hidden sticky top-0 z-50 bg-slate-50/80 backdrop-blur-md px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-1.5 rounded-lg">
            <Fuel className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-black text-slate-900 tracking-tight">FDMS</span>
        </div>
        <div>
          {user ? (
            <button onClick={logout} className="p-2 text-slate-400">
              <LogOut className="h-4 w-4" />
            </button>
          ) : (
            <button onClick={login} className="p-2 text-blue-600">
              <LogIn className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-2 md:py-8">
        {children}
      </main>

      {/* Bottom Nav (Mobile Only) */}
      <nav className="md:hidden fixed bottom-6 left-4 right-4 bg-white/90 backdrop-blur-lg border border-white/20 px-6 py-3 flex justify-between items-center z-50 shadow-2xl shadow-blue-900/10 rounded-3xl">
        {navItems.filter(i => i.show).map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "flex flex-col items-center gap-1 transition-all",
              location.pathname === item.path ? "text-blue-600 scale-110" : "text-slate-400"
            )}
          >
            <item.icon className={cn("h-5 w-5", location.pathname === item.path ? "stroke-[2.5px]" : "stroke-[2px]")} />
            <span className="text-[8px] font-black uppercase tracking-tighter">{item.name}</span>
          </Link>
        ))}
      </nav>

      {/* Footer (Desktop Only) */}
      <footer className="hidden md:block bg-white border-t border-slate-200 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm text-slate-500">
            &copy; {new Date().getFullYear()} Fuel Distribution Monitoring System - Islampur Thana
          </p>
        </div>
      </footer>
    </div>
  );
}
