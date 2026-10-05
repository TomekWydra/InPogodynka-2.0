# InPogodynka-2.0
InPogodynka 2.2.0 — dodatek do Chrome pokazujący pogodę i jakość powietrza przy paczkomacie InPost.
# InPogodynka

InPogodynka to dodatek do przeglądarki Google Chrome, który pokazuje pogodę i jakość powietrza przy wybranym paczkomacie InPost.

Rozszerzenie zmienia stronę nowej karty Chrome w przejrzysty panel pogodowy dla lokalizacji paczkomatu.
Projekt hobbystyczny

## Funkcje

InPogodynka pokazuje:

- nazwę i adres wybranego paczkomatu,
- współrzędne geograficzne paczkomatu,
- aktualną temperaturę,
- wilgotność powietrza,
- ciśnienie atmosferyczne,
- prognozę pogody na pięć dni,
- historię temperatury,
- wykres temperatury historycznej,
- dane jakości powietrza z paczkomatu,
- PM2,5,
- PM10,
- ozon O₃,
- dwutlenek azotu NO₂,
- temperaturę z paczkomatu,
- ciśnienie z paczkomatu,
- wilgotność z paczkomatu,
- pomiar z najbliższej stacji IMGW-PIB,
- nazwę stacji IMGW,
- współrzędne stacji IMGW,
- odległość stacji od paczkomatu,
- wysokość stacji nad poziomem morza,
- czas wykonania pomiaru,
- temperaturę, wilgotność, wiatr i opad ze stacji IMGW, jeśli dane są dostępne.

## Źródła danych

### InPost

InPost jest źródłem:

- lokalizacji paczkomatu,
- nazwy paczkomatu,
- adresu paczkomatu,
- danych sensorów dostępnych na stronie paczkomatu.

### Open-Meteo

Open-Meteo jest źródłem:

- aktualnej pogody dla współrzędnych paczkomatu,
- historii temperatury,
- prognozy na pięć dni.

### IMGW-PIB

IMGW-PIB jest źródłem rzeczywistych pomiarów meteorologicznych z najbliższej stacji.

Aplikacja pokazuje:

- nazwę stacji,
- współrzędne stacji,
- odległość stacji od paczkomatu,
- wysokość stacji,
- czas pomiaru,
- temperaturę,
- wilgotność,
- wiatr,
- kierunek wiatru,
- poryw wiatru,
- opad.

Jeśli IMGW nie zwróci konkretnego parametru, aplikacja pokazuje komunikat „brak danych”.

## Wymagania

- Google Chrome z obsługą Manifest V3,
- połączenie z internetem,
- strona wybranego paczkomatu InPost,
- adres URL paczkomatu InPost.

## Instalacja lokalna

1. Pobierz lub sklonuj repozytorium.
2. Otwórz w Chrome adres:

   `chrome://extensions`

3. Włącz „Tryb deweloperski”.
4. Kliknij „Wczytaj rozpakowane”.
5. Wybierz folder zawierający bezpośrednio plik `manifest.json`.
6. Otwórz stronę wybranego paczkomatu InPost.
7. Otwórz konfigurację InPogodynki.
8. Wklej adres strony paczkomatu.
9. Otwórz nową kartę Chrome.

## Konfiguracja

1. Otwórz ustawienia dodatku.
2. Wpisz adres strony paczkomatu InPost.
3. Zapisz ustawienia.
4. Otwórz nową kartę.
5. Kliknij „Odśwież”, aby pobrać aktualne dane.

## Automatyczne odświeżanie

Rozszerzenie wykorzystuje alarm Chrome do okresowego odświeżania danych pogodowych.

Dodatkowo dane można odświeżyć ręcznie przyciskiem „Odśwież” na stronie nowej karty.

## Przechowywanie danych

Ustawienia i dane aplikacji są przechowywane lokalnie w pamięci rozszerzenia Chrome przy użyciu `chrome.storage.local`.

Rozszerzenie przechowuje między innymi:

- adres paczkomatu,
- nazwę i lokalizację paczkomatu,
- dane pogodowe,
- pomiary IMGW,
- historię temperatury,
- dane sensorów InPost,
- informacje o ostatniej aktualizacji.

## Prywatność

InPogodynka nie posiada własnego serwera aplikacyjnego.

Rozszerzenie pobiera dane bezpośrednio z:

- InPost,
- Open-Meteo,
- IMGW-PIB.

Dane ustawień i historia są przechowywane lokalnie w przeglądarce użytkownika.

## Uprawnienia

Rozszerzenie używa następujących uprawnień:

- `storage` — zapis ustawień, pogody i historii lokalnie,
- `alarms` — okresowe odświeżanie danych,
- `tabs` — otwieranie strony paczkomatu i karty pomiarowej.

Rozszerzenie korzysta z dostępu do następujących domen:

- `api.open-meteo.com`,
- `inpost.pl`,
- `danepubliczne.imgw.pl`.

## Ograniczenia

- Dostępność danych zależy od działania zewnętrznych usług.
- Nie każda stacja IMGW udostępnia wszystkie parametry.
- Przy braku pomiaru aplikacja pokazuje „brak danych”.
- Dane z najbliższej stacji IMGW nie są dokładnym pomiarem wykonanym przy paczkomacie.
- Prognoza Open-Meteo jest prognozą modelową dla współrzędnych paczkomatu.

## Autor

InPogodynka 2.2

Autor: Tomasz Wydra

Strona:
https://www.wydra.waw.pl

## Informacja o danych IMGW

Źródłem pochodzenia danych IMGW-PIB jest Instytut Meteorologii i Gospodarki Wodnej – Państwowy Instytut Badawczy.

Dane IMGW-PIB zostały przetworzone.

## Wesprzyj InPogodynkę

Jeśli podoba Ci się projekt, możesz postawić mi wirtualną kawę:

[https://buycoffee.to/twydra](https://buycoffee.to/twydra)

Dziękuję za każde wsparcie!

## Licencja

Kod projektu jest udostępniany na warunkach opisanych w pliku `LICENSE`.
