import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const BASE = 'https://emsifa.github.io/api-wilayah-indonesia/api';

interface City {
  id: string;
  name: string;
  type: 'Kota' | 'Kabupaten';
  province: string;
}

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// Module-scope cache — persists across requests on the same warm serverless instance.
let cache: City[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h — city lists don't change

async function loadCities(): Promise<City[]> {
  if (cache && Date.now() - cacheTime < CACHE_TTL) return cache;

  const provRes = await fetch(`${BASE}/provinces.json`);
  const provinces: { id: string; name: string }[] = await provRes.json();

  const perProvince = await Promise.all(
    provinces.map(async (p) => {
      try {
        const res = await fetch(`${BASE}/regencies/${p.id}.json`);
        const regencies: { id: string; name: string }[] = await res.json();
        return regencies.map((r) => {
          const isKota = r.name.toUpperCase().startsWith('KOTA');
          const cleanName = r.name.replace(/^KABUPATEN\s+|^KOTA\s+/i, '');
          return {
            id: r.id,
            name: toTitleCase(cleanName),
            type: (isKota ? 'Kota' : 'Kabupaten') as 'Kota' | 'Kabupaten',
            province: toTitleCase(p.name),
          };
        });
      } catch {
        return [];
      }
    })
  );

  cache = perProvince.flat();
  cacheTime = Date.now();
  return cache;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim().toLowerCase();

  try {
    const cities = await loadCities();
    const filtered = q ? cities.filter((c) => c.name.toLowerCase().includes(q)) : cities;
    return NextResponse.json(filtered.slice(0, 20));
  } catch (error) {
    console.error('Error fetching cities:', error);
    return NextResponse.json({ error: 'Failed to fetch cities' }, { status: 502 });
  }
}
