import { describe, expect, it, vi } from 'vitest';
import { GameView } from './GameView';
import {
  CANVAS_HEIGHT,
  CELL_HEIGHT,
  CELL_WIDTH,
  CANVAS_WIDTH,
  GRID_COLS,
  GRID_ROWS,
} from '../config/gameConfig';

describe('GameView', () => {
  it('uses rectangular cells that cover the full HD canvas', () => {
    expect(CANVAS_WIDTH).toBe(1280);
    expect(CANVAS_HEIGHT).toBe(720);
    expect(GRID_COLS).toBe(40);
    expect(GRID_ROWS).toBe(24);
    expect(CELL_WIDTH).toBe(32);
    expect(CELL_HEIGHT).toBe(30);
    expect(GRID_COLS * CELL_WIDTH).toBe(CANVAS_WIDTH);
    expect(GRID_ROWS * CELL_HEIGHT).toBe(CANVAS_HEIGHT);
  });

  it('sizes, toggles, and renders the game canvas', () => {
    const context = {
      beginPath: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      lineTo: vi.fn(),
      moveTo: vi.fn(),
      stroke: vi.fn(),
      fillStyle: '',
      font: '',
      measureText: vi.fn(() => ({ width: 84 })),
      strokeStyle: '',
    };
    const canvas = {
      getContext: vi.fn(() => context),
      height: 0,
      style: { display: '' },
      width: 0,
    } as unknown as HTMLCanvasElement;
    const view = new GameView(canvas);

    expect(canvas.width).toBe(1280);
    expect(canvas.height).toBe(720);

    view.hide();
    expect(canvas.style.display).toBe('none');
    view.show();
    expect(canvas.style.display).toBe('block');

    view.render({
      food: { x: 2, y: 3 },
      score: 7,
      snake: [{ x: 4, y: 5 }, { x: 3, y: 5 }],
    });

    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 1280, 720);
    expect(context.fillRect).toHaveBeenCalledWith(64, 90, CELL_WIDTH, CELL_HEIGHT);
    expect(context.fillRect).toHaveBeenCalledWith(128, 150, CELL_WIDTH, CELL_HEIGHT);
    expect(context.fillRect).toHaveBeenCalledWith(96, 150, CELL_WIDTH, CELL_HEIGHT);
    expect(context.moveTo).toHaveBeenCalledWith(0, 0);
    expect(context.lineTo).toHaveBeenCalledWith(CANVAS_WIDTH, CANVAS_HEIGHT);
    expect(context.measureText).toHaveBeenCalledWith('Score: 7');
    expect(context.fillText).toHaveBeenCalledWith('Score: 7', 598, 40);
    expect(context.stroke).toHaveBeenCalled();
  });

  it('does not draw cells outside the full-cell board bounds', () => {
    const context = {
      beginPath: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      lineTo: vi.fn(),
      moveTo: vi.fn(),
      stroke: vi.fn(),
      fillStyle: '',
      font: '',
      measureText: vi.fn(() => ({ width: 84 })),
      strokeStyle: '',
    };
    const canvas = {
      getContext: vi.fn(() => context),
      height: 0,
      style: { display: '' },
      width: 0,
    } as unknown as HTMLCanvasElement;
    const view = new GameView(canvas);

    const invalidCoordinates = [
      { x: -1, y: 0 },
      { x: 0, y: -1 },
      { x: GRID_COLS, y: 0 },
      { x: 0, y: GRID_ROWS },
    ];

    invalidCoordinates.forEach((coordinate) => {
      context.fillRect.mockClear();

      view.render({
        food: coordinate,
        score: 0,
        snake: [coordinate],
      });

      expect(context.fillRect).toHaveBeenCalledTimes(1);
      expect(context.fillRect).not.toHaveBeenCalledWith(
        coordinate.x * CELL_WIDTH,
        coordinate.y * CELL_HEIGHT,
        CELL_WIDTH,
        CELL_HEIGHT,
      );
    });

    context.fillRect.mockClear();
    view.render({
      food: { x: GRID_COLS - 1, y: GRID_ROWS - 1 },
      score: 0,
      snake: [{ x: GRID_COLS - 1, y: GRID_ROWS - 1 }],
    });

    expect(context.fillRect).toHaveBeenCalledWith(
      (GRID_COLS - 1) * CELL_WIDTH,
      (GRID_ROWS - 1) * CELL_HEIGHT,
      CELL_WIDTH,
      CELL_HEIGHT,
    );
    expect(context.fillRect).toHaveBeenCalledTimes(3);
  });
});
