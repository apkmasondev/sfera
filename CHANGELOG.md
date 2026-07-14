# Historia zmian

W tym pliku dokumentowane są istotne zmiany projektu. Format jest oparty na [Keep a Changelog](https://keepachangelog.com/pl/1.1.0/), a numeracja wersji na [Semantic Versioning](https://semver.org/lang/pl/).

## [Unreleased]

### Zmieniono

- dodano płynne przejście klikniętego obrazu ze sfery do karty i jego animowany powrót, z obsługą urządzeń mobilnych oraz preferencji ograniczonego ruchu;
- zsynchronizowano prostowanie klikniętego obrazu z kinowym ustawianiem sfery, usuwając nagły obrót przed przejściem do karty;
- zastąpiono rozciąganie miniatur na sferze proporcjonalnym kadrowaniem typu `cover` i ustabilizowano wysokość obrazu w karcie niezależnie od długości opisu;
- poprawiono mobilne karty z dłuższymi opisami przez wydzielenie przewijanej sekcji treści i obsługę dynamicznej wysokości ekranu;
- dodano 14 zweryfikowanych ciekawostek i obrazów w kategoriach „Literatura i Książki” oraz „Ciekawostki Korporacyjne”, zwiększając kolekcję do 238 pozycji w 34 kategoriach;
- dodano 14 zweryfikowanych ciekawostek i obrazów w kategoriach „Lata sześćdziesiąte” oraz „Lata dwutysięczne”, zwiększając kolekcję do 224 pozycji;
- zmieniono etykietę przycisku losowania z „Losuj ciekawostkę” na „Losowy obraz”;
- poprawiono czytelność mobilnych elementów sterujących przez subtelny panel z rozmyciem tła, mocniejszy kontrast opisów i obsługę bezpiecznego obszaru ekranu;
- dodano 7 zweryfikowanych ciekawostek i obrazów w kategorii „Kultura i Tradycje Świata”, zwiększając kolekcję do 210 pozycji;
- dodano 14 zweryfikowanych ciekawostek i obrazów w kategoriach „Motoryzacja” oraz „Lata siedemdziesiąte”, zwiększając kolekcję do 203 pozycji;
- dodano 14 zweryfikowanych ciekawostek i obrazów w kategoriach „Lata osiemdziesiąte” oraz „Historia gier wideo”, zwiększając kolekcję do 189 pozycji;
- dodano losowanie ciekawostek, kopiowanie bezpośrednich linków `?fact=ID` oraz obsługę nawigacji Wstecz/Dalej;
- usunięto sporadyczny skok sfery po zamknięciu karty przez ujednolicenie obrotu na quaternionach i bezpieczne przejmowanie kończącej się animacji powrotu;
- poprawiono wybieranie obrazów na ekranach dotykowych przez świeży raycast, większą tolerancję mikroruchu palca i rozdzielenie tapnięcia od gestów wielodotykowych;
- dodano kinowe ustawianie klikniętego obrazu przed kamerą, wyróżnianie jego kategorii oraz płynne przywracanie sfery po zamknięciu karty;
- przeprowadzono pełny audyt redakcyjno-faktograficzny 175 ciekawostek, usuwając nielogiczne sformułowania, popularne mity, nieuzasadnione rekordy i oczywiste nieścisłości;
- scalono `content-base.json` i `content-additions.json` w jedno źródło `content-source.json`;
- uproszczono generator treści bez utraty walidacji zgodności z obrazami.
- zmniejszono tekstury sfery do 256×256 bez obniżania jakości obrazów w kartach;
- ograniczono alokacje pamięci w pętli renderującej i wyłączono zbędne mipmapy;
- dodano progresywne odsłanianie sfery po przygotowaniu pierwszych 20% tekstur;
- dodano Content Security Policy, politykę referrerów i utwardzono lokalny serwer;
- dodano prefiksy `backdrop-filter` dla starszych wersji Safari.
- przeniesiono przypiętą wersję Three.js 0.185.1 z CDN do lokalnego katalogu `vendor/three/` i usunięto zewnętrzne połączenia z polityki CSP.
- zaktualizowano i rozbudowano treść ciekawostek w 21 kategoriach.
- wyłączono możliwość zaznaczania tekstu dla elementów interfejsu (hero, status, podpowiedzi, reset), zachowując ją dla karty ciekawostki.

## [1.0.0] - 2026-07-12

### Dodano

- interaktywną sferę 3D z równomiernym rozmieszczeniem obrazów;
- sterowanie myszą i dotykiem, zoom, bezwładność oraz autorotację;
- progresywne ładowanie tekstur i ekran postępu;
- animowaną, responsywną kartę ciekawostki z obsługą fallbacku;
- generowanie `manifest.json` na podstawie zawartości `images/`;
- generowanie i walidację minimalnego `content.json`;
- obsługę bazowych danych oraz późniejszych rekordów z `content-additions.json`;
- 175 powiązanych obrazów i ciekawostek;
- favicony, Apple Touch Icon i grafikę Open Graph;
- metadane SEO, Twitter Cards, `robots.txt` oraz `sitemap.xml`;
- lokalny serwer statyczny bez zależności zewnętrznych;
- konfigurację adresu GitHub Pages `https://apkmasondev.github.io/sfera/`.

### Zmieniono

- przeniesiono starszy, jednorazowy eksport do czystego `content-base.json` i usunięto plik importowy `data.txt`;
- wydzielono logikę pobierania i dopasowywania treści do osobnego modułu;
- rozszerzono lokalny serwer o poprawne typy MIME dla zasobów SEO.
