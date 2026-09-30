'use client';
import { usePathname } from 'next/navigation';
import DashboardLayout from './DashboardLayout';

// Routes that should render without the dashboard shell
// /oauth/authorize is the OAuth consent screen. It renders standalone: the
// question is "do you want to grant this?", and wrapping it in the whole
// portal makes it read like a page of the app rather than a decision.
const AUTH_ROUTES = ['/login', '/lock', '/reset-password', '/auth', '/book', '/oauth'];
// The /client and /contractor portals render their own minimal layouts —
// no staff sidebar, no agency-wide chrome. Match exact path or sub-paths,
// but NOT /client-tasks (which is a staff-only page).
export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));
  const isClientPortal = pathname === '/client' || pathname.startsWith('/client/');
  const isContractorPortal = pathname === '/contractor' || pathname.startsWith('/contractor/');
  const isStudentPortal = pathname === '/student' || pathname.startsWith('/student/');
  const isCreatorPortal = pathname === '/creator' || pathname.startsWith('/creator/');
  // The invoice pay page is opened by clients from an email link, signed out.
  const isPayPage = pathname.startsWith('/pay/');

  if (isAuthRoute || isClientPortal || isContractorPortal || isStudentPortal || isCreatorPortal || isPayPage) {
    return <>{children}</>;
  }

  return <DashboardLayout>{children}</DashboardLayout>;
}
