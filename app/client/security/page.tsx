import SecurityPanel from '@/components/security/SecurityPanel';

// Client-portal account-security page. Rendered inside the client layout so
// it keeps the client's own nav/chrome instead of the staff dashboard shell.
export default function ClientSecurityPage() {
  return <SecurityPanel embedded />;
}
