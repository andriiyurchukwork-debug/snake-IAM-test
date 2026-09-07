import { Direction, OPPOSITE } from '../types/Direction';
import { GRID_COLS, GRID_ROWS } from '../config/gameConfig';

export interface Point {
  x: number;
  y: number;
}

export interface GameSnapshot {
  snake: Point[];
  food: Point;
  score: number;
}

const DIRECTION_DELTA: Record<Direction, Point> = {
  [Direction.Up]: { x: 0, y: -1 },
  [Direction.Down]: { x: 0, y: 1 },
  [Direction.Left]: { x: -1, y: 0 },
  [Direction.Right]: { x: 1, y: 0 },
};

export class SnakeGameModel {
  private snake: Point[] = [];
  private direction = Direction.Right;
  private nextDirection = Direction.Right;
  private food: Point = { x: 0, y: 0 };
  private _score = 0;
  private _isGameOver = false;

  constructor() {
    this.reset();
  }

  get isGameOver(): boolean {
    return this._isGameOver;
  }

  get score(): number {
    return this._score;
  }

  getSnapshot(): GameSnapshot {
    return {
      snake: this.snake.map((segment) => ({ ...segment })),
      food: { ...this.food },
      score: this._score,
    };
  }

  reset(): void {
    const centerY = Math.floor(GRID_ROWS / 2);
    const centerX = Math.floor(GRID_COLS / 2);
    this.snake = [
      { x: centerX, y: centerY },
      { x: centerX - 1, y: centerY },
      { x: centerX - 2, y: centerY },
    ];
    this.direction = Direction.Right;
    this.nextDirection = Direction.Right;
    this._score = 0;
    this._isGameOver = false;
    this.spawnFood();
  }

  setDirection(dir: Direction): void {
    if (dir === OPPOSITE[this.direction]) {
      return;
    }
    this.nextDirection = dir;
  }

  tick(): void {
    if (this._isGameOver) {
      return;
    }

    this.direction = this.nextDirection;
    const head = this.snake[0];
    const delta = DIRECTION_DELTA[this.direction];
    const newHead = { x: head.x + delta.x, y: head.y + delta.y };

    if (
      newHead.x < 0 ||
      newHead.x >= GRID_COLS ||
      newHead.y < 0 ||
      newHead.y >= GRID_ROWS
    ) {
      this._isGameOver = true;
      return;
    }

    const isEating = newHead.x === this.food.x && newHead.y === this.food.y;
    const bodyToCheck = isEating ? this.snake : this.snake.slice(0, -1);

    if (bodyToCheck.some((segment) => segment.x === newHead.x && segment.y === newHead.y)) {
      this._isGameOver = true;
      return;
    }

    this.snake.unshift(newHead);

    if (isEating) {
      this._score += 1;
      this.spawnFood();
      return;
    }

    this.snake.pop();
  }

  private spawnFood(): void {
    const occupied = new Set(this.snake.map((segment) => `${segment.x},${segment.y}`));
    const available: Point[] = [];

    for (let y = 0; y < GRID_ROWS; y += 1) {
      for (let x = 0; x < GRID_COLS; x += 1) {
        if (!occupied.has(`${x},${y}`)) {
          available.push({ x, y });
        }
      }
    }

    this.food = available.length > 0
      ? available[Math.floor(Math.random() * available.length)]
      : { x: -1, y: -1 };
  }

  /** Test helpers */
  placeFoodAt(point: Point): void {
    this.food = { ...point };
  }

  setHeadAt(point: Point): void {
    this.snake[0] = { ...point };
  }

  setBody(body: Point[]): void {
    this.snake = body.map((segment) => ({ ...segment }));
  }
}
