# Sfera wiedzy 3D

Interaktywna, statyczna strona WWW prezentująca kolekcję obrazów na powierzchni obracanej sfery 3D. Każdy obraz otwiera kartę z dopasowaną ciekawostką, tytułem, kategorią i opisem.

![Podgląd projektu](assets/og-preview.png)

Wersja publiczna: [apkmasondev.github.io/sfera](https://apkmasondev.github.io/sfera/)

## Najważniejsze funkcje

- równomierne rozmieszczenie obrazów algorytmem Fibonacci sphere;
- obracanie myszą i dotykiem, bezwładność, zoom oraz automatyczna rotacja;
- interaktywne wyróżnienie obrazu i responsywna karta ciekawostki;
- zamykanie karty przyciskiem, klawiszem `Escape` lub kliknięciem tła;
- automatycznie generowany manifest wszystkich plików WebP;
- czysty, minimalny model danych i bezpieczny fallback dla brakującej treści;
- responsywny interfejs, favicony, Open Graph, Twitter Cards, sitemap i robots.txt;
- brak backendu i frameworków aplikacyjnych.

## Technologie

- HTML5, CSS i JavaScript ES Modules;
- [Three.js](https://threejs.org/) 0.185.1 hostowany lokalnie w repozytorium;
- Node.js używany wyłącznie do lokalnego serwera i generowania danych;
- WebP dla obrazów kolekcji.

## Wymagania

- Node.js 18 lub nowszy;
- nowoczesna przeglądarka z obsługą WebGL.

Projekt nie ma pakietów npm wymagających instalacji.

## Uruchomienie lokalne

```bash
npm run build
npm start
```

Strona będzie dostępna pod adresem:

```text
http://127.0.0.1:4173
```

Nie należy otwierać `index.html` bezpośrednio przez `file://`, ponieważ przeglądarka blokuje wtedy pobieranie plików JSON przez `fetch()`.

## Dostępne skrypty

| Polecenie | Działanie |
| --- | --- |
| `npm start` | Uruchamia lekki lokalny serwer na porcie 4173. |
| `npm run manifest` | Skanuje rekurencyjnie `images/` i tworzy `manifest.json`. |
| `npm run content` | Scala dane bazowe i dodatki do `content.json`. |
| `npm run build` | Generuje kolejno manifest i kompletny plik treści. |

## Struktura projektu

```text
.
├── assets/                    # favicony, Open Graph i generator zasobów marki
├── images/facts/              # obrazy ciekawostek WebP
├── index.html                 # struktura strony i metadane SEO
├── style.css                  # interfejs, karta i responsywność
├── main.js                    # scena Three.js i interakcje
├── sphere-focus.js            # kinowe skupienie i wyróżnianie kategorii
├── vendor/three/              # lokalny, przypięty build Three.js wraz z licencją
├── content-store.js           # wczytywanie i dopasowywanie ciekawostek
├── content-source.json        # jedno źródło wszystkich oczyszczonych rekordów
├── content.json               # wynikowy plik używany przez stronę
├── manifest.json              # wynikowa lista obrazów
├── generate-content.js        # generator i walidator treści
├── generate-manifest.js       # generator manifestu obrazów
├── dev-server.js              # lokalny serwer statyczny
├── robots.txt
└── sitemap.xml
```

`content.json` i `manifest.json` są plikami generowanymi. Nie należy edytować ich ręcznie, ponieważ następne `npm run build` nadpisze zmiany.

## Aktualizacja Three.js

Aplikacja używa lokalnej, przypiętej wersji `0.185.1`, dzięki czemu podczas działania nie łączy się z zewnętrznym CDN. Pliki `three.module.min.js`, `three.core.min.js` i odpowiadającą im licencję należy aktualizować razem, wyłącznie z oficjalnego pakietu `three` o tej samej wersji. Po zmianie wersji trzeba uruchomić build i test strony w przeglądarce.

## Dodawanie kolejnych ciekawostek

1. Dodaj obraz WebP do `images/facts/`. Nazwa musi być unikalna i zgodna ze schematem `kategoria_numer.webp`, np. `astronomia_8.webp`.
2. Dodaj rekord do `content-source.json`. Kluczem jest dokładna nazwa obrazu zapisana małymi literami.
3. Uruchom `npm run build`.
4. Sprawdź stronę lokalnie przez `npm start`.

Minimalny rekord:

```json
{
  "astronomia_8.webp": {
    "image": "astronomia_8.webp",
    "category": "Astronomia",
    "title": "Tytuł ciekawostki",
    "summary": "Jednozdaniowa zajawka.",
    "text": "Pełna, zwięzła treść ciekawostki."
  }
}
```

Wszystkie pięć pól jest wymaganych. Generator zatrzyma build, jeśli rekord koliduje z istniejącą nazwą, ma brakujące lub zbędne pola albo nie posiada odpowiadającego obrazu. Walidacja działa również w drugą stronę — każdy obraz z manifestu musi mieć ciekawostkę.

Jeśli obraz nie ma rekordu, strona nadal działa i pokazuje neutralny tekst zastępczy. Taki stan powinien być jednak traktowany jako błąd danych przed publikacją.

## Konfiguracja sfery

Najważniejsze parametry znajdują się na początku `main.js`:

- `SPHERE_RADIUS` — promień sfery;
- `IMAGE_SIZE` — rozmiar kafelków;
- `IMAGE_COUNT` — limit wyświetlanych obrazów;
- `AUTO_ROTATE_SPEED` i `AUTO_ROTATE_DELAY` — autorotacja;
- `MIN_CAMERA_DISTANCE` i `MAX_CAMERA_DISTANCE` — zakres zoomu;
- `LOAD_CONCURRENCY` — liczba równolegle ładowanych tekstur.
- `TEXTURE_MAX_SIZE` — maksymalny rozmiar tekstury WebGL; oryginał pozostaje dostępny w karcie.
- `INITIAL_REVEAL_RATIO` — część tekstur wymagana przed odsłonięciem interaktywnej sfery.

## Zasoby SEO

Po zmianie liczby obrazów można ponownie wygenerować favicony i grafikę Open Graph. Skrypt odczyta aktualną liczbę pozycji z `manifest.json`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-Expression (Get-Content -Raw -Encoding UTF8 -LiteralPath './assets/generate-brand-assets.ps1')"
```

Docelowy adres wdrożenia jest zapisany w `index.html`, `robots.txt` i `sitemap.xml`. Przy zmianie domeny należy zaktualizować wszystkie trzy pliki.

## Wdrożenie na GitHub Pages

Projekt działa poprawnie jako witryna projektu pod ścieżką `/sfera/`, ponieważ zasoby aplikacji używają odnośników względnych.

Przed publikacją:

1. uruchom `npm run build`;
2. sprawdź, czy liczba wpisów w `manifest.json` i `content.json` jest taka sama;
3. zatwierdź wygenerowane JSON-y oraz zasoby z katalogu `assets/`;
4. opublikuj katalog główny repozytorium przez GitHub Pages.

Aktualna konfiguracja SEO wskazuje na `https://apkmasondev.github.io/sfera/`.

## Historia zmian

Istotne zmiany są dokumentowane w [CHANGELOG.md](CHANGELOG.md).
