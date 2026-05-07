'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store/ui.store';
import { useAuthStore } from '@/store/auth.store';
import {
  LayoutDashboard, Users, CheckSquare, FileCheck, FolderOpen,
  Receipt, KeyRound, Bell, Zap, Brain, Settings, ChevronLeft,
  Building2, UserCog, Shield, AlertCircle,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/clients', icon: Users, label: 'Clients' },
  { href: '/tasks', icon: CheckSquare, label: 'Tasks' },
  { href: '/compliance', icon: FileCheck, label: 'Compliance' },
  { href: '/notices', icon: AlertCircle, label: 'Notices' },
  { href: '/documents', icon: FolderOpen, label: 'Documents' },
  { href: '/billing', icon: Receipt, label: 'Billing' },
  { href: '/credentials', icon: KeyRound, label: 'Credential Vault' },
  { href: '/automation', icon: Zap, label: 'Automation' },
  { href: '/ai', icon: Brain, label: 'AI Assistant' },
];

const BOTTOM_NAV = [
  { href: '/team', icon: UserCog, label: 'Team' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebarCollapsed } = useUIStore();
  const { user } = useAuthStore();

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar transition-all duration-300',
        sidebarCollapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center gap-3 border-b border-sidebar-border px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
          <Shield className="h-4 w-4 text-white" />
        </div>
        {!sidebarCollapsed && (
          <span className="font-bold text-sidebar-foreground text-sm leading-tight">
            CA Practice<br />
            <span className="text-xs font-normal text-sidebar-foreground/50">Manager</span>
          </span>
        )}
        <button
          onClick={toggleSidebarCollapsed}
          className="ml-auto text-sidebar-foreground/50 hover:text-sidebar-foreground"
        >
          <ChevronLeft className={cn('h-4 w-4 transition-transform', sidebarCollapsed && 'rotate-180')} />
        </button>
      </div>

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {!sidebarCollapsed && (
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/30">
            Main Menu
          </p>
        )}
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'sidebar-item',
                active && 'active',
                sidebarCollapsed && 'justify-center px-2',
              )}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom nav */}
      <div className="border-t border-sidebar-border px-2 py-3 space-y-0.5">
        {BOTTOM_NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn('sidebar-item', active && 'active', sidebarCollapsed && 'justify-center px-2')}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </Link>
          );
        })}

        {/* User */}
        {user && (
          <div className={cn('mt-2 flex items-center gap-2 rounded-lg px-3 py-2', sidebarCollapsed && 'justify-center px-2')}>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-white text-xs font-semibold">
              {user.firstName[0]}{user.lastName[0]}
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-sidebar-foreground">
                  {user.firstName} {user.lastName}
                </p>
                <p className="truncate text-[10px] text-sidebar-foreground/40">{user.role}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
