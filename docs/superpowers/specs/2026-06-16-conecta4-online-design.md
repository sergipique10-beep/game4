# Conecta 4 online (2 jugadores + IA Gemini) — Diseño

## Objetivo

Juego de Conecta 4 multijugador en tiempo real vía WebSocket, con la opción de jugar contra una IA basada en Gemini cuando no hay un segundo jugador disponible (o el usuario lo prefiere directamente).

## Stack

- **Cliente**: Angular + HTML/CSS/JS.
- **Servidor**: Node.js + Express + `ws` (WebSocket nativo, sin Socket.IO).
- En desarrollo: `ng serve` con proxy al backend para los WebSocket. En producción: un único proceso Node sirve la build de Angular y gestiona los WebSocket.
- Sin base de datos: el estado de las salas vive en memoria del servidor (`Map<roomCode, Room>`). Si el servidor reinicia, las partidas en curso se pierden (aceptado).

## Arquitectura

- `/server`
  - `Connect4Engine` (módulo TS puro, sin dependencias de Express/ws): representación del tablero, validación de movimientos, detección de victoria/empate, columnas válidas.
  - `RoomManager`: crea/destruye salas, asigna jugadores, mantiene el estado de cada partida (tablero, turno, jugadores conectados).
  - `GeminiService`: construye el prompt con el estado del tablero, llama a la API de Gemini, parsea la columna devuelta, reintenta y aplica fallback aleatorio si falla.
  - Servidor WebSocket (`ws`) + Express (sirve la build Angular y health-check).
- `/client`
  - Pantallas: Inicio, Esperando rival, Tablero de juego, Fin de partida.
  - Servicio Angular para gestionar la conexión WebSocket y el estado de la partida recibido del servidor (el cliente no calcula lógica de juego, solo renderiza lo que el servidor envía).

El servidor es la única autoridad del juego: valida cada movimiento y decide el resultado. El cliente nunca decide si una jugada es válida o quién gana.

## Protocolo WebSocket

Mensajes JSON con campo `type`.

**Cliente → Servidor**
- `create_room`
- `join_room { code }`
- `play_vs_ai`
- `make_move { column }`
- `request_rematch`
- `leave_room`

**Servidor → Cliente**
- `room_created { code }`
- `opponent_joined`
- `game_start { board, currentPlayer }`
- `move_made { board, currentPlayer, lastMove }`
- `game_over { result }` (win/draw, incluye las 4 fichas ganadoras si aplica)
- `rematch_accepted` / `rematch_declined`
- `opponent_left` / `opponent_disconnected`
- `error { message }`

## Flujo de matchmaking

- **Crear partida**: el jugador crea una sala y recibe un código (y un enlace tipo `?room=ABCD` para compartir). Espera a que se una un rival; no hay timeout automático hacia IA.
- **Unirse por código**: el segundo jugador introduce el código (o abre el enlace) y entra directamente a la partida.
- **Jugar contra IA**: botón explícito desde el inicio; no pasa por sala/código, arranca la partida directamente contra Gemini.

## Motor de juego (Connect4Engine)

- Tablero 7 columnas x 6 filas.
- `applyMove(board, column, player)`: aplica la ficha en la fila más baja libre de la columna, o error si está llena.
- `checkWin(board, row, col)`: comprueba 4 en línea en las 4 direcciones (horizontal, vertical, diagonal ↗, diagonal ↘) a partir de la última ficha colocada.
- `checkDraw(board)`: tablero lleno sin ganador.
- `getValidColumns(board)`: columnas no llenas, usado también por el fallback aleatorio de la IA.

## Integración con Gemini (IA)

1. El servidor serializa el tablero en un prompt de texto simple (matriz) y pide a Gemini que responda solo con un número de columna (0-6).
2. Llama a la API de Gemini usando la API key desde variable de entorno (`.env`, nunca en código ni en git).
3. Parsea la respuesta buscando un dígito 0-6. Si la columna está llena o la respuesta no es parseable, reintenta hasta 2 veces.
4. Si tras los reintentos sigue sin obtener una jugada válida, elige una columna válida al azar (`getValidColumns`).
5. Se añade un delay artificial (~600-900ms) antes de aplicar la jugada de la IA para simular que "está pensando".

## Manejo de desconexiones y salidas

- Si un jugador cierra la pestaña o pierde conexión durante una partida 2 jugadores, el servidor lo detecta (cierre del socket) y notifica al rival (`opponent_disconnected`); la sala se cierra. No hay periodo de gracia ni reconexión.
- Si un jugador pulsa "salir" voluntariamente (`leave_room`), se notifica igual al rival (`opponent_left`) y se cierra la sala.
- Errores generales (fallo de WebSocket, timeout de la IA, sala no encontrada o llena) se comunican al cliente vía mensaje `error` y se muestran como toasts no intrusivos, sin bloquear la pantalla.

## Experiencia de usuario (UX)

**Estética visual: cyberpunk.** Fondo oscuro (negro/azul muy oscuro), acentos en colores neón (cian, magenta, violeta), bordes y textos con efecto glow/sombra luminosa, tipografía futurista para títulos (ej. una fuente monoespaciada o tipo "tech") y tipografía legible para el resto. Las fichas de los jugadores usan dos neones contrastantes (ej. cian vs magenta) en lugar de los colores clásicos rojo/amarillo. El tablero tiene un borde con glow sutil y rejilla tipo "circuito". Las animaciones (caída de ficha, hover de columna, victoria) usan transiciones con resplandor en vez de solo color plano. La IA se presenta como "IA 🤖" con un toque "synthetic/terminal" (ej. texto tipo máquina al anunciar su jugada).

- **Inicio**: botones "Crear partida" y "Jugar contra la IA", más un campo "Unirse con código".
- **Esperando rival**: código de sala visible en grande, botón "Copiar enlace", spinner amigable. Transición automática al tablero cuando se une el rival.
- **Unión fallida**: mensaje claro sin tecnicismos ("Esa sala no existe o ya está completa") y vuelta al inicio.
- **Tablero**: animación de caída de ficha, columna resaltada al pasar el cursor/tocar, indicador claro de turno ("Tu turno" / "Turno de [rival/IA]"), la IA se identifica como "IA 🤖".
- **Fin de partida**: resultado claro (victoria/derrota/empate) con las 4 fichas ganadoras resaltadas, botones "Revancha" y "Salir a inicio".
- **Desconexión del rival**: toast no intrusivo ("Tu rival se ha desconectado") + botón para volver al inicio.

## Testing

- **Connect4Engine**: tests unitarios puros (Jest) para `applyMove`, `checkWin` (las 4 direcciones), `checkDraw`, `getValidColumns`.
- **GeminiService**: tests con la llamada a la API mockeada — parseo de respuesta válida, reintento ante respuesta inválida, fallback aleatorio tras agotar reintentos.
- **RoomManager / WebSocket**: tests de integración levantando el servidor en memoria, simulando 2 clientes (crear sala, unirse, jugar, desconexión, revancha).
- **Cliente Angular**: tests de componente para el render del tablero y los distintos estados de pantalla, sin lógica de negocio (el servidor es la autoridad).

## Fuera de alcance (YAGNI)

- Persistencia de partidas/estadísticas en base de datos.
- Reconexión tras desconexión (periodo de gracia).
- Salas públicas listables o cola de matchmaking automática.
- Cuentas de usuario / autenticación.
