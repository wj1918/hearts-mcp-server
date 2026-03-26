import crypto from 'node:crypto';
import { HeartsGame } from '../game/HeartsGame.js';
import { PlayerIndex } from '../types.js';

export class GameManager {
  private games = new Map<string, HeartsGame>();

  createGame(agentSeat: PlayerIndex = 0): HeartsGame {
    const id = crypto.randomUUID().slice(0, 8);
    const game = new HeartsGame(id, agentSeat);
    this.games.set(id, game);
    return game;
  }

  getGame(id: string): HeartsGame | undefined {
    return this.games.get(id);
  }

  deleteGame(id: string): boolean {
    return this.games.delete(id);
  }

  listGames(): { id: string; phase: string; round: number }[] {
    return [...this.games.values()].map(g => ({
      id: g.state.id,
      phase: g.state.phase,
      round: g.state.round,
    }));
  }
}
