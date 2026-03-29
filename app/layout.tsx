import type { Metadata } from 'next';
import './globals.css';
import { ReactNode } from 'react';

import { ClientProvider } from '@/context/ClientContext';
import DashboardLayout from '@/components/layout/DashboardLayout';

export const metadata: Metadata = {
  title: 'MNA Dashboard — Mother Nature Agency',
  description: 'Premium marketing intelligence dashboard',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ClientProvider>
          <DashboardLayout>{children}</DashboardLayout>
        </ClientProvider>
      </body>
    </html>
  );
}
