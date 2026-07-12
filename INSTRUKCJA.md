# Monitor źródeł zakupu (Allegro) — czy mój towar wciąż da się kupić tanio?

Jak to działa: dla KAŻDEGO Twojego produktu (para: oferta wpięta + odpięta o tej samej nazwie)
monitor co 3 godziny sprawdza przez API Allegro, czy istnieją jeszcze oferty INNYCH sprzedawców
pasujące do tego produktu — czyli Twoje potencjalne źródła zakupu (dowolny tani sprzedawca, nie jeden konkretny).

Na dashboardzie widzisz per produkt:
- 🟢 **DOSTĘPNY** — jest skąd kupić; pokazujemy najniższą cudzą cenę i liczbę źródeł,
- 🟠 **ŹRÓDŁO +X%** — najtańsze źródło podrożało ponad Twój próg względem ceny z dnia startu,
- 🔴 **BRAK ŹRÓDŁA — NIE KUPISZ** — nie ma już żadnej pasującej cudzej oferty → pauzuj/usuń swoje.

Ręcznie nie wpisujesz ŻADNEJ listy — generator buduje ją sam z Twojego konta.

---

## KROK 1 — Aplikacja Allegro (raz, 5 min)
1. **apps.developer.allegro.pl** → zaloguj się → **Zarejestruj nową aplikację**, typ „bez udziału użytkownika" (Client credentials).
2. Zapisz **Client ID** i **Client Secret**.

## KROK 2 — GitHub (raz, 5 min)
1. Konto na **github.com** → **New repository** → nazwa `monitor` → **Public** → Create.
2. **uploading an existing file** → wrzuć całą zawartość ZIP-a (z folderem `.github`) → Commit.
3. **Settings → Secrets and variables → Actions** → dodaj sekrety `ALLEGRO_CLIENT_ID` i `ALLEGRO_CLIENT_SECRET`.
4. **Settings → Pages** → Deploy from a branch → `main` / root → Save → po 2 min masz adres swojej strony.

## KROK 3 — Konfiguracja (raz, 2 min)
Edytuj w repo plik **`konfiguracja.json`**:
```json
{
  "mojeKonto": { "login": "SiteHive", "sellerId": "TU_TWOJE_ID" },
  "progWzrostuProc": 25,          ← alert, gdy najtańsze źródło podrożeje o tyle %
  "minLiczbaDostawcow": 1,        ← poniżej tylu źródeł = status BRAK ŹRÓDŁA
  "minPodobienstwoTytulu": 0.55   ← czułość dopasowania cudzych ofert (nie ruszaj na start)
}
```
**Twoje sellerId**: wejdź na dowolną SWOJĄ ofertę, F12 → Console, wklej:
```js
[...new Set(document.documentElement.innerHTML.match(/"sellerId":"?\d+/g)||[])].join('\n')
```

## KROK 4 — Generator (1 klik, ~15-30 min przy 5000 ofert)
Actions → **„Generator listy produktow"** → Run workflow.
Generator pobiera wszystkie Twoje oferty, skleja pary po tytule (5000 ofert ≈ 2500 produktów)
i dla każdego zapisuje dzisiejszą najniższą cenę cudzą jako bazę. Wynik: plik `produkty.json`.

## KROK 5 — Start monitora
Actions → **„Monitor dostawcow Allegro"** → Run workflow. Potem chodzi sam co 3h.
Wejdź na swoją stronę — tabela gotowa, problemy zawsze na górze, filtr „Tylko problemy" na rano.

---

## Codzienna obsługa
- Usunięcie produktu z monitora: „✏️ Edytuj listę produktów" na stronie → kasujesz jego blok w `produkty.json`.
- Nowe oferty na koncie: odpal generator ponownie (przebuduje listę i zaktualizuje ceny bazowe).
- „dane starsze niż 4h" na górze strony = zajrzyj w Actions i kliknij Run workflow
  (GitHub usypia harmonogram po ~60 dniach bez zmian w repo).

## Jak monitor rozpoznaje „źródła" i jakie ma ograniczenia
- API Allegro nie pozwala zapytać wprost „pokaż oferty w tym samym katalogu", więc monitor szuka
  cudzych ofert po tytule produktu (Twoje wpięte oferty i oferty w katalogu mają praktycznie te same nazwy)
  w tej samej kategorii i odfiltrowuje za mało podobne. W praktyce = zawartość katalogu + ewentualne
  bliźniacze oferty spoza niego (co jest OK — to też Twoje potencjalne źródło).
- Jeśli jakiś produkt pokazuje dziwne „źródło", otwórz link „źródło ↗" i oceń; fałszywe dopasowanie
  wytniesz podnosząc `minPodobienstwoTytulu` (np. do 0.7) albo edytując nazwę w `produkty.json` na dokładniejszą.
- Nie widzimy stanów magazynowych źródła — tylko moment, gdy oferta znika (max 3h opóźnienia).
- Wersja 2 (do dopisania po wdrożeniu): alert, gdy najtańsze źródło wydłuży czas wysyłki.
