import { describe, it, expect, beforeEach } from 'vitest';
import { SnakeGameModel } from './SnakeGameModel';
import { Direction } from '../types/Direction';
import { GRID_COLS, GRID_ROWS } from '../config/gameConfig';

describe('SnakeGameModel', () => {
  let game: SnakeGameModel;

  beforeEach(() => {
    game = new SnakeGameModel();
  });

  it('starts with score 0 and snake length 3', () => {
    const snapshot = game.getSnapshot();
    expect(snapshot.score).toBe(0);
    expect(snapshot.snake.length).toBe(3);
  });

  it('moves snake head on tick', () => {
    const headBefore = game.getSnapshot().snake[0];
    game.tick();
    const headAfter = game.getSnapshot().snake[0];
    expect(headAfter.x).toBe(headBefore.x + 1);
    expect(headAfter.y).toBe(headBefore.y);
  });

  it('grows and increments score when eating food', () => {
    game.placeFoodAt({ x: 5, y: 10 });
    game.setHeadAt({ x: 4, y: 10 });
    game.setDirection(Direction.Right);
    game.tick();
    expect(game.getSnapshot().score).toBe(1);
    expect(game.getSnapshot().snake.length).toBe(4);
  });

  it('ends game on wall collision', () => {
    game.setHeadAt({ x: GRID_COLS - 1, y: 10 });
    game.setDirection(Direction.Right);
    game.tick();
    expect(game.isGameOver).toBe(true);
  });

  it('ends game on self collision', () => {
    game.setHeadAt({ x: 5, y: 10 });
    game.setBody([
      { x: 5, y: 10 },
      { x: 5, y: 11 },
      { x: 6, y: 11 },
      { x: 6, y: 10 },
      { x: 6, y: 9 },
    ]);
    game.tick();
    expect(game.isGameOver).toBe(true);
  });

  it('allows moving into the departing tail cell and continues', () => {
    game.setBody([
      { x: 4, y: 10 },
      { x: 4, y: 11 },
      { x: 5, y: 11 },
      { x: 5, y: 10 },
    ]);
    game.tick();

    expect(game.isGameOver).toBe(false);
    expect(game.getSnapshot().snake).toEqual([
      { x: 5, y: 10 },
      { x: 4, y: 10 },
      { x: 4, y: 11 },
      { x: 5, y: 11 },
    ]);
  });

  it('ends game when moving into the tail cell while eating food', () => {
    game.setBody([
      { x: 4, y: 10 },
      { x: 4, y: 11 },
      { x: 5, y: 11 },
      { x: 5, y: 10 },
    ]);
    game.placeFoodAt({ x: 5, y: 10 });
    game.tick();

    expect(game.isGameOver).toBe(true);
    expect(game.getSnapshot().snake).toEqual([
      { x: 4, y: 10 },
      { x: 4, y: 11 },
      { x: 5, y: 11 },
      { x: 5, y: 10 },
    ]);
  });

  it('cannot reverse direction', () => {
    game.setDirection(Direction.Up);
    game.tick();
    const head = game.getSnapshot().snake[0];
    game.setDirection(Direction.Down);
    game.tick();
    const newHead = game.getSnapshot().snake[0];
    expect(newHead.x).toBe(head.x);
    expect(newHead.y).toBe(head.y - 1);
  });

  it('does not loop when no free cell remains for food', () => {
    const cells = Array.from({ length: GRID_ROWS }, (_, y) =>
      Array.from({ length: GRID_COLS }, (_, x) => ({ x, y })),
    ).flat().filter(({ x, y }) => !(x === 0 && y === 0) && !(x === 1 && y === 0));

    game.setBody([{ x: 0, y: 0 }, ...cells]);
    game.placeFoodAt({ x: 1, y: 0 });
    game.setDirection(Direction.Right);

    game.tick();

    expect(game.getSnapshot().snake).toHaveLength(GRID_COLS * GRID_ROWS);
    expect(game.getSnapshot().food).toEqual({ x: -1, y: -1 });
  });
});
