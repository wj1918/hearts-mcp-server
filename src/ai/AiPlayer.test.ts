import { describe, it, expect } from 'vitest';
import { aiChoosePass, aiChoosePlay } from './AiPlayer.js';
import { Card, Suit, Rank, TrickCard, CompletedTrick, PlayerIndex, cardsEqual } from '../types.js';
import { getLegalPlays } from '../game/Rules.js';

const c = (suit: Suit, rank: Rank): Card => ({ suit, rank });
const tc = (player: PlayerIndex, suit: Suit, rank: Rank): TrickCard => ({
  player, card: { suit, rank },
});

function makeTrick(winner: PlayerIndex, cards: [PlayerIndex, Card][]): CompletedTrick {
  return {
    leader: cards[0][0],
    cards: cards.map(([player, card]) => ({ player, card })),
    winner,
  };
}

describe('aiChoosePass', () => {
  it('returns exactly 3 cards', () => {
    const hand: Card[] = [
      c(Suit.Clubs, Rank.Two), c(Suit.Clubs, Rank.Three), c(Suit.Clubs, Rank.Four),
      c(Suit.Diamonds, Rank.Five), c(Suit.Diamonds, Rank.Six), c(Suit.Diamonds, Rank.Seven),
      c(Suit.Spades, Rank.Eight), c(Suit.Spades, Rank.Nine), c(Suit.Spades, Rank.Ten),
      c(Suit.Hearts, Rank.Jack), c(Suit.Hearts, Rank.Queen), c(Suit.Hearts, Rank.King),
      c(Suit.Hearts, Rank.Ace),
    ];
    const passed = aiChoosePass(hand);
    expect(passed).toHaveLength(3);
  });

  it('returns cards that are in the hand', () => {
    const hand: Card[] = [
      c(Suit.Clubs, Rank.Two), c(Suit.Clubs, Rank.Three), c(Suit.Diamonds, Rank.Four),
      c(Suit.Diamonds, Rank.Five), c(Suit.Spades, Rank.Queen), c(Suit.Spades, Rank.King),
      c(Suit.Spades, Rank.Ace), c(Suit.Hearts, Rank.Two), c(Suit.Hearts, Rank.Three),
      c(Suit.Hearts, Rank.Jack), c(Suit.Hearts, Rank.Queen), c(Suit.Hearts, Rank.King),
      c(Suit.Hearts, Rank.Ace),
    ];
    const passed = aiChoosePass(hand);
    for (const card of passed) {
      expect(hand.some(h => cardsEqual(h, card))).toBe(true);
    }
  });

  it('prioritizes passing queen of spades', () => {
    const hand: Card[] = [
      c(Suit.Clubs, Rank.Two), c(Suit.Clubs, Rank.Three), c(Suit.Clubs, Rank.Four),
      c(Suit.Diamonds, Rank.Five), c(Suit.Diamonds, Rank.Six), c(Suit.Diamonds, Rank.Seven),
      c(Suit.Spades, Rank.Two), c(Suit.Spades, Rank.Three), c(Suit.Spades, Rank.Queen),
      c(Suit.Hearts, Rank.Two), c(Suit.Hearts, Rank.Three), c(Suit.Hearts, Rank.Four),
      c(Suit.Hearts, Rank.Five),
    ];
    const passed = aiChoosePass(hand);
    expect(passed.some(p => cardsEqual(p, c(Suit.Spades, Rank.Queen)))).toBe(true);
  });

  it('returns no duplicate cards', () => {
    const hand: Card[] = [
      c(Suit.Clubs, Rank.Ace), c(Suit.Clubs, Rank.King), c(Suit.Clubs, Rank.Queen),
      c(Suit.Diamonds, Rank.Ace), c(Suit.Diamonds, Rank.King), c(Suit.Diamonds, Rank.Queen),
      c(Suit.Spades, Rank.Ace), c(Suit.Spades, Rank.King), c(Suit.Spades, Rank.Queen),
      c(Suit.Hearts, Rank.Ace), c(Suit.Hearts, Rank.King), c(Suit.Hearts, Rank.Queen),
      c(Suit.Hearts, Rank.Jack),
    ];
    const passed = aiChoosePass(hand);
    for (let i = 0; i < passed.length; i++) {
      for (let j = i + 1; j < passed.length; j++) {
        expect(cardsEqual(passed[i], passed[j])).toBe(false);
      }
    }
  });
});

