import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  CELL_HEIGHT,
  CELL_WIDTH,
  GRID_COLS,
  GRID_ROWS,
} from '../config/gameConfig';
import type { GameSnapshot } from '../models/SnakeGameModel';

export class GameView {
  constructor(private readonly canvas: HTMLCanvasElement) {
    this.canvas.width = CANVAS_WIDTH;
    this.canvas.height = CANVAS_HEIGHT;
  }

  show(): void {
    this.canvas.style.display = 'block';
  }

  hide(): void {
    this.canvas.style.display = 'none';
  }

  render(snapshot: GameSnapshot): void {
    const context = this.canvas.getContext('2d');
    if (!context) {
      return;
    }

    context.fillStyle = '#1a1a2e';
    context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    context.strokeStyle = '#2a2a4e';
    for (let x = 0; x <= CANVAS_WIDTH; x += CELL_WIDTH) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, CANVAS_HEIGHT);
      context.stroke();
    }
    for (let y = 0; y <= CANVAS_HEIGHT; y += CELL_HEIGHT) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(CANVAS_WIDTH, y);
      context.stroke();
    }

    if (this.isInBounds(snapshot.food.x, snapshot.food.y)) {
      context.fillStyle = '#e74c3c';
      context.fillRect(
        snapshot.food.x * CELL_WIDTH,
        snapshot.food.y * CELL_HEIGHT,
        CELL_WIDTH,
        CELL_HEIGHT,
      );
    }

    snapshot.snake.forEach((segment, index) => {
      if (!this.isInBounds(segment.x, segment.y)) {
        return;
      }
      context.fillStyle = index === 0 ? '#2ecc71' : '#27ae60';
      context.fillRect(
        segment.x * CELL_WIDTH,
        segment.y * CELL_HEIGHT,
        CELL_WIDTH,
        CELL_HEIGHT,
      );
    });

    context.fillStyle = '#ffffff';
    context.font = '24px sans-serif';
    const scoreText = `Score: ${snapshot.score}`;
    const scoreWidth = context.measureText(scoreText).width;
    context.fillText(scoreText, CANVAS_WIDTH / 2 - scoreWidth / 2, 40);
  }

  private isInBounds(x: number, y: number): boolean {
    return x >= 0 && x < GRID_COLS && y >= 0 && y < GRID_ROWS;
  }
}
