// Server-side brand lookup for a client id.
//
// Built-in clients live in lib/clients.ts; locations staff added through
// onboarding live in custom_clients. The Graphic Lab needs the palette and
// logo for whichever it is, so both are resolved here in one place.

import { clients as staticClients, makeCustomClient } from '@/lib/clients';
import { query } from '@/lib/db';

export type BrandInfo = {
  id: string;
  name: string;
  shortName: string;
  industry: string;
  location?: string;
  primary: string;
  secondary: string;
  accent: string;
  gradientFrom: string;
  gradientTo: string;
  logoUrl?: string;
  logoText?: string;
  website?: string;
  notes?: string;
};

function toBrand(c: { id: string; name: string; shortName: string; industry: string; location?: string; branding: any; links?: any; notes?: string }): BrandInfo {
  return {
    id: c.id,
    name: c.name,
    shortName: c.shortName,
    industry: c.industry,
    location: c.location,
    primary: c.branding.primaryColor,
    secondary: c.branding.secondaryColor,
    accent: c.branding.accentColor,
    gradientFrom: c.branding.gradientFrom,
    gradientTo: c.branding.gradientTo,
    logoUrl: c.branding.logoUrl,
    logoText: c.branding.logoText || c.shortName,
    website: c.links?.website,
    notes: c.notes,
  };
}

export async function getBrand(clientId: string): Promise<BrandInfo> {
  const builtIn = staticClients.find((c) => c.id === clientId);
  if (builtIn) return toBrand(builtIn);

  try {
    const { rows } = await query<any>(
      `select id, name, short_name, location, logo_url, industry, brand_from, brand_to, notes
         from custom_clients where id = $1 limit 1`,
      [clientId],
    );
    if (rows[0]) {
      const r = rows[0];
      return toBrand(makeCustomClient({
        id: r.id, name: r.name, shortName: r.short_name, location: r.location,
        logoUrl: r.logo_url, industry: r.industry,
        brandFrom: r.brand_from, brandTo: r.brand_to, notes: r.notes,
      }));
    }
  } catch { /* fall through to the agency's own palette */ }

  return toBrand(staticClients[0]);
}
