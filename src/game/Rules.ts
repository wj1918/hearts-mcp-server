import { Card, Suit, Rank, PlayerIndex, PassDirection, TrickCard, cardsEqual } from '../types.js';

const TWO_OF_CLUBS: Card = { suit: Suit.Clubs, rank: Rank.Two };
const QUEEN_OF_SPADES: Card = { suit: Suit.Spades, rank: Rank.Queen };

export function getPassDirection(round: number): PassDirection {
  const directions: PassDirection[] = ['left', 'right', 'across', 'none'];
  return directions[round % 4];
}

export function getPassTarget(player: PlayerIndex, direction: PassDirection): PlayerIndex {
  switch (direction) {
    case 'left': return ((player + 1) % 4) as PlayerIndex;
    case 'right': return ((player + 3) % 4) as PlayerIndex;
    case 'across': return ((player + 2) % 4) as PlayerIndex;
    case 'none': return player;
  }
}

export function findTwoOfClubsHolder(hands: Card[][]): PlayerIndex {
  for (let i = 0; i < 4; i++) {
    if (hands[i].some(c => cardsEqual(c, TWO_OF_CLUBS))) {
      return i as PlayerIndex;
    }
  }
  throw new Error('Two of clubs not found in any hand');
}

export function validatePass(cards: Card[], hand: Card[]): string | null {
  if (cards.length !== 3) return 'Must pass exactly 3 cards';
  for (const card of cards) {
    if (!hand.some(c => cardsEqual(c, card))) {
      return `Card not in hand`;
    }
  }
  // Check for duplicates
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      if (cardsEqual(cards[i], cards[j])) return 'Duplicate cards in pass';
    }
  }
  return null;
}

export function isPenaltyCard(card: Card): boolean {
  return card.suit === Suit.Hearts || cardsEqual(card, QUEEN_OF_SPADES);
}

export function getLegalPlays(
  hand: Card[],
  currentTrick: TrickCard[],
  heartsBroken: boolean,
  isFirstTrick: boolean,
): Card[] {
  // Must lead 2 of clubs on very first trick
  if (currentTrick.length === 0 && isFirstTrick) {
    if (hand.some(c => cardsEqual(c, TWO_OF_CLUBS))) {
      return [TWO_OF_CLUBS];
    }
  }

  // Leading
  if (currentTrick.length === 0) {
    if (!heartsBroken) {
      const nonHearts = hand.filter(c => c.suit !== Suit.Hearts);
      if (nonHearts.length > 0) return nonHearts;
    }
    return [...hand]; // all hearts or hearts broken
  }

  // Following
  const leadSuit = currentTrick[0].card.suit;
  const suitCards = hand.filter(c => c.suit === leadSuit);

  if (suitCards.length > 0) {
    // Must follow suit
    // On first trick, can't play penalty cards if you have non-penalty cards of the suit
    // Actually the rule is: you CAN play any card of the lead suit
    if (isFirstTrick) {
      // If following suit, you can play any card of that suit
      return suitCards;
    }
    return suitCards;
  }

  // Can't follow suit - can play anything, EXCEPT on first trick no penalty cards (if possible)
  if (isFirstTrick) {
    const nonPenalty = hand.filter(c => !isPenaltyCard(c));
    if (nonPenalty.length > 0) return nonPenalty;
  }

  return [...hand];
}

export function trickWinner(trick: TrickCard[]): PlayerIndex {
  const leadSuit = trick[0].card.suit;
  let winner = trick[0];
  for (let i = 1; i < trick.length; i++) {
    if (trick[i].card.suit === leadSuit && trick[i].card.rank > winner.card.rank) {
      winner = trick[i];
    }
  }
  return winner.player;
}

export function trickPoints(trick: TrickCard[]): number {
  let points = 0;
  for (const tc of trick) {
    if (tc.card.suit === Suit.Hearts) points += 1;
    if (cardsEqual(tc.card, QUEEN_OF_SPADES)) points += 13;
  }
  return points;
}
