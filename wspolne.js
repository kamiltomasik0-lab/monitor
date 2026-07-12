// Funkcje wspólne generatora i monitora.
const API = 'https://api.allegro.pl';
const ACCEPT = 'application/vnd.allegro.public.v1+json';

async function getToken() {
  const res = await fetch('https://allegro.pl/auth/oauth/token?grant_type=client_credentials', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(`${process.env.ALLEGRO_CLIENT_ID}:${process.env.ALLEGRO_CLIENT_SECRET}`).toString('base64') }
  });
  if (!res.ok) throw new Error('Token: ' + res.status + ' ' + (await res.text()));
  return (await res.json()).access_token;
}

async function listing(token, params) {
  const p = new URLSearchParams(params);
  const res = await fetch(`${API}/offers/listing?${p}`, { headers: { Authorization: `Bearer ${token}`, Accept: ACCEPT } });
  if (!res.ok) throw new Error(`Listing ${res.status}: ` + (await res.text()));
  return res.json();
}

// wszystkie oferty sprzedawcy (z podziałem po kategoriach przy dużych kontach)
async function fetchAllSellerOffers(token, sellerId) {
  const seen = new Map();
  async function drain(extra) {
    let offset = 0, total = Infinity;
    while (offset < total && offset < 5900) {
      const data = await listing(token, { ...extra, 'seller.id': sellerId, limit: '100', offset: String(offset) });
      const items = [...(data.items?.promoted || []), ...(data.items?.regular || [])];
      items.forEach(o => seen.set(String(o.id), o));
      total = data.searchMeta?.availableCount ?? 0;
      if (!items.length) break;
      offset += 100;
      await new Promise(r => setTimeout(r, 150));
    }
    return { total, first: null };
  }
  const { total } = await drain({});
  if (total > 5900) {
    const first = await listing(token, { 'seller.id': sellerId, limit: '100', offset: '0' });
    for (const c of (first.categories?.subcategories || [])) await drain({ 'category.id': c.id });
  }
  return seen;
}

const norm = s => (s || '').toLowerCase()
  .replace(/[ąćęłńóśźż]/g, ch => ({ą:'a',ć:'c',ę:'e',ł:'l',ń:'n',ó:'o',ś:'s',ź:'z',ż:'z'}[ch]))
  .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const tokens = s => new Set(norm(s).split(' ').filter(w => w.length > 1));
function similarity(a, b) {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0; A.forEach(t => B.has(t) && inter++);
  return 0.5 * (inter / (A.size + B.size - inter)) + 0.5 * (inter / Math.min(A.size, B.size));
}

// Szuka OFERT INNYCH SPRZEDAWCÓW pasujących do produktu (fraza = tytuł, sortowanie po cenie).
// Zwraca najniższą cenę cudzą, liczbę dostawców i najtańszą ofertę.
async function findSuppliers(token, produkt, cfg) {
  const phrase = norm(produkt.nazwa).split(' ').slice(0, 12).join(' ');
  const params = { phrase, limit: '60', offset: '0', sort: '+price' };
  if (produkt.kategoria) params['category.id'] = produkt.kategoria;
  let data;
  try { data = await listing(token, params); }
  catch (e) {
    if (produkt.kategoria) data = await listing(token, { phrase, limit: '60', offset: '0', sort: '+price' });
    else throw e;
  }
  const items = [...(data.items?.promoted || []), ...(data.items?.regular || [])];
  const minSim = cfg.minPodobienstwoTytulu ?? 0.55;
  const others = items.filter(o =>
    String(o.seller?.id) !== String(cfg.mojeKonto.sellerId) &&
    similarity(produkt.nazwa, o.name) >= minSim
  );
  const withPrice = others
    .map(o => ({ id: String(o.id), nazwa: o.name, cena: parseFloat(o.sellingMode?.price?.amount ?? 'NaN'), sprzedawca: o.seller?.login || o.seller?.id }))
    .filter(o => !isNaN(o.cena))
    .sort((a, b) => a.cena - b.cena);
  return {
    najnizszaCena: withPrice[0]?.cena ?? null,
    najtanszaOferta: withPrice[0] ?? null,
    liczbaDostawcow: withPrice.length
  };
}

module.exports = { getToken, listing, fetchAllSellerOffers, findSuppliers, norm, similarity };
