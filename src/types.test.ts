import { describe, it, expect } from 'vitest';
import { Suit, Rank, cardFromString, cardToString, cardsEqual, sortHand, Card } from './types.js';

describe('cardToString', () => {
  it('converts cards to unicode format', () => {
    expect(cardToString({ suit: Suit.Spades, rank: Rank.Queen })).toBe('♠Q');
    expect(cardToString({ suit: Suit.Hearts, rank: Rank.Ace })).toBe('♥A');
    expect(cardToString({ suit: Suit.Clubs, rank: Rank.Two })).toBe('♣2');
    expect(cardToString({ suit: Suit.Diamonds, rank: Rank.Ten })).toBe('♦10');
    expect(cardToString({ suit: Suit.Hearts, rank: Rank.King })).toBe('♥K');
    expect(cardToString({ suit: Suit.Clubs, rank: Rank.Jack })).toBe('♣J');
  });
});

describe('cardFromString', () => {
  it('parses unicode symbol prefix format', () => {
    expect(cardFromString('♠Q')).toEqual({ suit: Suit.Spades, rank: Rank.Queen });
    expect(cardFromString('♥A')).toEqual({ suit: Suit.Hearts, rank: Rank.Ace });
    expect(cardFromString('♣2')).toEqual({ suit: Suit.Clubs, rank: Rank.Two });
    expect(cardFromString('♦10')).toEqual({ suit: Suit.Diamonds, rank: Rank.Ten });
  });

  it('parses letter prefix format', () => {
    expect(cardFromString('SQ')).toEqual({ suit: Suit.Spades, rank: Rank.Queen });
    expect(cardFromString('HA')).toEqual({ suit: Suit.Hearts, rank: Rank.Ace });
    expect(cardFromString('C2')).toEqual({ suit: Suit.Clubs, rank: Rank.Two });
    expect(cardFromString('D10')).toEqual({ suit: Suit.Diamonds, rank: Rank.Ten });
  });

  it('parses letter suffix format', () => {
    expect(cardFromString('QS')).toEqual({ suit: Suit.Spades, rank: Rank.Queen });
    expect(cardFromString('AH')).toEqual({ suit: Suit.Hearts, rank: Rank.Ace });
    expect(cardFromString('2C')).toEqual({ suit: Suit.Clubs, rank: Rank.Two });
    expect(cardFromString('10H')).toEqual({ suit: Suit.Hearts, rank: Rank.Ten });
  });

  it('is case-insensitive for letter formats', () => {
    expect(cardFromString('sq')).toEqual({ suit: Suit.Spades, rank: Rank.Queen });
    expect(cardFromString('Sq')).toEqual({ suit: Suit.Spades, rank: Rank.Queen });
    expect(cardFromString('sQ')).toEqual({ suit: Suit.Spades, rank: Rank.Queen });
    expect(cardFromString('qs')).toEqual({ suit: Suit.Spades, rank: Rank.Queen });
    expect(cardFromString('ha')).toEqual({ suit: Suit.Hearts, rank: Rank.Ace });
  });

  it('throws on invalid input', () => {
    expect(() => cardFromString('XQ')).toThrow();
    expect(() => cardFromString('')).toThrow();
    expect(() => cardFromString('♠X')).toThrow();
    expect(() => cardFromString('ZZ')).toThrow();
  });

  it('roundtrips through cardToString', () => {
    const cards = ['♠Q', '♥A', '♣2', '♦10', '♥K', '♣J'];
    for (const s of cards) {
      expect(cardToString(cardFromString(s))).toBe(s);
    }
  });
});

describe('cardsEqual', () => {
  it('returns true for identical cards', () => {
    expect(cardsEqual({ suit: Suit.Spades, rank: Rank.Queen }, { suit: Suit.Spades, rank: Rank.Queen })).toBe(true);
  });

  it('returns false for different cards', () => {
    expect(cardsEqual({ suit: Suit.Spades, rank: Rank.Queen }, { suit: Suit.Hearts, rank: Rank.Queen })).toBe(false);
    expect(cardsEqual({ suit: Suit.Spades, rank: Rank.Queen }, { suit: Suit.Spades, rank: Rank.King })).toBe(false);
  });
});

describe('sortHand', () => {
  it('sorts by suit then rank', () => {
    const hand: Card[] = [
      { suit: Suit.Hearts, rank: Rank.Ace },
      { suit: Suit.Clubs, rank: Rank.Three },
      { suit: Suit.Spades, rank: Rank.Ten },
      { suit: Suit.Clubs, rank: Rank.Ace },
      { suit: Suit.Diamonds, rank: Rank.Five },
    ];
    const sorted = sortHand(hand);
    expect(sorted.map(cardToString)).toEqual(['♣3', '♣A', '♦5', '♠10', '♥A']);
  });

  it('does not mutate the original', () => {
    const hand: Card[] = [
      { suit: Suit.Hearts, rank: Rank.Ace },
      { suit: Suit.Clubs, rank: Rank.Two },
    ];
    sortHand(hand);
    expect(hand[0].suit).toBe(Suit.Hearts);
  });
});
