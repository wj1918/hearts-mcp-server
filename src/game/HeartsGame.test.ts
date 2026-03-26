import { describe, it, expect } from 'vitest';
import { HeartsGame } from './HeartsGame.js';
import { Card, Suit, Rank, GamePhase, PlayerIndex, cardToString, cardsEqual } from '../types.js';

const c = (suit: Suit, rank: Rank): Card => ({ suit, rank });

describe('HeartsGame', () => {
  it('initializes with correct state', () => {
    const game = new HeartsGame('test1', 2);
    expect(game.state.id).toBe('test1');
    expect(game.state.round).toBe(0);
    expect(game.state.trickNumber).toBe(0);
    expect(game.state.heartsBroken).toBe(false);
    expect(game.state.players).toHaveLength(4);
    expect(game.getAgentSeat()).toBe(2);
  });

  it('deals 13 cards to each player', () => {
    const game = new HeartsGame('test2', 0);
    for (const player of game.state.players) {
      expect(player.hand).toHaveLength(13);
    }
  });

  it('all 52 cards are dealt', () => {
    const game = new HeartsGame('test3', 0);
    const allCards = game.state.players.flatMap(p => p.hand);
    expect(allCards).toHaveLength(52);
    for (let i = 0; i < allCards.length; i++) {
      for (let j = i + 1; j < allCards.length; j++) {
        expect(cardsEqual(allCards[i], allCards[j])).toBe(false);
      }
    }
  });

  it('starts in passing phase on round 0', () => {
    const game = new HeartsGame('test4', 0);
    expect(game.state.phase).toBe(GamePhase.Passing);
    expect(game.state.passDirection).toBe('left');
  });

  it('rejects play when not in playing phase', () => {
    const game = new HeartsGame('test5', 0);
    // Game starts in passing phase
    const result = game.playCard(0, c(Suit.Clubs, Rank.Two));
    expect(result.error).toBeDefined();
  });

  it('rejects play from wrong player', () => {
    const game = new HeartsGame('test6', 0);
    // Force to playing phase
    game.state.phase = GamePhase.Playing;
    game.state.currentPlayer = 1;
    const result = game.playCard(0, c(Suit.Clubs, Rank.Two));
    expect(result.error).toContain('Not player');
  });
});

describe('HeartsGame - passing', () => {
  it('submits pass and receives cards', () => {
    const game = new HeartsGame('pass1', 0);
    const hand = game.state.players[0].hand;
    const cardsToPass = hand.slice(0, 3);
    const result = game.submitPass(0, cardsToPass);
    expect(result.error).toBeUndefined();
    expect(result.receivedCards).toHaveLength(3);
  });

  it('rejects pass in wrong phase', () => {
    const game = new HeartsGame('pass2', 0);
    game.state.phase = GamePhase.Playing;
    const result = game.submitPass(0, [c(Suit.Clubs, Rank.Two), c(Suit.Clubs, Rank.Three), c(Suit.Clubs, Rank.Four)]);
    expect(result.error).toBeDefined();
  });

  it('rejects double pass', () => {
    const game = new HeartsGame('pass3', 0);
    const hand = game.state.players[0].hand;
    game.submitPass(0, hand.slice(0, 3));
    // After first pass, all AI also pass and phase transitions to playing
    const result = game.submitPass(0, hand.slice(3, 6));
    expect(result.error).toBeDefined();
  });

  it('transitions to playing after pass', () => {
    const game = new HeartsGame('pass4', 0);
    const hand = game.state.players[0].hand;
    game.submitPass(0, hand.slice(0, 3));
    expect(game.state.phase).toBe(GamePhase.Playing);
  });

  it('all players still have 13 cards after passing', () => {
    const game = new HeartsGame('pass5', 0);
    const hand = game.state.players[0].hand;
    game.submitPass(0, hand.slice(0, 3));
    for (const player of game.state.players) {
      expect(player.hand).toHaveLength(13);
    }
  });
});

describe('HeartsGame - autoPlayAI', () => {
  it('auto-plays until agent turn', () => {
    const game = new HeartsGame('auto1', 2);
    const hand = game.state.players[2].hand;
    game.submitPass(2, hand.slice(0, 3));

    // Now in playing phase, auto-play AI until player 2's turn
    const result = game.autoPlayAI();
    expect(result.plays.length).toBeGreaterThanOrEqual(0);
    // Should stop at agent's turn or game end
    if (game.state.phase === GamePhase.Playing) {
      expect(game.state.currentPlayer).toBe(2);
    }
  });
});

describe('HeartsGame - getVisibleState', () => {
  it('returns correct visible state', () => {
    const game = new HeartsGame('vis1', 2);
    const visible = game.getVisibleState(2);
    expect(visible.gameId).toBe('vis1');
    expect(visible.hand).toHaveLength(13);
    expect(visible.scores).toEqual([0, 0, 0, 0]);
    expect(visible.tricksTakenCount).toEqual([0, 0, 0, 0]);
    expect(visible.penaltyThisRound).toEqual([0, 0, 0, 0]);
    expect(visible.moonThreat).toBeNull();
  });

  it('shows legal plays only on your turn', () => {
    const game = new HeartsGame('vis2', 2);
    const hand = game.state.players[2].hand;
    game.submitPass(2, hand.slice(0, 3));
    game.autoPlayAI();

    const visible = game.getVisibleState(2);
    if (visible.isYourTurn) {
      expect(visible.legalPlays.length).toBeGreaterThan(0);
    }
  });
});

describe('HeartsGame - full round', () => {
  it('can play through an entire round', () => {
    const game = new HeartsGame('full1', 0);
    const agentSeat = 0 as PlayerIndex;

    // Pass phase
    const hand = game.state.players[agentSeat].hand;
    game.submitPass(agentSeat, hand.slice(0, 3));

    // Play phase - play all 13 tricks
    let trickCount = 0;
    let roundComplete = false;

    for (let i = 0; i < 200; i++) { // safety limit
      if (game.state.phase !== GamePhase.Playing) break;

      // Auto-play AI
      if (game.state.currentPlayer !== agentSeat) {
        game.autoPlayAI();
      }

      if (game.state.phase !== GamePhase.Playing) break;
      if (game.state.currentPlayer !== agentSeat) break;

      // Agent plays
      const visible = game.getVisibleState(agentSeat);
      if (visible.legalPlays.length === 0) break;

      const cardStr = visible.legalPlays[0];
      const card = game.state.players[agentSeat].hand.find(
        h => cardToString(h) === cardStr
      );
      if (!card) break;

      const result = game.playCard(agentSeat, card);
      if (result.error) break;
      if (result.trickComplete) trickCount++;
      if (result.roundComplete) {
        roundComplete = true;
        break;
      }

      // Auto-play remaining AI in this trick
      if (game.state.phase === GamePhase.Playing && game.state.currentPlayer !== agentSeat) {
        const autoResult = game.autoPlayAI();
        if (autoResult.roundComplete) {
          roundComplete = true;
          break;
        }
      }
    }

    // Should have completed the round
    expect(roundComplete).toBe(true);

    // Total penalty points: 26 (normal) or 78 (shoot the moon: 0 + 26 + 26 + 26)
    const totalPenalty = game.state.roundScoreHistory[0].reduce((a: number, b: number) => a + b, 0);
    expect([26, 78]).toContain(totalPenalty);
  });
});
