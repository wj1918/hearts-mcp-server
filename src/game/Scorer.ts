import { CompletedTrick, PlayerIndex, Suit, Rank, cardsEqual } from '../types.js';

const QUEEN_OF_SPADES = { suit: Suit.Spades, rank: Rank.Queen };

export interface RoundResult {
  scores: number[];
  shotTheMoon: PlayerIndex | null;
}

export function scoreRound(tricksByPlayer: CompletedTrick[][]): RoundResult {
  const scores = [0, 0, 0, 0];

  for (let p = 0; p < 4; p++) {
    for (const trick of tricksByPlayer[p]) {
      for (const tc of trick.cards) {
        if (tc.card.suit === Suit.Hearts) scores[p] += 1;
        if (cardsEqual(tc.card, QUEEN_OF_SPADES)) scores[p] += 13;
      }
    }
  }

  // Shoot the moon check
  let shotTheMoon: PlayerIndex | null = null;
  for (let p = 0; p < 4; p++) {
    if (scores[p] === 26) {
      shotTheMoon = p as PlayerIndex;
      // Player shot the moon - everyone else gets 26
      for (let q = 0; q < 4; q++) {
        scores[q] = q === p ? 0 : 26;
      }
      break;
    }
  }

  return { scores, shotTheMoon };
}

/** Get penalty points per player from a list of completed tricks (mid-round tracking). */
export function penaltyPointsByPlayer(completedTricks: CompletedTrick[]): number[] {
  const pts = [0, 0, 0, 0];
  for (const trick of completedTricks) {
    const winner = trick.winner;
    for (const tc of trick.cards) {
      if (tc.card.suit === Suit.Hearts) pts[winner]++;
      if (cardsEqual(tc.card, QUEEN_OF_SPADES)) pts[winner] += 13;
    }
  }
  return pts;
}

/** Detect if any player is threatening to shoot the moon. */
export function moonThreat(completedTricks: CompletedTrick[]): PlayerIndex | null {
  const pts = penaltyPointsByPlayer(completedTricks);
  const total = pts.reduce((a, b) => a + b, 0);
  if (total < 3) return null;
  for (let i = 0; i < 4; i++) {
    if (pts[i] === total) return i as PlayerIndex;
  }
  return null;
}

export function isGameOver(cumulativeScores: number[]): boolean {
  return cumulativeScores.some(s => s >= 100);
}

export function getWinner(cumulativeScores: number[]): PlayerIndex {
  let minScore = Infinity;
  let winner: PlayerIndex = 0;
  for (let i = 0; i < 4; i++) {
    if (cumulativeScores[i] < minScore) {
      minScore = cumulativeScores[i];
      winner = i as PlayerIndex;
    }
  }
  return winner;
}
