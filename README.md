# RoutenPlaner MultiStop – PWA

Kostenlose Web-App für iPhone, Android und Desktop. **Unabhängig von der Android-App.**

## Veröffentlichung auf GitHub Pages

1. Alle Dateien aus diesem ZIP ins Stammverzeichnis des öffentlichen Repositorys `RoutenPlaner-PWA` hochladen (nicht den übergeordneten ZIP-Ordner).
2. GitHub: **Settings → Pages → Build and deployment → Deploy from a branch → main → /(root) → Save**.
3. Warten, bis die Website verfügbar ist: `https://herbigithubgpt.github.io/RoutenPlaner-PWA/`.
4. iPhone: Safari → Teilen → **Zum Home-Bildschirm**. Android: Chrome → Menü → **App installieren** / **Zum Startbildschirm hinzufügen**.

## Hinweise

- Die Oberfläche und gespeicherte Routen funktionieren lokal; GPS, Adresssuche, Optimierung und Google Maps benötigen Internet.
- Photon und OSRM sind öffentliche, nicht garantierte Dienste mit Nutzungslimits. Für große Nutzerzahlen einen geeigneten Dienst einsetzen.
- Die Optimierung nutzt das **Autoprofil** und berücksichtigt keine Echtzeit-Staus. Der erste Stopp bleibt der Startpunkt.
- Der TXT/CSV-Import ist für einfache Zeilenlisten und `Stopp;Adresse`-CSV gedacht; komplexe CSV-Formate müssen gesondert angepasst werden.
- Browser können bei vielen Google-Maps-Stopps Grenzen setzen; dann werden Teilstrecken angeboten.
- GPS erfordert HTTPS und eine Standortfreigabe.
- Lokale Speicherung ist geräte- und browserbezogen. Keine Synchronisierung zwischen Geräten.
- Prüfe die Datenschutzerklärung, bevor du die PWA öffentlich bewirbst: Standort und Adressanfragen gehen bei Nutzung an externe Kartendienste.


## Version 2 – Benannte Routen
Im Abschnitt „Meine gespeicherten Routen“ einen Namen eingeben und „Unter Namen speichern“ wählen. Vorhandene Routen können geladen, umbenannt oder gelöscht werden. Gleichnamige Routen können nach Bestätigung überschrieben werden. Die bisherige Schnell-Speicherung bleibt unverändert. Daten liegen im lokalen Browser-Speicher (localStorage), ohne Cloud-Synchronisierung.
