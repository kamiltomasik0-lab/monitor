// GENERATOR LISTY PRODUKTÓW: pobiera wszystkie Twoje oferty, grupuje pary
// (wpięta + odpięta = ten sam tytuł) i dla każdego produktu zapisuje bazową
// najniższą cenę INNYCH sprzedawców (Twoich potencjalnych źródeł).
const fs = require('fs');
const { getToken, fetchAllSellerOffers, findSuppliers, norm } = require('./wspolne.js');

(async () => {
  const cfg = JSON.parse(fs.readFileSync('konfiguracja.json', 'utf8'));
  const token = await getToken();

  console.log('Pobieram Twoje oferty...');
  const mine = [...(await fetchAllSellerOffers(token, cfg.mojeKonto.sellerId)).values()];
  const groups = new Map();
  for (const o of mine) {
    const k = norm(o.name);
    if (!groups.has(k)) groups.set(k, { nazwa: o.name, mojeOferty: [], kategoria: o.category?.id || null });
    groups.get(k).mojeOferty.push(String(o.id));
  }
  console.log(`Twoje oferty: ${mine.length} -> produktów (par): ${groups.size}`);

  const out = [];
  let i = 0;
  for (const [, g] of groups) {
    i++;
    if (i % 100 === 0) console.log(`  ${i}/${groups.size}...`);
    const sup = await findSuppliers(token, g, cfg);
    out.push({
      nazwa: g.nazwa,
      mojeOferty: g.mojeOferty,
      kategoria: g.kategoria,
      cenaStartowaDostawcy: sup.najnizszaCena,      // baza do liczenia podwyżek
      progWzrostuProc: cfg.progWzrostuProc ?? 25
    });
    await new Promise(r => setTimeout(r, 120));
  }

  fs.writeFileSync('produkty.json', JSON.stringify(out, null, 2));
  const bez = out.filter(p => p.cenaStartowaDostawcy == null).length;
  console.log(`GOTOWE: ${out.length} produktów w monitorze. Bez żadnego źródła już na starcie: ${bez} (sprawdź je na dashboardzie po pierwszym przebiegu monitora).`);
})();