describe('aiChoosePlay', () => {
  it('returns a legal card', () => {
    const hand = [
      c(Suit.Clubs, Rank.Ace), c(Suit.Diamonds, Rank.King),
      c(Suit.Hearts, Rank.Queen), c(Suit.Spades, Rank.Jack),
    ];
    const trick: TrickCard[] = [tc(0, Suit.Clubs, Rank.Two)];
    const card = aiChoosePlay(1, hand, trick, false, false, []);
    const legal = getLegalPlays(hand, trick, false, false);
    expect(legal.some(l => cardsEqual(l, card))).toBe(true);
  });

  it('plays 2 of clubs when leading first trick', () => {
    const hand = [
      c(Suit.Clubs, Rank.Two), c(Suit.Clubs, Rank.Ace),
      c(Suit.Hearts, Rank.King), c(Suit.Spades, Rank.Queen),
    ];
    const card = aiChoosePlay(0, hand, [], false, true, []);
    expect(cardsEqual(card, c(Suit.Clubs, Rank.Two))).toBe(true);
  });

  it('follows suit when able', () => {
    const hand = [
      c(Suit.Clubs, Rank.Ace), c(Suit.Diamonds, Rank.King),
      c(Suit.Hearts, Rank.Queen),
    ];
    const trick: TrickCard[] = [tc(0, Suit.Clubs, Rank.Two)];
    const card = aiChoosePlay(1, hand, trick, false, false, []);
    expect(card.suit).toBe(Suit.Clubs);
  });

  it('dumps queen of spades when void in lead suit', () => {
    const hand = [
      c(Suit.Spades, Rank.Queen), c(Suit.Hearts, Rank.Two),
      c(Suit.Diamonds, Rank.Three),
    ];
    const trick: TrickCard[] = [tc(0, Suit.Clubs, Rank.Two)];
    const card = aiChoosePlay(1, hand, trick, false, false, []);
    expect(cardsEqual(card, c(Suit.Spades, Rank.Queen))).toBe(true);
  });

  it('dumps high hearts when void in lead suit and no QS', () => {
    const hand = [
      c(Suit.Hearts, Rank.Ace), c(Suit.Hearts, Rank.Two),
      c(Suit.Diamonds, Rank.Three),
    ];
    const trick: TrickCard[] = [tc(0, Suit.Clubs, Rank.Two)];
    const card = aiChoosePlay(1, hand, trick, false, false, []);
    expect(card.suit).toBe(Suit.Hearts);
    expect(card.rank).toBe(Rank.Ace);
  });

  it('always returns a card from the hand', () => {
    const hand = [
      c(Suit.Clubs, Rank.Five), c(Suit.Clubs, Rank.Nine),
      c(Suit.Diamonds, Rank.Two), c(Suit.Diamonds, Rank.Jack),
      c(Suit.Spades, Rank.Three), c(Suit.Hearts, Rank.Seven),
    ];
    // Leading, hearts not broken
    const card = aiChoosePlay(2, hand, [], false, false, []);
    expect(hand.some(h => cardsEqual(h, card))).toBe(true);
  });
});

describe('aiChoosePlay - moon blocking', () => {
  it('tries to take penalty when opponent threatens moon', () => {
    // Player 0 has all penalty so far (moon threat)
    const completedTricks: CompletedTrick[] = [
      makeTrick(0, [
        [0, c(Suit.Hearts, Rank.Ace)],
        [1, c(Suit.Clubs, Rank.Two)],
        [2, c(Suit.Clubs, Rank.Three)],
        [3, c(Suit.Clubs, Rank.Four)],
      ]),
      makeTrick(0, [
        [0, c(Suit.Hearts, Rank.King)],
        [1, c(Suit.Clubs, Rank.Five)],
        [2, c(Suit.Clubs, Rank.Six)],
        [3, c(Suit.Clubs, Rank.Seven)],
      ]),
      makeTrick(0, [
        [0, c(Suit.Hearts, Rank.Queen)],
        [1, c(Suit.Clubs, Rank.Eight)],
        [2, c(Suit.Clubs, Rank.Nine)],
        [3, c(Suit.Clubs, Rank.Ten)],
      ]),
    ];

    const hand = [
      c(Suit.Hearts, Rank.Ten), c(Suit.Hearts, Rank.Nine),
      c(Suit.Diamonds, Rank.Two), c(Suit.Spades, Rank.Two),
    ];

    // AI player 1 leading — should lead hearts to try to block
    const card = aiChoosePlay(1, hand, [], true, false, completedTricks);
    // Should choose a heart to lead (to try to win a heart trick and block moon)
    expect(card.suit).toBe(Suit.Hearts);
  });
});
