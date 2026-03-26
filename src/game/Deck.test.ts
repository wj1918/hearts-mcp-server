import { describe, it, expect } from 'vitest';
import { createDeck, shuffle, deal } from './Deck.js';
import { Suit, Rank, cardsEqual } from '../types.js';

describe('createDeck', () => {
  it('creates 52 cards', () => {
    expect(createDeck()).toHaveLength(52);
  });

  it('has 13 cards per suit', () => {
    const deck = createDeck();
    for (const suit of [Suit.Clubs, Suit.Diamonds, Suit.Spades, Suit.Hearts]) {
      expect(deck.filter(c => c.suit === suit)).toHaveLength(13);
    }
  });

  it('has 4 cards per rank', () => {
    const deck = createDeck();
    for (let rank = Rank.Two; rank <= Rank.Ace; rank++) {
      expect(deck.filter(c => c.rank === rank)).toHaveLength(4);
    }
  });

  it('has no duplicate cards', () => {
    const deck = createDeck();
    for (let i = 0; i < deck.length; i++) {
      for (let j = i + 1; j < deck.length; j++) {
        expect(cardsEqual(deck[i], deck[j])).toBe(false);
      }
    }
  });
});

describe('shuffle', () => {
  it('returns same length array', () => {
    const arr = [1, 2, 3, 4, 5];
    expect(shuffle(arr)).toHaveLength(5);
  });

  it('contains same elements', () => {
    const arr = [1, 2, 3, 4, 5];
    expect(shuffle(arr).sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('does not mutate the original', () => {
    const arr = [1, 2, 3, 4, 5];
    shuffle(arr);
    expect(arr).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('deal', () => {
  it('returns 4 hands of 13 cards each', () => {
    const hands = deal();
    expect(hands).toHaveLength(4);
    for (const hand of hands) {
      expect(hand).toHaveLength(13);
    }
  });

  it('uses all 52 cards with no duplicates', () => {
    const hands = deal();
    const all = hands.flat();
    expect(all).toHaveLength(52);
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        expect(cardsEqual(all[i], all[j])).toBe(false);
      }
    }
  });

  it('always includes the two of clubs', () => {
    const hands = deal();
    const all = hands.flat();
    const twoOfClubs = all.find(c => c.suit === Suit.Clubs && c.rank === Rank.Two);
    expect(twoOfClubs).toBeDefined();
  });
});
