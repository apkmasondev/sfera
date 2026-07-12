# Historia zmian

W tym pliku dokumentowane są istotne zmiany projektu. Format jest oparty na [Keep a Changelog](https://keepachangelog.com/pl/1.1.0/), a numeracja wersji na [Semantic Versioning](https://semver.org/lang/pl/).

## [Unreleased]

### Zmieniono

- scalono `content-base.json` i `content-additions.json` w jedno źródło `content-source.json`;
- uproszczono generator treści bez utraty walidacji zgodności z obrazami.
- zmniejszono tekstury sfery do 256×256 bez obniżania jakości obrazów w kartach;
- ograniczono alokacje pamięci w pętli renderującej i wyłączono zbędne mipmapy;
- dodano progresywne odsłanianie sfery po przygotowaniu pierwszych 20% tekstur;
- dodano Content Security Policy, politykę referrerów i utwardzono lokalny serwer;
- dodano prefiksy `backdrop-filter` dla starszych wersji Safari.

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
