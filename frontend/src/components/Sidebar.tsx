import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Megaphone, BookOpen,
  GitBranch, Radio, LogOut,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const nav = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/campaigns', label: 'Invite links', icon: Megaphone },
  { to: '/materials', label: 'Messages', icon: BookOpen },
  { to: '/sequences', label: 'Auto-flows', icon: GitBranch },
  { to: '/broadcasts', label: 'Send message', icon: Radio },
];

export default function Sidebar() {
  const { logout } = useAuth();

  return (
    <aside className="w-56 shrink-0 flex flex-col bg-[#0a1510] border-r border-[#1a2e24] h-full">
      <div className="px-5 py-5 border-b border-[#1a2e24]">
        <span className="text-brand-400 font-bold text-lg tracking-tight">Arabic CRM</span>
        <p className="text-[#4a7060] text-xs mt-0.5">Teacher Dashboard</p>
      </div>

      <nav className="flex-1 py-4 space-y-0.5 px-2">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-brand-500/15 text-brand-400 font-medium'
                  : 'text-[#8aab96] hover:text-[#dff5ea] hover:bg-[#111c17]'
              }`
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-2 py-4 border-t border-[#1a2e24]">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm text-[#8aab96] hover:text-red-400 hover:bg-red-900/10 transition-colors"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
