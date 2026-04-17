'use client';
import { usePathname } from 'next/navigation';
import DashboardLayout from './DashboardLayout';

// Routes that should render without the dashboard shell
const AUTH_ROUTES = ['/login', '/lock', '/reset-password', '/auth', '/book'];
// The /client and /contractor portals render their own minimal layouts —
// no staff sidebar, no agency-wide chrome. Match exact path or sub-paths,
// but NOT /client-tasks (which is a staff-only page).
export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));
  const isClientPortal = pathname === '/client' || pathname.startsWith('/client/');
  const isContractorPortal = pathname === '/contractor' || pathname.startsWith('/contractor/');

  if (isAuthRoute || isClientPortal || isContractorPortal) {
    return <>{children}</>;
  }

  return <DashboardLayout>{children}</DashboardLayout>;
}
