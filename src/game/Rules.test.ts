import { describe, it, expect } from 'vitest';
import {
  getPassDirection, getPassTarget, findTwoOfClubsHolder,
  validatePass, isPenaltyCard, getLegalPlays, trickWinner, trickPoints,
} from './Rules.js';
import { Card, Suit, Rank, TrickCard, PlayerIndex, cardsEqual } from '../types.js';

const c = (suit: Suit, rank: Rank): Card => ({ suit, rank });
const tc = (player: PlayerIndex, suit: Suit, rank: Rank): TrickCard => ({
  player, card: { suit, rank },
});

describe('getPassDirection', () => {
  it('cycles through left, right, across, none', () => {
    expect(getPassDirection(0)).toBe('left');
    expect(getPassDirection(1)).toBe('right');
    expect(getPassDirection(2)).toBe('across');
    expect(getPassDirection(3)).toBe('none');
    expect(getPassDirection(4)).toBe('left');
    expect(getPassDirection(7)).toBe('none');
  });
});

describe('getPassTarget', () => {
  it('passes left correctly', () => {
    expect(getPassTarget(0, 'left')).toBe(1);
    expect(getPassTarget(1, 'left')).toBe(2);
    expect(getPassTarget(3, 'left')).toBe(0);
  });

  it('passes right correctly', () => {
    expect(getPassTarget(0, 'right')).toBe(3);
    expect(getPassTarget(1, 'right')).toBe(0);
    expect(getPassTarget(3, 'right')).toBe(2);
  });

  it('passes across correctly', () => {
    expect(getPassTarget(0, 'across')).toBe(2);
    expect(getPassTarget(1, 'across')).toBe(3);
    expect(getPassTarget(2, 'across')).toBe(0);
  });

  it('returns same player for none', () => {
    expect(getPassTarget(0, 'none')).toBe(0);
    expect(getPassTarget(2, 'none')).toBe(2);
  });
});

describe('findTwoOfClubsHolder', () => {
  it('finds the player with 2 of clubs', () => {
    const hands = [
      [c(Suit.Hearts, Rank.Ace)],
      [c(Suit.Clubs, Rank.Two)],
      [c(Suit.Diamonds, Rank.King)],
      [c(Suit.Spades, Rank.Queen)],
    ];
    expect(findTwoOfClubsHolder(hands)).toBe(1);
  });

  it('throws if no one has 2 of clubs', () => {
    const hands = [
      [c(Suit.Hearts, Rank.Ace)],
      [c(Suit.Clubs, Rank.Three)],
      [c(Suit.Diamonds, Rank.King)],
      [c(Suit.Spades, Rank.Queen)],
    ];
    expect(() => findTwoOfClubsHolder(hands)).toThrow();
  });
});

describe('validatePass', () => {
  const hand = [
    c(Suit.Clubs, Rank.Ace),
    c(Suit.Diamonds, Rank.King),
    c(Suit.Spades, Rank.Queen),
    c(Suit.Hearts, Rank.Jack),
    c(Suit.Clubs, Rank.Ten),
  ];

  it('accepts valid 3-card pass', () => {
    const cards = [hand[0], hand[1], hand[2]];
    expect(validatePass(cards, hand)).toBeNull();
  });

  it('rejects wrong number of cards', () => {
    expect(validatePass([hand[0], hand[1]], hand)).toBe('Must pass exactly 3 cards');
  });

  it('rejects cards not in hand', () => {
    const cards = [hand[0], hand[1], c(Suit.Hearts, Rank.Ace)];
    expect(validatePass(cards, hand)).toBe('Card not in hand');
  });

  it('rejects duplicate cards', () => {
    const cards = [hand[0], hand[0], hand[1]];
    expect(validatePass(cards, hand)).toBe('Duplicate cards in pass');
  });
});

describe('isPenaltyCard', () => {
  it('hearts are penalty cards', () => {
    expect(isPenaltyCard(c(Suit.Hearts, Rank.Two))).toBe(true);
    expect(isPenaltyCard(c(Suit.Hearts, Rank.Ace))).toBe(true);
  });

  it('queen of spades is a penalty card', () => {
    expect(isPenaltyCard(c(Suit.Spades, Rank.Queen))).toBe(true);
  });

  it('other cards are not penalty cards', () => {
    expect(isPenaltyCard(c(Suit.Clubs, Rank.Ace))).toBe(false);
    expect(isPenaltyCard(c(Suit.Diamonds, Rank.King))).toBe(false);
    expect(isPenaltyCard(c(Suit.Spades, Rank.King))).toBe(false);
    expect(isPenaltyCard(c(Suit.Spades, Rank.Ace))).toBe(false);
  });
});

