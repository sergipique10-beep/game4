// server/src/snake/snake-engine.test.ts
import {
  createGameState,
  spawnSnake,
  setDirection,
  generateFood,
  tick,
  GRID_WIDTH,
  GRID_HEIGHT,
  FOOD_COUNT,
} from './snake-engine';
import { GameState, Snake, Direction } from './snake-types';

function makeSnake(
  id: string,
  body: { x: number; y: number }[],
  direction: Direction = 'up',
  color = '#00f0ff',
): Snake {
  return { id, body, direction, nextDirection: direction, alive: true, score: 0, color };
}

function makeState(
  snakes: Snake[] = [],
  food: { x: number; y: number }[] = [],
  w = 10,
  h = 10,
): GameState {
  return { snakes, food, tick: 0, width: w, height: h };
}

// ── createGameState ───────────────────────────────────────────────────────────
describe('createGameState', () => {
  it('creates empty state with default dimensions', () => {
    const s = createGameState();
    expect(s.width).toBe(GRID_WIDTH);
    expect(s.height).toBe(GRID_HEIGHT);
    expect(s.snakes).toEqual([]);
    expect(s.food).toEqual([]);
    expect(s.tick).toBe(0);
  });

  it('accepts custom dimensions', () => {
    const s = createGameState(10, 10);
    expect(s.width).toBe(10);
    expect(s.height).toBe(10);
  });
});

// ── spawnSnake ────────────────────────────────────────────────────────────────
describe('spawnSnake', () => {
  it('adds a snake with body length 3', () => {
    const s = spawnSnake(createGameState(10, 10), 'p1');
    expect(s.snakes).toHaveLength(1);
    expect(s.snakes[0].body).toHaveLength(3);
    expect(s.snakes[0].id).toBe('p1');
    expect(s.snakes[0].alive).toBe(true);
  });

  it('assigns distinct colors for two snakes', () => {
    let s = createGameState(10, 10);
    s = spawnSnake(s, 'p1');
    s = spawnSnake(s, 'p2');
    expect(s.snakes[0].color).not.toBe(s.snakes[1].color);
  });

  it('does not mutate the input state', () => {
    const original = createGameState(10, 10);
    const next = spawnSnake(original, 'p1');
    expect(original.snakes).toHaveLength(0);
    expect(next.snakes).toHaveLength(1);
  });
});

// ── setDirection ──────────────────────────────────────────────────────────────
describe('setDirection', () => {
  it('updates nextDirection', () => {
    const s = makeState([makeSnake('p1', [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 5, y: 7 }], 'up')]);
    const next = setDirection(s, 'p1', 'left');
    expect(next.snakes[0].nextDirection).toBe('left');
  });

  it('rejects 180° reversal (up → down)', () => {
    const s = makeState([makeSnake('p1', [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 5, y: 7 }], 'up')]);
    const next = setDirection(s, 'p1', 'down');
    expect(next.snakes[0].nextDirection).toBe('up');
  });

  it('rejects 180° reversal (left → right)', () => {
    const s = makeState([makeSnake('p1', [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }], 'left')]);
    const next = setDirection(s, 'p1', 'right');
    expect(next.snakes[0].nextDirection).toBe('left');
  });
});

// ── generateFood ──────────────────────────────────────────────────────────────
describe('generateFood', () => {
  it('places N food items on an empty grid', () => {
    const s = generateFood(makeState(), 3);
    expect(s.food).toHaveLength(3);
  });

  it('does not place food when grid is full', () => {
    // 3×1 grid, snake fills all cells
    const body = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }];
    const s = makeState([makeSnake('p1', body)], [], 3, 1);
    const next = generateFood(s, 1);
    expect(next.food).toHaveLength(0);
  });
});

