import type { Metadata } from 'next';
import './globals.css';
import { ClientProvider } from '@/context/ClientContext';
import ConditionalLayout from '@/components/layout/ConditionalLayout';

export const metadata: Metadata = {
  title: 'MNA Dashboard — Mother Nature Agency',
  description: 'Premium marketing intelligence dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,300..700,0..1,-50..200&display=block"
        />
      </head>
      <body>
        <ClientProvider>
          <ConditionalLayout>
            {children}
          </ConditionalLayout>
        </ClientProvider>
      </body>
    </html>
  );
}
