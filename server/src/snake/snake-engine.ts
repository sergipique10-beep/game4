// server/src/snake/snake-engine.ts
import {
  Direction, Point, Snake, GameState, TickResult, DeathEvent, SerializedGameState,
} from './snake-types';

export const GRID_WIDTH = 40;
export const GRID_HEIGHT = 30;
export const FOOD_COUNT = 3;

const NEON_COLORS = [
  '#00f0ff', '#ff00c8', '#9d4dff', '#ff6b00', '#00ff88', '#ffee00',
];

const OPPOSITES: Record<Direction, Direction> = {
  up: 'down', down: 'up', left: 'right', right: 'left',
};

export function createGameState(width = GRID_WIDTH, height = GRID_HEIGHT): GameState {
  return { snakes: [], food: [], tick: 0, width, height };
}

export function spawnSnake(state: GameState, id: string): GameState {
  const color = NEON_COLORS[state.snakes.length % NEON_COLORS.length];
  const occupied = getOccupiedCells(state);
  const head = findSpawnPoint(state.width, state.height, occupied);
  const body: Point[] = [head, { x: head.x, y: head.y + 1 }, { x: head.x, y: head.y + 2 }];
  const snake: Snake = { id, body, direction: 'up', nextDirection: 'up', alive: true, score: 0, color };
  return { ...state, snakes: [...state.snakes, snake] };
}

export function setDirection(state: GameState, id: string, dir: Direction): GameState {
  return {
    ...state,
    snakes: state.snakes.map(s =>
      s.id === id && s.alive && OPPOSITES[s.direction] !== dir
        ? { ...s, nextDirection: dir }
        : s,
    ),
  };
}

export function generateFood(state: GameState, count: number): GameState {
  const occupied = getOccupiedCells(state);
  const food = [...state.food];
  for (let i = 0; i < count; i++) {
    const cell = findFreeCell(state.width, state.height, occupied);
    if (!cell) break;
    food.push(cell);
    occupied.push(cell);
  }
  return { ...state, food };
}

export function tick(state: GameState): TickResult {
  const deaths: DeathEvent[] = [];

  // 1. Compute new heads
  const newHeads = new Map<string, Point>();
  for (const snake of state.snakes) {
    if (!snake.alive) continue;
    newHeads.set(snake.id, moveHead(snake.body[0], snake.nextDirection));
  }

  // 2. Wall collision
  const wallKilled = new Set<string>();
  for (const [id, head] of newHeads) {
    if (head.x < 0 || head.x >= state.width || head.y < 0 || head.y >= state.height) {
      wallKilled.add(id);
    }
  }

  // 3. Move snakes + check food (tail trimmed unless eating)
  const moved = new Map<string, { body: Point[]; ateFood: boolean }>();
  let remainingFood = [...state.food];

  for (const snake of state.snakes) {
    if (!snake.alive || wallKilled.has(snake.id)) continue;
    const newHead = newHeads.get(snake.id)!;
    const foodIdx = remainingFood.findIndex(f => f.x === newHead.x && f.y === newHead.y);
    const ateFood = foodIdx !== -1;
    if (ateFood) remainingFood = remainingFood.filter((_, i) => i !== foodIdx);
    const newBody = ateFood
      ? [newHead, ...snake.body]
      : [newHead, ...snake.body.slice(0, -1)];
    moved.set(snake.id, { body: newBody, ateFood });
  }

  // 4. Body collisions (self and others) — checked against post-move bodies
  const bodyKilled = new Set<string>();
  for (const [id, { body }] of moved) {
    const head = body[0];
    if (body.slice(1).some(seg => seg.x === head.x && seg.y === head.y)) {
      bodyKilled.add(id);
      continue;
    }
    for (const [otherId, { body: otherBody }] of moved) {
      if (otherId === id) continue;
      if (otherBody.some(seg => seg.x === head.x && seg.y === head.y)) {
        bodyKilled.add(id);
        break;
      }
    }
  }

  // 5. Build new snake array
  const newSnakes = state.snakes.map(snake => {
    if (!snake.alive) return snake;
    if (wallKilled.has(snake.id) || bodyKilled.has(snake.id)) {
      deaths.push({ id: snake.id, score: snake.score });
      return { ...snake, alive: false };
    }
    const m = moved.get(snake.id)!;
    return {
      ...snake,
      direction: snake.nextDirection,
      body: m.body,
      score: m.ateFood ? snake.score + 1 : snake.score,
    };
  });

  // 6. Replenish food
  const foodNeeded = FOOD_COUNT - remainingFood.length;
  const tmpOccupied = getOccupiedCells({ ...state, snakes: newSnakes, food: remainingFood });
  const newFood = [...remainingFood];
  for (let i = 0; i < foodNeeded; i++) {
    const cell = findFreeCell(state.width, state.height, tmpOccupied);
    if (!cell) break;
    newFood.push(cell);
    tmpOccupied.push(cell);
  }

  return { state: { ...state, snakes: newSnakes, food: newFood, tick: state.tick + 1 }, deaths };
}

export function getSerializedState(state: GameState): SerializedGameState {
  return {
    snakes: state.snakes.map(s => ({
      id: s.id, body: s.body, direction: s.direction, alive: s.alive, score: s.score, color: s.color,
    })),
    food: state.food,
    tick: state.tick,
    width: state.width,
    height: state.height,
  };
}

// ── helpers ───────────────────────────────────────────────────────────────────

function moveHead(head: Point, dir: Direction): Point {
  switch (dir) {
    case 'up':    return { x: head.x,     y: head.y - 1 };
    case 'down':  return { x: head.x,     y: head.y + 1 };
    case 'left':  return { x: head.x - 1, y: head.y };
    case 'right': return { x: head.x + 1, y: head.y };
  }
}

function getOccupiedCells(state: GameState): Point[] {
  const cells: Point[] = [];
  for (const s of state.snakes) if (s.alive) cells.push(...s.body);
  cells.push(...state.food);
  return cells;
}

function findSpawnPoint(w: number, h: number, occupied: Point[]): Point {
  for (let attempts = 0; attempts < 200; attempts++) {
    const x = Math.floor(w / 4) + Math.floor(Math.random() * (w / 2));
    const y = Math.floor(h / 4) + Math.floor(Math.random() * (h / 2));
    if (
      !occupied.some(p => p.x === x && p.y === y) &&
      y + 2 < h &&
      !occupied.some(p => p.x === x && (p.y === y + 1 || p.y === y + 2))
    ) {
      return { x, y };
    }
  }
  return findFreeCell(w, h, occupied) ?? { x: 0, y: 0 };
}

function findFreeCell(w: number, h: number, occupied: Point[]): Point | null {
  const candidates: Point[] = [];
  for (let x = 0; x < w; x++)
    for (let y = 0; y < h; y++)
      if (!occupied.some(p => p.x === x && p.y === y)) candidates.push({ x, y });
  if (!candidates.length) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}
