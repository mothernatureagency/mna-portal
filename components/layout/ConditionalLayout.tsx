'use client';
import { usePathname } from 'next/navigation';
import DashboardLayout from './DashboardLayout';

// Routes that should render without the dashboard shell
const AUTH_ROUTES = ['/login', '/lock'];
// The /client portal renders its own layout (stripped down, no MNA sidebar)
const CLIENT_PORTAL_PREFIX = '/client';

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));
  const isClientPortal = pathname.startsWith(CLIENT_PORTAL_PREFIX);

  if (isAuthRoute || isClientPortal) {
    return <>{children}</>;
  }

  return <DashboardLayout>{children}</DashboardLayout>;
}
