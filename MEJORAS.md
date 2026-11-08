# Revisión del proyecto · catálogo de cortes

Revisión hecha leyendo los 32 cortes completos (datos, recetas, empaque, nombres regionales) y probando el sitio en Chromium.
**Importante:** no tuve a mano los manuales originales (Éxito, AGROSAVIA, Asoporcicultores), así que lo que está abajo son
inconsistencias *internas* de los datos o errores evidentes, no una verificación contra la fuente.

## Aplicado

### Datos y contenido
- **Datos nutricionales dudosos marcados (15 cortes).** Tres grupos de cortes comparten valores idénticos (res 16 g / 25,4 g: descargue, sobrebarrigas, morrillo, costilla; cerdo 18,5 / 11,9: solomito, pierna, brazo, pezuña; cerdo 16,5 / 19,7: chuleta, costillas, espinazo) y el cañón de cerdo dice 24,5 g de grasa siendo descrito como magro. Ahora se muestran con «≈», con un aviso en la ficha y al final de los órdenes «Mayor proteína» y «Más magro» (antes distorsionaban el ranking). `src: "r"` en el JSON.
- **Recetas corregidas:** Muchacho (se usaba un «caramelo» que nunca se preparaba: añadido el paso), Murillo (se servía con puré que no se hacía), Solomo redondo (error de redacción «Pásenlos»), Morrillo (se llamaba «Asado» pero se cocina hervido a presión: ahora «Morrillo en olla a presión»), Paté de cerdo (la maceración de 24 h con carne cruda no decía que fuera en nevera: añadido, y el tiempo total corregido).
- **Peso:** «Peso aproximado» pasó a «Peso aprox. de la pieza (canal)», porque contradecía la presentación comercial (p. ej. solomo redondo ≈ 5,8 kg vs «entero 1–1,2 kg»).
- **Código:** «Sin IMPS»/«—» ahora se muestra «Sin código asignado»; en cerdo la etiqueta es «Código del manual» (no son códigos IMPS).
- **Sustitutos:** 49 de 56 enlazan solos (el resto son nombres genéricos como «Carne para sudar»); no enlazan a cortes de otra especie por error ni a nombres genéricos ambiguos («Carne para sudar»). Alias nuevo «Carne para sancocho» en descargue.

### Experiencia de usuario
- **Mi región:** selector que muestra en cada tarjeta cómo se llama el corte en tu zona y resalta esa fila en la ficha (se recuerda entre visitas).
- **Navegación en la ficha:** botones Anterior/Siguiente (y flechas ← → del teclado) dentro de la lista filtrada; el botón «Atrás» del navegador cierra la ficha.
- **Compartir** (menú del sistema en móvil, copia el enlace en escritorio) e **Imprimir** una ficha limpia.
- **Esqueleto de carga** en lugar de una cuadrícula vacía mientras llegan los datos.
- (Ya aplicado antes) fotos normalizadas, insignia de ritmo de cocción, barra de resumen, filtros en una fila en móvil.

## Pendiente: requiere la fuente o una decisión tuya
### Verificar con la fuente
- Los valores nutricionales marcados «≈» (arriba) y el 24,5 g de grasa del cañón.
- **Solomito en tocineta:** 1 h de horno envuelto en papel aluminio contradice el consejo «cocción corta y sin sobrecocer», y no indica temperatura del horno. Igual sin temperatura: chuletas y solomito de cerdo al sartén. Punta de anca: «hasta que no salga sangre» no es un criterio fiable; mejor dar temperatura interna.
- **Solomito de cerdo:** peso 0,45 kg vs «entero 0,7–0,8 kg».
- **Cola de res:** peso 0,6 kg parece bajo para una cola completa.
- **Nombres repetidos:** «Capón» aparece en Tabla (Costa Caribe) y como alias de Muchacho; «Pecho» es nombre de Sobrebarriga gruesa en Cali y también un corte aparte (Pecho de res). Hoy la búsqueda devuelve ambos.
- Alias «Manteca» en Tocino graso: la manteca es grasa derretida, no tocino.

### Publicación
- Reemplazar `https://www.example.com/...` y crear `og-cortes.jpg`.
- **Licencias de fotos:** res = CC BY-NC-SA (sin uso comercial); cerdo = sin permiso confirmado.
- **Tailwind por CDN** (solo para desarrollo): hace que la página «parpadee» sin estilos al cargar y pesa ~300 KB. Compilar el CSS es la mejora de experiencia más importante pendiente. Lo mismo con Lucide completo (~400 KB).
- SEO: páginas estáticas por corte (`/cortes/<id>/`) y `sitemap.xml`; el JSON-LD `Product` sin `offers` da advertencias en Search Console.

### Ideas de UX sin implementar
- Cambiar el interruptor de especie por pestañas «Res | Cerdo» (un switch indica activado/desactivado, no dos categorías).
- Guardar búsqueda y filtros en la URL para poder compartir resultados.
- Mapa de la canal, comparador de dos cortes, modo oscuro, PWA sin conexión.
