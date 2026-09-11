# Stangeskovene kart

CMS-drevet kart- og filtermotor for Stangeskovenes Webflow-nettsted.

## CDN

```html
<script defer src="https://cdn.jsdelivr.net/gh/ElianAamodt/stangeskovene-kart@main/dist/stangeskovene-map.js"></script>
```

Produksjonssiden bør feste URL-en til en bestemt Git-revisjon. Scriptet leser skjulte Webflow Collection Lists, bygger synkronisert kart og liste, og tegner kommunegrenser fra Kartverket-data lagret i CMS.

## DOM-kontrakt

Synlig rot: `[data-stangeskovene-map]` med barn for `data-map-canvas`, `data-map-results`, `data-map-count`, `data-map-search`, `data-map-type`, `data-map-follow`, `data-map-reset` og mobilvalgene `data-map-view`.

CMS-kilder: `[data-stangeskovene-source] [data-map-item]`. Hvert objekt har `data-type="omrade|hytte|vei"` og tekstnoder med `data-field="name|lat|lng|status|description|price|region|slug|external|geojson"`.
