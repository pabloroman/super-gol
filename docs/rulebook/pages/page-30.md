# Página 30 — Tablas de referencia (TABLA 1 y TABLA 2)

> Escaneos originales:
> [`../scans/pages-30-31.jpeg`](../scans/pages-30-31.jpeg) (página completa) y los
> **primeros planos nítidos** de cada tabla:
> [`../scans/tabla-1-closeup.png`](../scans/tabla-1-closeup.png) ·
> [`../scans/tabla-2-closeup.png`](../scans/tabla-2-closeup.png).

Leyenda de columnas (ver pág. 31):

- **Nº:** número de dados que hay que lanzar.
- **MH:** marcaje al hombre · **MZ:** marcaje en zona · **SM:** sin marcaje.
- Contenido de las celdas = acciones que puede intentar el defensor / portero:
  **RB** robo de balón · **F** falta · **PEN** penalty · **A** anticipación ·
  **RC** remate/despeje de cabeza · **CO** colocación · **RF** reflejos ·
  **SA** salida por alto · **SP** salida a los pies.

Notas al pie de la TABLA 1:

- En las casillas sombreadas se necesita **poder mover** para ejecutar las
  acciones indicadas.
- **(\*)** SP y/o penalty, y no se necesita poder mover.

---

## TABLA 1 — Pases

Dividida en **POSEEDOR DEL BALÓN** (el que pasa) y **RECEPTOR DEL BALÓN** (el que
recibe), cada una con columnas `Nº | MH | Nº | MZ | Nº | SM`. Filas por tipo de
pase: **PD, PC, PL, PA**.

**Cómo se combina** (confirmado por el ejemplo de la pág. 31): el número de dados
que se lanzan es el **máximo** entre el `Nº` del poseedor (según su marcaje) y el
`Nº` del receptor (según el suyo). Ejemplo: PC de un pasador SM → receptor MH ⇒
`máximo(0, 2) = 2` dados.

### POSEEDOR DEL BALÓN

| Pase | Nº (MH) | MH | Nº (MZ) | MZ | Nº (SM) | SM |
|------|:---:|----|:---:|----|:---:|----|
| PD | – | – | – | – | – | – |
| PC | 2 | RB y/o F (\*) | 1 | RB y/o F (\*) | 0 | RB o F |
| PL | 2 | RB y/o F (\*) | 1 | RB y/o F (\*) | 1 | RB o F (\*) |
| PA | 2 | RB y/o F (\*) | 1 | RB y/o F (\*) | 1 | RB o F |

### RECEPTOR DEL BALÓN

| Pase | Nº (MH) | MH | Nº (MZ) | MZ | Nº (SM) | SM |
|------|:---:|----|:---:|----|:---:|----|
| PD | – | – | – | – | – | (\*) |
| PC | 2 | A/F o RB | 1 | A/F o RB | 0 | (\*) |
| PL | 2 | RB/F (\*) | 1 | RB/F (\*) | 1 | (\*) |
| PA | 2 | RC | 1 | RC | 1 | SA |

---

## TABLA 2 — Regate, velocidad y remates

Columnas agrupadas en **MARCAJE HOMBRE**, **MARCAJE ZONA** y **SIN MARCAJE**,
cada grupo con sub-columnas **Antes** y **Después** (del remate). Filas:
**RG, V, RM, DL, RC** (todas con `Nº = 2` bajo marcaje al hombre, `1` bajo zona /
sin marcaje).

En las celdas de remates (RM/DL/RC) conviven la respuesta del **defensor** (RB
y/o F) y la del **portero** (SP y/o PEN antes; RF / CO después). Lectura:

| Acción | Nº | MH · Antes | MH · Después | MZ · Antes | MZ · Después | SM · Antes | SM · Después |
|--------|:--:|-----------|-------------|-----------|-------------|-----------|-------------|
| RG | 2 / 1 / 1 | RB y/o F | F o PEN | RB y/o F | F o PEN | – | – |
| V  | 2 / 1 / 1 | RB y/o F | F o PEN | RB y/o F | F o PEN | – | – |
| RM | 2 / 1 / 1 | RB y/o F · SP y/o PEN | RF | RB y/o F · SP y/o PEN | RF | RB y/o F · SP y/o PEN | RF |
| DL | 2 / 1 / 1 | RB y/o F | CO | RB y/o F | CO | RB y/o F | CO |
| RC | 2 / 1 / 1 | SA | RF | SA | RF | SA | RF |

> ⚠️ **TABLA 2 — pendiente de una última confirmación humana.** Los encabezados,
> las filas y los `Nº` se leen con claridad en el primer plano. Lo que queda por
> confirmar es la **estructura de celdas apiladas** en los remates: si en cada
> casilla de RM/DL/RC conviven de verdad la opción del defensor (RB y/o F) y la
> del portero (SP y/o PEN / RF / CO), y el reparto exacto entre "Antes" y
> "Después". Verificar contra `scans/tabla-2-closeup.png`.
