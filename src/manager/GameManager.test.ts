import { describe, it, expect } from 'vitest';
import { GameManager } from './GameManager.js';

describe('GameManager', () => {
  it('creates a game and retrieves it', () => {
    const mgr = new GameManager();
    const game = mgr.createGame(2);
    expect(game).toBeDefined();
    expect(game.state.id).toBeTruthy();
    expect(mgr.getGame(game.state.id)).toBe(game);
  });

  it('returns undefined for unknown game', () => {
    const mgr = new GameManager();
    expect(mgr.getGame('nonexistent')).toBeUndefined();
  });

  it('deletes a game', () => {
    const mgr = new GameManager();
    const game = mgr.createGame(0);
    const id = game.state.id;
    expect(mgr.deleteGame(id)).toBe(true);
    expect(mgr.getGame(id)).toBeUndefined();
  });

  it('returns false when deleting nonexistent game', () => {
    const mgr = new GameManager();
    expect(mgr.deleteGame('nonexistent')).toBe(false);
  });

  it('lists all games', () => {
    const mgr = new GameManager();
    expect(mgr.listGames()).toHaveLength(0);
    mgr.createGame(0);
    mgr.createGame(1);
    const list = mgr.listGames();
    expect(list).toHaveLength(2);
    expect(list[0]).toHaveProperty('id');
    expect(list[0]).toHaveProperty('phase');
    expect(list[0]).toHaveProperty('round');
  });

  it('sets agent seat correctly', () => {
    const mgr = new GameManager();
    const game = mgr.createGame(2);
    expect(game.getAgentSeat()).toBe(2);
    expect(game.state.players[2].isAgent).toBe(true);
    expect(game.state.players[0].isAgent).toBe(false);
  });
});
