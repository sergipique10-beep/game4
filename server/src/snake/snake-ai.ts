import { GameState, Direction } from './snake-types';
import { setDirection, tick } from './snake-engine';

const DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right'];

export function getBotDirection(
  state: GameState,
  botId: string,
  humanId: string,
  depth = 8,
): Direction {
  let bestDir: Direction = DIRECTIONS[0];
  let bestScore = -Infinity;
  let alpha = -Infinity;
  const beta = Infinity;

  for (const dir of DIRECTIONS) {
    const next = setDirection(state, botId, dir);
    const score = minimize(next, botId, humanId, depth - 1, alpha, beta);
    if (score > bestScore) {
      bestScore = score;
      bestDir = dir;
    }
    if (bestScore > alpha) alpha = bestScore;
  }
  return bestDir;
}

// Bot already chose direction; now human chooses and tick is applied.
function minimize(
  state: GameState,
  botId: string,
  humanId: string,
  depth: number,
  alpha: number,
  beta: number,
): number {
  if (depth === 0) return evaluate(state, botId, humanId);

  let best = Infinity;
  for (const dir of DIRECTIONS) {
    const withHuman = setDirection(state, humanId, dir);
    const { state: next } = tick(withHuman);

    const bot = next.snakes.find(s => s.id === botId);
    const human = next.snakes.find(s => s.id === humanId);
    if (!bot?.alive && !human?.alive) { best = Math.min(best, 0); continue; }
    if (!bot?.alive) { best = Math.min(best, -100000); continue; }
    if (!human?.alive) { best = Math.min(best, 100000); continue; }

    const score = maximize(next, botId, humanId, depth - 1, alpha, beta);
    if (score < best) best = score;
    if (best < beta) beta = best;
    if (alpha >= beta) break;
  }
  return best;
}

// Human already chose direction (via tick); now bot chooses.
function maximize(
  state: GameState,
  botId: string,
  humanId: string,
  depth: number,
  alpha: number,
  beta: number,
): number {
  if (depth === 0) return evaluate(state, botId, humanId);

  let best = -Infinity;
  for (const dir of DIRECTIONS) {
    const next = setDirection(state, botId, dir);
    const score = minimize(next, botId, humanId, depth - 1, alpha, beta);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

function evaluate(state: GameState, botId: string, humanId: string): number {
  const bot = state.snakes.find(s => s.id === botId);
  const human = state.snakes.find(s => s.id === humanId);
  if (!bot?.alive && !human?.alive) return 0;
  if (!bot?.alive) return -100000;
  if (!human?.alive) return 100000;
  return floodFill(state, botId) - floodFill(state, humanId);
}

function floodFill(state: GameState, id: string): number {
  const snake = state.snakes.find(s => s.id === id);
  if (!snake?.alive) return 0;

  const blocked = new Set<string>();
  for (const s of state.snakes) {
    if (!s.alive) continue;
    const isMe = s.id === id;
    // Skip own head (starting point); block all other segments
    for (let i = isMe ? 1 : 0; i < s.body.length; i++) {
      blocked.add(`${s.body[i].x},${s.body[i].y}`);
    }
  }

  const visited = new Set<string>();
  const queue: Array<{ x: number; y: number }> = [{ ...snake.body[0] }];
  let count = 0;

  while (queue.length > 0) {
    const p = queue.shift()!;
    const key = `${p.x},${p.y}`;
    if (visited.has(key)) continue;
    if (p.x < 0 || p.x >= state.width || p.y < 0 || p.y >= state.height) continue;
    if (blocked.has(key)) continue;
    visited.add(key);
    count++;
    queue.push(
      { x: p.x + 1, y: p.y },
      { x: p.x - 1, y: p.y },
      { x: p.x, y: p.y + 1 },
      { x: p.x, y: p.y - 1 },
    );
  }
  return count;
}
