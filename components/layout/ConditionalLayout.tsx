'use client';
import { usePathname } from 'next/navigation';
import DashboardLayout from './DashboardLayout';

// Routes that should render without the dashboard shell
const AUTH_ROUTES = ['/login', '/lock', '/reset-password', '/auth', '/book'];
// The /client portal renders its own layout (stripped down, no MNA sidebar).
// Must match /client and /client/* but NOT /client-tasks (staff page).
export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));
  const isClientPortal = pathname === '/client' || pathname.startsWith('/client/');

  if (isAuthRoute || isClientPortal) {
    return <>{children}</>;
  }

  return <DashboardLayout>{children}</DashboardLayout>;
}
