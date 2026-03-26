import { describe, it, expect } from 'vitest';
import { scoreRound, penaltyPointsByPlayer, moonThreat, isGameOver, getWinner } from './Scorer.js';
import { Card, Suit, Rank, CompletedTrick, TrickCard, PlayerIndex } from '../types.js';

function makeTrick(winner: PlayerIndex, cards: Card[]): CompletedTrick {
  return {
    leader: 0,
    cards: cards.map((card, i) => ({ player: i as PlayerIndex, card })),
    winner,
  };
}

const heart = (rank: Rank): Card => ({ suit: Suit.Hearts, rank });
const spade = (rank: Rank): Card => ({ suit: Suit.Spades, rank });
const club = (rank: Rank): Card => ({ suit: Suit.Clubs, rank });
const diamond = (rank: Rank): Card => ({ suit: Suit.Diamonds, rank });

describe('scoreRound', () => {
  it('scores hearts at 1 point each', () => {
    const trick = makeTrick(0, [
      heart(Rank.Two), club(Rank.Ace), diamond(Rank.King), spade(Rank.Jack),
    ]);
    const result = scoreRound([[trick], [], [], []]);
    expect(result.scores).toEqual([1, 0, 0, 0]);
    expect(result.shotTheMoon).toBeNull();
  });

  it('scores queen of spades at 13 points', () => {
    const trick = makeTrick(1, [
      club(Rank.Ace), spade(Rank.Queen), diamond(Rank.King), spade(Rank.Jack),
    ]);
    const result = scoreRound([[], [trick], [], []]);
    expect(result.scores).toEqual([0, 13, 0, 0]);
  });

  it('sums points across multiple tricks', () => {
    const t1 = makeTrick(0, [heart(Rank.Two), club(Rank.Ace), diamond(Rank.King), spade(Rank.Jack)]);
    const t2 = makeTrick(0, [heart(Rank.Three), club(Rank.King), diamond(Rank.Queen), spade(Rank.Ten)]);
    const result = scoreRound([[t1, t2], [], [], []]);
    expect(result.scores).toEqual([2, 0, 0, 0]);
  });

  it('detects shoot the moon', () => {
    // Player 0 takes all 13 hearts + queen of spades = 26 pts
    const tricks: CompletedTrick[] = [];
    // 13 hearts
    for (let r = Rank.Two; r <= Rank.Ace; r++) {
      tricks.push(makeTrick(0, [heart(r), club(Rank.Two), diamond(Rank.Two), spade(Rank.Two)]));
    }
    // Queen of spades in one trick (already have 13 hearts above, add QS trick)
    // Actually let's restructure: put QS in one of the tricks
    const tricksWithQS: CompletedTrick[] = [];
    for (let r = Rank.Two; r <= Rank.Ace; r++) {
      const cards: Card[] = [heart(r), club(Rank.Two), diamond(Rank.Two),
        r === Rank.Ace ? spade(Rank.Queen) : spade(Rank.Two)];
      tricksWithQS.push(makeTrick(0, cards));
    }
    const result = scoreRound([tricksWithQS, [], [], []]);
    expect(result.scores).toEqual([0, 26, 26, 26]);
    expect(result.shotTheMoon).toBe(0);
  });

  it('returns zero scores when no penalty cards taken', () => {
    const trick = makeTrick(0, [
      club(Rank.Ace), club(Rank.King), diamond(Rank.King), spade(Rank.Jack),
    ]);
    const result = scoreRound([[trick], [], [], []]);
    expect(result.scores).toEqual([0, 0, 0, 0]);
    expect(result.shotTheMoon).toBeNull();
  });
});

describe('penaltyPointsByPlayer', () => {
  it('tracks penalty points per winner', () => {
    const t1 = makeTrick(0, [heart(Rank.Ace), club(Rank.Two), diamond(Rank.Two), spade(Rank.Two)]);
    const t2 = makeTrick(2, [spade(Rank.Queen), club(Rank.Three), diamond(Rank.Three), spade(Rank.Three)]);
    expect(penaltyPointsByPlayer([t1, t2])).toEqual([1, 0, 13, 0]);
  });

  it('returns all zeros when no penalty cards', () => {
    const t1 = makeTrick(0, [club(Rank.Ace), club(Rank.Two), diamond(Rank.Two), spade(Rank.Two)]);
    expect(penaltyPointsByPlayer([t1])).toEqual([0, 0, 0, 0]);
  });
});

describe('moonThreat', () => {
  it('returns null when no penalty cards taken', () => {
    expect(moonThreat([])).toBeNull();
  });

  it('returns null when penalty is below threshold', () => {
    const t1 = makeTrick(0, [heart(Rank.Two), club(Rank.Ace), diamond(Rank.King), spade(Rank.Jack)]);
    const t2 = makeTrick(1, [heart(Rank.Three), club(Rank.Two), diamond(Rank.Two), spade(Rank.Two)]);
    expect(moonThreat([t1, t2])).toBeNull();
  });

  it('returns null when penalty is split among players', () => {
    const t1 = makeTrick(0, [heart(Rank.Two), club(Rank.Ace), diamond(Rank.King), heart(Rank.Three)]);
    const t2 = makeTrick(1, [heart(Rank.Four), club(Rank.Two), diamond(Rank.Two), spade(Rank.Two)]);
    expect(moonThreat([t1, t2])).toBeNull();
  });

  it('detects single player collecting all penalty points', () => {
    const t1 = makeTrick(2, [heart(Rank.Ace), club(Rank.Ace), heart(Rank.King), spade(Rank.Jack)]);
    const t2 = makeTrick(2, [heart(Rank.Queen), club(Rank.Two), diamond(Rank.Two), spade(Rank.Two)]);
    expect(moonThreat([t1, t2])).toBe(2);
  });
});

describe('isGameOver', () => {
  it('returns false when all scores below 100', () => {
    expect(isGameOver([0, 50, 99, 20])).toBe(false);
  });

  it('returns true when any score reaches 100', () => {
    expect(isGameOver([0, 100, 50, 20])).toBe(true);
  });

  it('returns true when score exceeds 100', () => {
    expect(isGameOver([0, 130, 50, 20])).toBe(true);
  });
});

describe('getWinner', () => {
  it('returns player with lowest score', () => {
    expect(getWinner([50, 100, 30, 80])).toBe(2);
  });

  it('returns first player on tie', () => {
    expect(getWinner([10, 50, 10, 80])).toBe(0);
  });
});
