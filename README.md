# Catálogo de cortes de carne (Res y Cerdo · Colombia)

Sitio estático: no necesita backend ni base de datos.

## Estructura
```
index.html              Estructura semántica, SEO (meta, Open Graph, JSON-LD) y accesibilidad
css/styles.css          Estilos propios (variables de color, modal, tarjetas, interruptor)
js/tailwind-config.js   Configuración de Tailwind (colores enlazados a variables CSS)
js/app.js               Lógica: buscador, filtros, tarjetas, modal, calculadora, JSON-LD dinámico
img/cortes/             Fotografías por corte (WebP 800×600, fondo blanco, pieza centrada con sombra suave), nombradas con el id del corte
data/cortes.json        Datos de los 32 cortes (18 bovinos, 14 porcinos)
```

## Cómo ejecutarlo
Los datos se leen con `fetch`, así que se debe servir desde un servidor web (abrir `index.html` con doble clic no funciona en varios navegadores):
```
python3 -m http.server 8000     # o:  npx serve .
```
y abrir http://localhost:8000. En cualquier hosting estático (Netlify, GitHub Pages, Cloudflare Pages, etc.) funciona sin configuración.

## Cómo editar o agregar un corte
Edita `data/cortes.json`. Cada corte tiene:
- `id`, `esp` (`bovina` | `porcina`), `n` (nombre), `sub` (subtítulo con otros nombres separados por `·`), `grupo`, `imps` (código)
- `alias[]` (nombres extra para búsqueda) y `reg{}` (nombres por región: Medellín, Bogotá, Santander, Cali / Eje Cafetero, Costa Caribe)
- `desc`, `peso` (kg por pieza), `uso`, `tip`
- `coc[]` (asar, sudar, freir, hornear, parrillar) y `fmt[]` (medallones, entero, tiras, filetes)
- `sus[]` (cortes sustitutos; se enlazan solos si el nombre coincide con un corte o alias, incluso con formas como «Chata (solomo redondo)»), `nut{p,g,fe,src,nota?}` (proteína y grasa por 100 g; `src`: a = AGROSAVIA, e = Éxito, x = estimado, **r = valor de referencia compartido por varios cortes** → se muestra con «≈» y una advertencia, y va al final al ordenar por proteína/grasa; `nota` opcional con el motivo)
- `emp{}` (presentación, bandeja, empaque, exhibición) y `rec{}` (receta con porciones base, ingredientes y pasos)
Todo lo que agregues se refleja en búsqueda, filtros, ficha y JSON-LD automáticamente.

## Fotografías
Las fotos originales (sin normalizar) están en `img/originales/`; las de `img/cortes/` se generaron a partir de ellas (recorte, escala uniforme y sombra). Si agregas una foto nueva, conviene pasarla por el mismo tratamiento para mantener la uniformidad.
Cada corte con foto tiene el campo `"img": "img/cortes/<id>.webp"` en `data/cortes.json`. Si no tiene `img` (hoy: descargue, sobrebarriga gruesa y cola de res) o la imagen falla, se muestra una ilustración generada. Para agregar o cambiar una foto, guarda el archivo en `img/cortes/` y apunta `img` a él.
Licencias: las fotos de res provienen de AGROSAVIA (2020), CC BY-NC-SA 4.0 (atribución, uso no comercial, misma licencia); la atribución ya aparece en la ficha y en el pie de página. Las fotos de cerdo provienen del manual de Asoporcicultores–FNP / Cenipórcino: confirma con ellos el permiso de uso antes de publicar el sitio.

## Antes de publicar
Reemplaza `https://www.example.com/catalogo-cortes-carne/` (canonical, og:url, og:image y JSON-LD) por tu dominio y crea la imagen `og-cortes.jpg`.

## Fuentes
Manual Fábrica Autoservicio (Almacenes Éxito), "Cortes de la canal bovina" (AGROSAVIA, 2020) y "Manual de cortes de carne de cerdo colombiano".
