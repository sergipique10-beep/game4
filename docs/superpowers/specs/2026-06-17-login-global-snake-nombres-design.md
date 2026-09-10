# Design: Login global, nombres en Snake y fix WebSocket

**Fecha:** 2026-06-17

---

## Resumen

Tres cambios relacionados:

1. **Login global antes de elegir juego** — una sola pantalla de nombre antes de la selección de juego, compartida entre Conecta 4 y Snake.
2. **Botón "Volver al menú"** — en la home de Conecta 4, para poder cambiar de juego sin recargar.
3. **Bug fix WebSocket Snake** — mensajes descartados si se envían antes de que la conexión esté abierta. Fix: cola de mensajes pendientes igual que `GameSocketService`.
4. **Nombre del jugador en rankings de Snake** — el nombre ingresado en login se envía al servidor y aparece en la tabla de fin de partida.

---

## Flujo de pantallas

**Antes:**
```
null → GameSelect → Connect4 (login → home → ...) / Snake (home → ...)
```

**Después:**
```
login (global) → GameSelect → Connect4 (home → ...) / Snake (home → ...)
```

---

## Sección 1 — App component

**`app.ts`:**
- Agrega `playerName = signal<string | null>(null)`
- `onLogin(name: string)`: setea `playerName(name)` y llama a `game.login(name)` (esto pone la phase de connect4 en `'home'` directamente)
- `onSelectGame(game)`: igual que ahora, setea `selectedGame`
- En `(createRoom)` y `(joinRoom)` de snake: pasa `playerName()!` como argumento

**`app.html`:**
```
@if (playerName() === null) {
  <app-login (enter)="onLogin($event)" />
} @else if (selectedGame() === null) {
  <app-game-select (select)="onSelectGame($event)" />
} @else if (selectedGame() === 'connect4') {
  @switch (game.phase()) {
    @case ('home') { <app-home ... (backToMenu)="onBackToMenu()" /> }
    ...
  }
} @else if (selectedGame() === 'snake') {
  ...snake igual que ahora...
}
```

- Se elimina el `@case ('login')` de connect4 (ya no se necesita).
- `onBackToMenu()`: setea `selectedGame(null)`.

---

## Sección 2 — HomeComponent (Conecta 4)

- Agrega output `backToMenu = output<void>()`
- Agrega botón "← Menú" en el template que emite `backToMenu`

---

## Sección 3 — Bug fix SnakeSocketService

**Patrón idéntico a `GameSocketService`:**

```ts
private pendingMessages: string[] = [];

private connect(): void {
  if (this.ws?.readyState === WebSocket.OPEN) return;
  this.ws = this.wsFactory(...);
  this.ws.onopen = () => {
    for (const msg of this.pendingMessages) this.ws!.send(msg);
    this.pendingMessages = [];
  };
  this.ws.onmessage = ...;
}

private send(msg: object): void {
  const str = JSON.stringify(msg);
  if (this.ws?.readyState === WebSocket.OPEN) {
    this.ws.send(str);
  } else {
    this.pendingMessages.push(str);
  }
}
```

- `resetState()` también limpia `pendingMessages = []`

---

## Sección 4 — Nombre en Snake

### Cliente — `SnakeSocketService`

- `createRoom(name: string)`: envía `{ type: 'snake_create_room', name }`
- `joinRoom(code: string, name: string)`: envía `{ type: 'snake_join_room', code, name }`
- Interface `SnakeRanking` agrega `name: string`

### Servidor — `snake-types.ts`

```ts
export interface SnakeRanking {
  playerId: string;
  name: string;
  score: number;
  color: string;
  position: number;
}
```

### Servidor — `snake-room-manager.ts`

- `SnakeRoom` agrega `names: Map<string, string>`
- `createRoom(clientId, ws, name)`: guarda `names.set(clientId, name)`
- `joinRoom(code, clientId, ws, name)`: guarda `names.set(clientId, name)`
- `endGame()`:
  ```ts
  const rankings: SnakeRanking[] = room.state.snakes
    .map(s => ({
      playerId: s.id,
      name: room.names.get(s.id) ?? s.id,
      score: s.score,
      color: s.color,
      position: 0,
    }))
    .sort((a, b) => b.score - a.score)
    .map((r, i) => ({ ...r, position: i + 1 }));
  ```
- `resetGame()`: conserva el mapa `names` (los mismos jugadores hacen revancha)

### Servidor — `websocket-server.ts`

- En el handler de `snake_create_room`: extrae `name` y lo pasa al room manager
- En el handler de `snake_join_room`: extrae `name` y lo pasa al room manager

### Cliente — `snake-game-over.component.html`

- Muestra `ranking.name` en la tabla en vez de `ranking.playerId`

---

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `client/src/app/app.ts` | playerName signal, onLogin, onBackToMenu |
| `client/src/app/app.html` | nuevo flujo condicional |
| `client/src/app/components/home/home.component.ts` | output backToMenu |
| `client/src/app/components/home/home.component.html` | botón ← Menú |
| `client/src/app/services/snake-socket.service.ts` | pendingMessages, createRoom(name), joinRoom(code,name), SnakeRanking.name |
| `server/src/snake/snake-types.ts` | SnakeRanking.name |
| `server/src/snake/snake-room-manager.ts` | names map, createRoom/joinRoom con name, endGame con name |
| `server/src/websocket-server.ts` | extraer name de mensajes snake |
| `client/src/app/components/snake-game-over/snake-game-over.component.html` | mostrar ranking.name |

---

## Archivos NO modificados

- `LoginComponent` — se reutiliza tal cual
- `GameSelectComponent` — sin cambios
- `SnakeHomeComponent` — ya tiene "← Menú", sin cambios
- `SnakeWaitingRoomComponent` — sin cambios
- `snake-engine.ts` — sin cambios
