# Cómo funciona esto

## Lo que hay aquí

| Carpeta | Qué es |
|---|---|
| `index.html` | La landing de venta pública. El link general que mandas. |
| `restaurante/` `barberia/` `clinica/` `boutique/` | Las 4 plantillas base genéricas. |
| `p/<negocio>/` | **Una página personalizada por prospecto** (39 en total). |
| `panel/` | **Tu panel de prospección.** Aquí trabajas todos los días. |
| `prospectos.json` | Los datos de los 39 prospectos. |
| `generar.py` + `panel_tpl.py` | El generador que produce `p/` y `panel/`. |
| `VENTAS.md` | Precios, guiones, objeciones y las cuentas del negocio. |

## Lo primero que tienes que hacer

Tu número ya está puesto. Si algún día lo cambias, se edita aquí:

```json
"jackson": { "whatsapp": "584247481963", "nombre": "Jackson Jaimes" }
```

Ese número es a donde llegan los pedidos de prueba que hagan los prospectos.
Después de cambiarlo, corre:

```bash
python3 demos/generar.py
```

Se regeneran las 39 páginas y el panel con tu número.

## Tu rutina diaria

1. Abre `panel/` en el teléfono.
2. Filtra por rubro o busca el negocio.
3. **Verifica el número** abriendo su Instagram (los de directorio pueden estar viejos).
4. Toca **Abrir WhatsApp** — se abre el chat con el mensaje ya escrito.
5. Marca el estado: Enviado → Respondió → Cerrado.

El estado se guarda en el navegador del teléfono. Si cambias de teléfono o borras
los datos del navegador, se pierde — no es una base de datos.

## Añadir un prospecto nuevo

Agrega un bloque a `prospectos.json` y vuelve a correr el generador:

```json
{"slug":"nombre-del-negocio","nombre":"Nombre del Negocio","ig":"cuenta_ig",
 "tel":["584141112233"],"zona":"Barrio Obrero","base":"restaurante","carta":"pizza",
 "tipo":"Pizzería","prio":1,"verificar":true,
 "gancho":"vi que los pedidos les entran todos por el chat"}
```

- `base`: `restaurante` (pedidos) · `barberia` (citas) · `clinica` (citas médicas)
- `carta` para `restaurante`: `parrilla` `sushi` `hamburguesas` `comida-rapida` `pizza` `cafe` `postres` `ferreteria` `insumos`
- `carta` para `barberia`: `barberia` `salon` `spa` `gym`
- `carta` para `clinica`: `odontologia` `dermatologia`
- `tel`: formato internacional sin `+`. El `0276…` es fijo (no sirve para WhatsApp); usa el `0414/0424/0412`.
- `gancho`: lo que viste tú de su negocio. Va dentro del mensaje. **Es lo que hace que no parezca spam.**

## Cuando un prospecto te dice que sí

1. Cobra el montaje por adelantado.
2. Abre `demos/p/<su-slug>/index.html`.
3. Cambia el bloque `CONFIG` (su número de WhatsApp, no el tuyo) y la lista de productos.
4. **Borra la barra negra de PROPUESTA** de arriba.
5. Publícala y mándale el link.

## Cuidado con esto

- El panel está en internet (aunque con `noindex` para que Google no lo liste).
  No mandes ese link a nadie: contiene toda tu lista de prospectos.
- Las páginas personalizadas dicen claramente **PROPUESTA · productos y precios de
  muestra**. No la quites mientras sea una propuesta: si un prospecto cree que son
  sus precios reales, se arma un problema.
- Máximo 20–30 mensajes nuevos al día, desde un número aparte del personal.
