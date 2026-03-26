export enum Suit {
  Clubs = 'C',
  Diamonds = 'D',
  Spades = 'S',
  Hearts = 'H',
}

export enum Rank {
  Two = 2,
  Three = 3,
  Four = 4,
  Five = 5,
  Six = 6,
  Seven = 7,
  Eight = 8,
  Nine = 9,
  Ten = 10,
  Jack = 11,
  Queen = 12,
  King = 13,
  Ace = 14,
}

export interface Card {
  suit: Suit;
  rank: Rank;
}

export type PlayerIndex = 0 | 1 | 2 | 3;
export type PassDirection = 'left' | 'right' | 'across' | 'none';

export enum GamePhase {
  Passing = 'passing',
  Playing = 'playing',
  RoundComplete = 'round_complete',
  GameOver = 'game_over',
}

export interface TrickCard {
  player: PlayerIndex;
  card: Card;
}

export interface CompletedTrick {
  leader: PlayerIndex;
  cards: TrickCard[];
  winner: PlayerIndex;
}

export interface PlayerState {
  hand: Card[];
  tricksTaken: CompletedTrick[];
  score: number;
  isAgent: boolean;
  passedCards: Card[] | null; // cards selected for passing, null if not yet passed
  receivedCards: Card[] | null;
}

export interface GameState {
  id: string;
  phase: GamePhase;
  round: number;
  passDirection: PassDirection;
  players: [PlayerState, PlayerState, PlayerState, PlayerState];
  currentTrick: TrickCard[];
  leadPlayer: PlayerIndex;
  currentPlayer: PlayerIndex;
  heartsBroken: boolean;
  trickNumber: number;
  completedTricks: CompletedTrick[];
  roundScoreHistory: number[][];
}

export const RANK_NAMES: Record<number, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
  10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A',
};

export const RANK_FROM_NAME: Record<string, Rank> = {
  '2': Rank.Two, '3': Rank.Three, '4': Rank.Four, '5': Rank.Five,
  '6': Rank.Six, '7': Rank.Seven, '8': Rank.Eight, '9': Rank.Nine,
  '10': Rank.Ten, 'J': Rank.Jack, 'Q': Rank.Queen, 'K': Rank.King, 'A': Rank.Ace,
};

const SUIT_SYMBOLS: Record<Suit, string> = {
  [Suit.Clubs]: '♣',
  [Suit.Diamonds]: '♦',
  [Suit.Spades]: '♠',
  [Suit.Hearts]: '♥',
};

const SUIT_FROM_SYMBOL: Record<string, Suit> = {
  '♣': Suit.Clubs,
  '♦': Suit.Diamonds,
  '♠': Suit.Spades,
  '♥': Suit.Hearts,
};

const SUIT_FROM_LETTER: Record<string, Suit> = {
  'C': Suit.Clubs,
  'D': Suit.Diamonds,
  'S': Suit.Spades,
  'H': Suit.Hearts,
};

export function cardToString(card: Card): string {
  return `${SUIT_SYMBOLS[card.suit]}${RANK_NAMES[card.rank]}`;
}

export function cardFromString(s: string): Card {
  // Try unicode symbol prefix (e.g. ♠Q, ♣2)
  const symbolSuit = SUIT_FROM_SYMBOL[s[0]];
  if (symbolSuit) {
    const rankStr = s.slice(1).toUpperCase();
    const rank = RANK_FROM_NAME[rankStr];
    if (rank === undefined) {
      throw new Error(`Invalid rank in card string: ${s}`);
    }
    return { suit: symbolSuit, rank };
  }

  // Try letter prefix (e.g. sQ, S10, hA)
  const prefixSuit = SUIT_FROM_LETTER[s[0].toUpperCase()];
  if (prefixSuit) {
    const rankStr = s.slice(1).toUpperCase();
    const rank = RANK_FROM_NAME[rankStr];
    if (rank !== undefined) {
      return { suit: prefixSuit, rank };
    }
  }

  // Try letter suffix (e.g. QS, 2C, 10H)
  const suffixSuit = SUIT_FROM_LETTER[s[s.length - 1].toUpperCase()];
  if (suffixSuit) {
    const rankStr = s.slice(0, -1).toUpperCase();
    const rank = RANK_FROM_NAME[rankStr];
    if (rank !== undefined) {
      return { suit: suffixSuit, rank };
    }
  }

  throw new Error(`Invalid card string: ${s}. Use format like ♠Q, SQ, QS, sQ, 2C, 10H`);
}

export function cardsEqual(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}

export function sortHand(hand: Card[]): Card[] {
  const suitOrder = [Suit.Clubs, Suit.Diamonds, Suit.Spades, Suit.Hearts];
  return [...hand].sort((a, b) => {
    const si = suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
    if (si !== 0) return si;
    return a.rank - b.rank;
  });
}
