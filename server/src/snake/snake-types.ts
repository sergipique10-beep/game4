// server/src/snake/snake-types.ts

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Point {
  x: number;
  y: number;
}

export interface Snake {
  id: string;
  body: Point[];        // [0] = head
  direction: Direction;
  nextDirection: Direction;
  alive: boolean;
  score: number;
  color: string;
}

export interface GameState {
  snakes: Snake[];
  food: Point[];
  tick: number;
  width: number;
  height: number;
}

export interface DeathEvent {
  id: string;
  score: number;
}

export interface TickResult {
  state: GameState;
  deaths: DeathEvent[];
}

export interface SnakeRanking {
  playerId: string;
  name: string;
  score: number;
  color: string;
  position: number;
}

export type SerializedGameState = {
  snakes: Array<{
    id: string;
    body: Point[];
    direction: Direction;
    alive: boolean;
    score: number;
    color: string;
  }>;
  food: Point[];
  tick: number;
  width: number;
  height: number;
};
