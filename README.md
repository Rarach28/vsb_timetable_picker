# Rozvrh - Výběr Předmětů

Tento projekt umožňuje interaktivní výběr a zobrazení rozvrhu. Data rozvrhu jsou načítána z JSON souborů, které obsahují odpovědi API z Edisonu pro každý předmět.

## Popis

Aplikace zobrazuje rozvrh formou tabulky s dny v týdnu a časovými sloty. Uživatel si může vybrat jednotlivé hodiny (předměty) a zobrazit tak pouze ty, které ho zajímají. K dispozici je i filtrování podle názvu předmětu.

## Technologie

*   **React:** Frontend framework pro uživatelské rozhraní.
*   **Tailwind CSS:** CSS framework pro stylování.

## Instalace

1.  Naklonujte repozitář:
    ```bash
    git clone [https://github.com/VášUživatel/NázevRepozitáře.git](https://github.com/VášUživatel/NázevRepozitáře.git)  # Nahraďte svými údaji
    cd NázevRepozitáře
    ```

2.  Nainstalujte závislosti:
    ```bash
    npm install
    ```

3.  Spusťte vývojový server:
    ```bash
    npm start
    ```

## Struktura projektu

*   `src/App.js`: Hlavní komponenta aplikace, která řídí stav a renderování.
*   `src/assets/config/*.json`: Soubory s daty rozvrhu. Každý soubor obsahuje data pro jeden předmět ve formátu JSON, získané z Edison API.
*   `public/index.html`: Hlavní HTML soubor aplikace.
*   `package.json`: Soubor s metadaty projektu a závislostmi.

## Použití

1.  Po spuštění aplikace se zobrazí rozvrh.
2.  Kliknutím na název předmětu v horní části obrazovky se zobrazí/skryjí všechny hodiny daného předmětu.
3.  Kliknutím na konkrétní hodinu v rozvrhu se tato hodina vybere/odznačí. Vybrané hodiny jsou zvýrazněny.
4.  Rozvrh se automaticky filtruje podle vybraných předmětů a hodin.

## Úprava

1. Přihlaste se do Edisonu a přejděte do Rozvrh > Volba rozvrhu
2. V dev tools (`Cmd + Option + I` / `Ctrl + Shift + I`) najděte 9. `display:none` a element zobrazte
3. Přepněte se do karty Network a nechte si ji otevřenou
4. Klikněte na předmět jehož data chcete načíst a Response si zkopírujte a uložte zde do nového souboru `src/assets/config/NAZEVPŘEDMĚTU.json`

## Formát JSON souborů s rozvrhem

Každý JSON soubor ve složce `src/assets/config/` by měl obsahovat data o jednom předmětu ve formátu, který odpovídá struktuře, jakou vrací Edison 'API'. Příklad:

```json
{
  "subjectScheduleTable": {
    "days": [
      {
        "title": "Pondělí",
        "queues": [
          {
            "items": [
              {
                "used": true,
                "dto": {
                  "scheduleWindowBeginTime": "07:15:00",
                  "scheduleWindowEndTime": "08:00:00",
                  "teacherShortNamesString": "L. Žůrková",
                  "subjectAbbrev": "URO",
                  "lecture": false
                },
                "duration": 2
              },
              // ... další hodiny
            ]
          }
        ]
      },
      // ... další dny
    ]
  }
}