describe('getLegalPlays', () => {
  it('must lead 2 of clubs on first trick', () => {
    const hand = [
      c(Suit.Clubs, Rank.Two),
      c(Suit.Clubs, Rank.Ace),
      c(Suit.Hearts, Rank.King),
    ];
    const legal = getLegalPlays(hand, [], false, true);
    expect(legal).toHaveLength(1);
    expect(cardsEqual(legal[0], c(Suit.Clubs, Rank.Two))).toBe(true);
  });

  it('cannot lead hearts when not broken', () => {
    const hand = [
      c(Suit.Clubs, Rank.Ace),
      c(Suit.Hearts, Rank.King),
      c(Suit.Hearts, Rank.Two),
    ];
    const legal = getLegalPlays(hand, [], false, false);
    expect(legal).toHaveLength(1);
    expect(legal[0].suit).toBe(Suit.Clubs);
  });

  it('can lead hearts when broken', () => {
    const hand = [
      c(Suit.Clubs, Rank.Ace),
      c(Suit.Hearts, Rank.King),
    ];
    const legal = getLegalPlays(hand, [], true, false);
    expect(legal).toHaveLength(2);
  });

  it('can lead hearts when only hearts remain', () => {
    const hand = [
      c(Suit.Hearts, Rank.King),
      c(Suit.Hearts, Rank.Two),
    ];
    const legal = getLegalPlays(hand, [], false, false);
    expect(legal).toHaveLength(2);
  });

  it('must follow suit', () => {
    const hand = [
      c(Suit.Clubs, Rank.Ace),
      c(Suit.Diamonds, Rank.King),
      c(Suit.Hearts, Rank.Queen),
    ];
    const trick = [tc(0, Suit.Clubs, Rank.Two)];
    const legal = getLegalPlays(hand, trick, false, false);
    expect(legal).toHaveLength(1);
    expect(legal[0].suit).toBe(Suit.Clubs);
  });

  it('can play anything when void in lead suit', () => {
    const hand = [
      c(Suit.Diamonds, Rank.King),
      c(Suit.Hearts, Rank.Queen),
      c(Suit.Spades, Rank.Ace),
    ];
    const trick = [tc(0, Suit.Clubs, Rank.Two)];
    const legal = getLegalPlays(hand, trick, false, false);
    expect(legal).toHaveLength(3);
  });

  it('cannot play penalty cards on first trick when void (if alternatives exist)', () => {
    const hand = [
      c(Suit.Diamonds, Rank.King),
      c(Suit.Hearts, Rank.Queen),
      c(Suit.Spades, Rank.Queen),
    ];
    const trick = [tc(0, Suit.Clubs, Rank.Two)];
    const legal = getLegalPlays(hand, trick, false, true);
    expect(legal).toHaveLength(1);
    expect(legal[0].suit).toBe(Suit.Diamonds);
  });

  it('can play penalty cards on first trick when only penalty cards remain', () => {
    const hand = [
      c(Suit.Hearts, Rank.Queen),
      c(Suit.Spades, Rank.Queen),
      c(Suit.Hearts, Rank.Ace),
    ];
    const trick = [tc(0, Suit.Clubs, Rank.Two)];
    const legal = getLegalPlays(hand, trick, false, true);
    expect(legal).toHaveLength(3);
  });
});

describe('trickWinner', () => {
  it('highest card of lead suit wins', () => {
    const trick: TrickCard[] = [
      tc(0, Suit.Clubs, Rank.Two),
      tc(1, Suit.Clubs, Rank.King),
      tc(2, Suit.Clubs, Rank.Ace),
      tc(3, Suit.Clubs, Rank.Ten),
    ];
    expect(trickWinner(trick)).toBe(2);
  });

  it('off-suit cards do not win', () => {
    const trick: TrickCard[] = [
      tc(0, Suit.Clubs, Rank.Two),
      tc(1, Suit.Hearts, Rank.Ace),
      tc(2, Suit.Spades, Rank.Ace),
      tc(3, Suit.Clubs, Rank.Three),
    ];
    expect(trickWinner(trick)).toBe(3);
  });

  it('leader wins if no higher card of lead suit', () => {
    const trick: TrickCard[] = [
      tc(0, Suit.Diamonds, Rank.Ace),
      tc(1, Suit.Hearts, Rank.Ace),
      tc(2, Suit.Spades, Rank.Ace),
      tc(3, Suit.Clubs, Rank.Ace),
    ];
    expect(trickWinner(trick)).toBe(0);
  });
});

describe('trickPoints', () => {
  it('counts hearts as 1 point each', () => {
    const trick: TrickCard[] = [
      tc(0, Suit.Hearts, Rank.Two),
      tc(1, Suit.Hearts, Rank.Three),
      tc(2, Suit.Clubs, Rank.Ace),
      tc(3, Suit.Diamonds, Rank.King),
    ];
    expect(trickPoints(trick)).toBe(2);
  });

  it('counts queen of spades as 13', () => {
    const trick: TrickCard[] = [
      tc(0, Suit.Spades, Rank.Queen),
      tc(1, Suit.Clubs, Rank.Ace),
      tc(2, Suit.Clubs, Rank.King),
      tc(3, Suit.Clubs, Rank.Two),
    ];
    expect(trickPoints(trick)).toBe(13);
  });

  it('counts hearts + queen of spades together', () => {
    const trick: TrickCard[] = [
      tc(0, Suit.Spades, Rank.Queen),
      tc(1, Suit.Hearts, Rank.Ace),
      tc(2, Suit.Hearts, Rank.King),
      tc(3, Suit.Clubs, Rank.Two),
    ];
    expect(trickPoints(trick)).toBe(15);
  });

  it('returns 0 for no penalty cards', () => {
    const trick: TrickCard[] = [
      tc(0, Suit.Clubs, Rank.Two),
      tc(1, Suit.Diamonds, Rank.Three),
      tc(2, Suit.Spades, Rank.Four),
      tc(3, Suit.Clubs, Rank.Five),
    ];
    expect(trickPoints(trick)).toBe(0);
  });
});
