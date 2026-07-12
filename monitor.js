// MONITOR ŹRÓDEŁ: dla każdego Twojego produktu sprawdza, czy na Allegro
// wciąż istnieją tanie oferty innych sprzedawców (Twoje źródła zakupu).
const fs = require('fs');
const { getToken, findSuppliers } = require('./wspolne.js');

(async () => {
  const cfg = JSON.parse(fs.readFileSync('konfiguracja.json', 'utf8'));
  const produkty = JSON.parse(fs.readFileSync('produkty.json', 'utf8'));
  let old = {};
  try { old = Object.fromEntries(JSON.parse(fs.readFileSync('data.json', 'utf8')).oferty.map(o => [o.nazwa, o])); } catch {}

  const token = await getToken();
  const out = [];
  let i = 0;
  for (const p of produkty) {
    i++;
    if (i % 200 === 0) console.log(`  ${i}/${produkty.length}...`);
    const prev = old[p.nazwa] || {};
    const row = { ...p, status: 'BŁĄD', cenaAktualna: null, zmianaProc: null, liczbaDostawcow: 0,
                  najtanszaOferta: null, historia: prev.historia || [], blad: null };
    try {
      const sup = await findSuppliers(token, p, cfg);
      row.liczbaDostawcow = sup.liczbaDostawcow;
      row.najtanszaOferta = sup.najtanszaOferta;
      row.cenaAktualna = sup.najnizszaCena;
      if (sup.liczbaDostawcow < (cfg.minLiczbaDostawcow ?? 1) || sup.najnizszaCena == null) {
        row.status = 'BRAK ŹRÓDŁA';
      } else {
        row.status = 'DOSTĘPNY';
        if (p.cenaStartowaDostawcy)
          row.zmianaProc = Math.round((sup.najnizszaCena - p.cenaStartowaDostawcy) / p.cenaStartowaDostawcy * 1000) / 10;
      }
      row.historia = [...row.historia, { t: new Date().toISOString(), cena: row.cenaAktualna, n: row.liczbaDostawcow }].slice(-60);
    } catch (e) { row.blad = String(e.message).slice(0, 200); }
    row.alert = row.status === 'BRAK ŹRÓDŁA' ? 2
              : (row.zmianaProc !== null && row.zmianaProc >= (p.progWzrostuProc ?? cfg.progWzrostuProc ?? 25)) ? 1
              : row.blad ? 3 : 0;
    out.push(row);
    await new Promise(r => setTimeout(r, 120));
  }

  fs.writeFileSync('data.json', JSON.stringify({ aktualizacja: new Date().toISOString(), oferty: out }, null, 2));
  console.log(`OK: ${out.length} produktów, brak źródła: ${out.filter(o=>o.alert===2).length}, podwyżki: ${out.filter(o=>o.alert===1).length}`);
})();
