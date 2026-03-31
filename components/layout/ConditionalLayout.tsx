'use client';
import { usePathname } from 'next/navigation';
import DashboardLayout from './DashboardLayout';

// Routes that should render without the dashboard shell
const AUTH_ROUTES = ['/login', '/lock'];

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));

  if (isAuthRoute) {
    return <>{children}</>;
  }

  return <DashboardLayout>{children}</DashboardLayout>;
}
