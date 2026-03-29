'use client';
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { clients, Client } from '@/lib/clients';

type ClientContextType = {
  activeClient: Client;
  setActiveClientId: (id: string) => void;
  allClients: Client[];
};

const ClientContext = createContext<ClientContextType | null>(null);

export function ClientProvider({ children }: { children: ReactNode }) {
  const [activeClientId, setActiveClientId] = useState('mna');
  const activeClient = clients.find(c => c.id === activeClientId) ?? clients[0];

  return (
    <ClientContext.Provider value={{ activeClient, setActiveClientId, allClients: clients }}>
      {children}
    </ClientContext.Provider>
  );
}

export function useClient() {
  const ctx = useContext(ClientContext);
  if (!ctx) throw new Error('useClient must be used within ClientProvider');
  return ctx;
}