// ── tick ──────────────────────────────────────────────────────────────────────
describe('tick — movement', () => {
  it('moves head up by one cell', () => {
    const snake = makeSnake('p1', [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 5, y: 7 }], 'up');
    const { state } = tick(makeState([snake]));
    expect(state.snakes[0].body[0]).toEqual({ x: 5, y: 4 });
    expect(state.snakes[0].alive).toBe(true);
    expect(state.tick).toBe(1);
  });

  it('applies nextDirection before moving', () => {
    let s = makeState([makeSnake('p1', [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 5, y: 7 }], 'up')]);
    s = setDirection(s, 'p1', 'right');
    const { state } = tick(s);
    expect(state.snakes[0].body[0]).toEqual({ x: 6, y: 5 });
  });
});

describe('tick — wall collisions', () => {
  it('kills snake hitting left wall (x < 0)', () => {
    const snake = makeSnake('p1', [{ x: 0, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }], 'left');
    const { state, deaths } = tick(makeState([snake]));
    expect(state.snakes[0].alive).toBe(false);
    expect(deaths).toHaveLength(1);
    expect(deaths[0].id).toBe('p1');
  });

  it('kills snake hitting right wall (x >= width)', () => {
    const snake = makeSnake('p1', [{ x: 9, y: 5 }, { x: 8, y: 5 }, { x: 7, y: 5 }], 'right');
    const { state } = tick(makeState([snake], [], 10, 10));
    expect(state.snakes[0].alive).toBe(false);
  });

  it('kills snake hitting top wall (y < 0)', () => {
    const snake = makeSnake('p1', [{ x: 5, y: 0 }, { x: 5, y: 1 }, { x: 5, y: 2 }], 'up');
    const { state } = tick(makeState([snake]));
    expect(state.snakes[0].alive).toBe(false);
  });

  it('kills snake hitting bottom wall (y >= height)', () => {
    const snake = makeSnake('p1', [{ x: 5, y: 9 }, { x: 5, y: 8 }, { x: 5, y: 7 }], 'down');
    const { state } = tick(makeState([snake], [], 10, 10));
    expect(state.snakes[0].alive).toBe(false);
  });
});

describe('tick — body collisions', () => {
  it('kills snake on self collision', () => {
    // Spiral: head (2,2) going right → new head (3,2) which is already in body
    const body = [
      { x: 2, y: 2 }, { x: 1, y: 2 }, { x: 1, y: 1 },
      { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 3, y: 2 }, { x: 3, y: 3 }, { x: 2, y: 3 },
    ];
    const snake = makeSnake('p1', body, 'right');
    const { state } = tick(makeState([snake], [], 10, 10));
    expect(state.snakes[0].alive).toBe(false);
  });

  it('kills snake when head hits another snake body', () => {
    // p1 head (5,5) going right → (6,5); p2 body passes through (6,5)
    const p1 = makeSnake('p1', [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }], 'right');
    const p2 = makeSnake('p2', [{ x: 6, y: 3 }, { x: 6, y: 4 }, { x: 6, y: 5 }, { x: 6, y: 6 }], 'up', '#ff00c8');
    const { state } = tick(makeState([p1, p2], [], 10, 10));
    expect(state.snakes[0].alive).toBe(false); // p1 dead
    expect(state.snakes[1].alive).toBe(true);  // p2 alive
  });
});

describe('tick — food', () => {
  it('grows the snake and increments score when eating food', () => {
    const snake = makeSnake('p1', [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }], 'right');
    const { state } = tick(makeState([snake], [{ x: 6, y: 5 }], 10, 10));
    expect(state.snakes[0].body).toHaveLength(4);
    expect(state.snakes[0].score).toBe(1);
    // Food at (6,5) is consumed
    expect(state.food.some(f => f.x === 6 && f.y === 5)).toBe(false);
  });

  it('replenishes food after eating to maintain FOOD_COUNT', () => {
    const snake = makeSnake('p1', [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }], 'right');
    const initialFood = [{ x: 6, y: 5 }, { x: 1, y: 1 }, { x: 8, y: 8 }];
    const { state } = tick(makeState([snake], initialFood, 10, 10));
    expect(state.food).toHaveLength(FOOD_COUNT);
  });
});
