# DOM-XSS in der Produktsuche (CWE-80 / OWASP A05:2025)

Keine CVE – eigene Umsetzung. CWE-Quelle: https://cwe.mitre.org/data/definitions/80.html
Die URL-Suchzeichenfolge gelangt über innerHTML in die Ergebnisanzeige. Lernziel:
unvertrauenswürdige Eingaben bei der Ausgabe als Text behandeln. Die Challenge ist
absichtlich aktiv; XSS-Fortschritt wird manuell nachgewiesen.

## Ein-IP-Betrieb auf der Hochschul-VM

Im bestehenden Projektverzeichnis auf feature/offline-hash-challenge:

~~~sh
export SHOP_BIND_IP=10.13.26.24
docker compose up --build -d --remove-orphans
~~~

Bestehenden CHALLENGE_ADMIN_TOKEN beibehalten. Dasselbe Compose-Projekt und Volume
verwenden. Keine Datenbankdateien oder Volumes löschen. Der Befehl entfernt den
alten xss-preview-Container; Port 8081 und alle XSS_*-Variablen entfallen.
Ein Container-Recreate leert das flüchtige Challenge-Log, aber keine SQLite-Daten.

Shop: http://10.13.26.24:8080/products
Aufgaben: http://10.13.26.24:8080/challenges
Preview: http://10.13.26.24:8080/xss-preview/

Kein DNS, keine hosts-Datei und kein zweiter Host erforderlich. Port 8080 nur für
das freigegebene Hochschul-/VPN-Netz öffnen. Lokal: npm run dev oder Build und
npm start; Vite leitet /xss-preview/ an Express weiter.

## Architektur und Schutzgrenzen

server/xss-preview.js liefert ein festes HTML-Dokument direkt in Express, bevor
Shop-CSP, JSON-Parser und Session-Abfrage laufen. Es gibt keinen Proxy, zweiten
Dienst oder zusätzliche Docker-Netzwerkverbindung. Angreifercode wird ausschließlich
im Browser ausgeführt, niemals in Express. Cookies und Authorization können im
HTTP-Aufruf beim Shopserver ankommen, werden vom Handler aber nicht gelesen,
reflektiert, gespeichert oder an einen weiteren Dienst weitergereicht.

Die URL wird mit URLSearchParams kodiert. Nur das feste Browser-Startskript liest
search und schreibt absichtlich innerHTML. Eingaben über 4096 Zeichen werden
abgelehnt. Unterrouten und andere Methoden als GET/HEAD sind gesperrt.

- iframe sandbox=allow-scripts, ausdrücklich ohne allow-same-origin.
- Eigener HTTP-CSP-Header mit sandbox allow-scripts, auch bei direktem öffnen.
- Opake Origin: kein Zugriff auf Eltern-DOM, Cookies, localStorage oder sessionStorage.
- Nur das feste Startskript per SHA-256-Hash; Inline-Eventhandler absichtlich erlaubt.
- connect/img/frame/worker/media/font/object-src none; form-action/base-uri none.
- frame-ancestors self; keine Popups, Top-Navigation, Formulare oder modalen Dialoge freigeben.
- No-store, no-referrer, nosniff; keine Secrets im HTML, keine postMessage-Brücke.
- Normale Shop-Skript-CSP unverändert; nur die Preview hat die bewusste Eventhandler-Ausnahme.

Die Sandbox ist keine universelle Netzwerksperre: insbesondere eigene Navigation
ist nicht vollständig unterbunden. Sie begrenzt auch keine Browser-CPU. Für eine
harte Egress-Grenze wäre ein separater eingeschränkter Testbrowser nötig. Ausschließlich
fiktive Daten und freigegebene Ziele verwenden. Keine CORS-Freigabe für Origin null.

srcdoc wird bewusst nicht verwendet: Es erbt die Shop-CSP und könnte die vorhandene
Inline-XSS-Demo ohne zusätzliche Änderungen an deren Skriptfreigaben nicht ausführen.

## Reproduzierbare Musterlösung und Nachweis

1. Shop öffnen, Kategorie All wählen; normale Suche nach dice zeigt Produkte.
2. Folgenden Suchtext eingeben:

~~~html
<svg onload="document.getElementById('result').textContent='Dice & Lore security notice: JavaScript executed in the isolated preview.'"></svg>
~~~

3. Die Meldung muss im iframe durch JavaScript entstehen. Reines injiziertes HTML
   genügt nicht; alert ist wegen fehlendem allow-modals absichtlich gesperrt.
4. Suche mit Clear search leeren. Produkte erscheinen; dieselbe Eingabe erneut
   verwenden und Erfolg in einem neuen iframe reproduzieren.
5. Eingabe und sichtbare Wirkung für die Lehrperson dokumentieren.

## Isolation und Regression prüfen

npm test prüft feste Antwort, URL-Datenfluss, CSP-Trennung, Cookies/Authorization
nicht im HTML, fehlende Cookie-/CORS-Freigaben, Methoden und Längenlimit.
Nach npm run build führt npm run test:browser einen echten Chromium-Test aus:
angemeldeter Shop, simulierte Bestellung, gesetzte Storage-/Cookie-Kontrollwerte,
JavaScript-Ausführung im iframe, verweigerter Eltern-/Cookie-/Storage-Zugriff,
blockierter credentialed API-fetch ohne Serverzugriff, direkt geöffnete Preview
unter HTTP-Sandbox sowie Wiederholung nach Clear search. Zusätzlich bleiben die
bestehenden Browserprüfungen für Shopreset, unabhängige Browser und Checkout aktiv.
Alle Testdatenbanken sind in-memory/temporär; keine vorhandene Shopdatenbank verwenden.

Vor Abgabe denselben manuellen Ablauf auf der VM im vorgesehenen Browser wiederholen.
Login, Warenkorb, Bestellungen und beide anderen Challenges müssen weiter funktionieren.

## Sichere Korrektur

In server/xss-preview.js innerHTML durch textContent ersetzen:

~~~js
document.getElementById('result').textContent = 'No products found for: ' + search;
~~~

Denselben Payload erneut eingeben: vollständiger HTML-Text sichtbar, keine durch
Eventhandler erzeugte Meldung. Normale Suchtexte weiterhin sichtbar. Der Skripthash
wird aus dem Startskript berechnet; die Tests auf diese sichere Erwartung umstellen.
Sandbox und restriktive CSP als zusätzliche Schutzschichten beibehalten.

## Reset

Nur Suche leeren: keine Datenbankänderung, kein persistenter XSS-Status.
Password-/Log-Reset und vollständiger Shopreset bleiben unverändert dokumentiert
in der Repository-README. Keine Resets auf bestehenden Daten zur Prüfung ausführen.
