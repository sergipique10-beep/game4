import { createGameState, spawnSnake, generateFood, setDirection } from './snake-engine';
import { getBotDirection } from './snake-ai';
import { GameState } from './snake-types';

function makeState(): GameState {
  let s = createGameState(10, 10);
  s = spawnSnake(s, 'bot');
  s = spawnSnake(s, 'human');
  s = generateFood(s, 1);
  return s;
}

describe('getBotDirection', () => {
  it('returns a valid direction', () => {
    const state = makeState();
    const dir = getBotDirection(state, 'bot', 'human');
    expect(['up', 'down', 'left', 'right']).toContain(dir);
  });

  it('avoids immediate wall collision when a safe direction exists', () => {
    // Bot head at (0, 0) — only 'down' and 'right' are safe
    let state = createGameState(10, 10);
    // Manually place bot at top-left corner
    state = {
      ...state,
      snakes: [
        {
          id: 'bot',
          body: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }],
          direction: 'up',
          nextDirection: 'up',
          alive: true,
          score: 0,
          color: '#00f0ff',
        },
        {
          id: 'human',
          body: [{ x: 9, y: 9 }, { x: 9, y: 8 }, { x: 9, y: 7 }],
          direction: 'up',
          nextDirection: 'up',
          alive: true,
          score: 0,
          color: '#ff00c8',
        },
      ],
      food: [{ x: 5, y: 5 }],
    };
    const dir = getBotDirection(state, 'bot', 'human', 2);
    expect(['down', 'right']).toContain(dir);
  });

  it('avoids own body collision', () => {
    // Bot in a U-shape, only one safe direction
    let state = createGameState(10, 10);
    state = {
      ...state,
      snakes: [
        {
          id: 'bot',
          // Head at (5,5), body goes right then down — only 'left' is blocked by body
          body: [
            { x: 5, y: 5 },
            { x: 6, y: 5 },
            { x: 6, y: 6 },
            { x: 5, y: 6 },
          ],
          direction: 'left',
          nextDirection: 'left',
          alive: true,
          score: 0,
          color: '#00f0ff',
        },
        {
          id: 'human',
          body: [{ x: 1, y: 1 }, { x: 1, y: 2 }, { x: 1, y: 3 }],
          direction: 'up',
          nextDirection: 'up',
          alive: true,
          score: 0,
          color: '#ff00c8',
        },
      ],
      food: [{ x: 9, y: 9 }],
    };
    const dir = getBotDirection(state, 'bot', 'human', 2);
    // 'left' goes to (4,5) which is safe; 'right' goes into body at (6,5) — should not choose right
    // (up and down are also valid since they lead to open space in this config)
    expect(dir).not.toBe('right');
  });
});
