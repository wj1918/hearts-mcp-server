import { Card, Suit, Rank } from '../types.js';

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of Object.values(Suit)) {
    for (let rank = Rank.Two; rank <= Rank.Ace; rank++) {
      deck.push({ suit: suit as Suit, rank });
    }
  }
  return deck;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function deal(): [Card[], Card[], Card[], Card[]] {
  const deck = shuffle(createDeck());
  return [
    deck.slice(0, 13),
    deck.slice(13, 26),
    deck.slice(26, 39),
    deck.slice(39, 52),
  ];
}
