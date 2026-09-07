import { AppController } from './controllers/AppController';
import { GameView } from './views/GameView';
import { PromptView } from './views/PromptView';
import { AdView } from './views/AdView';
import { AdModel } from './models/AdModel';

const canvas = document.getElementById('game-canvas');
const appContainer = document.getElementById('app');
const overlay = document.getElementById('prompt-overlay');
const promptText = document.getElementById('prompt-text');
const adContainer = document.getElementById('ad-container');
const adVideo = document.getElementById('ad-video');

if (
  !(canvas instanceof HTMLCanvasElement) ||
  !appContainer ||
  !overlay ||
  !promptText ||
  !adContainer ||
  !(adVideo instanceof HTMLVideoElement)
) {
  throw new Error('Snake game elements are missing from the page');
}

const adView = new AdView(adContainer, adVideo);
const app = new AppController(
  new GameView(canvas),
  new PromptView(overlay, promptText),
  undefined,
  adView,
  new AdModel(adView.getContainer(), adView.getVideo()),
  () => appContainer.focus(),
);

app.start();
