import { Card, Suit, Rank, TrickCard, CompletedTrick, cardsEqual, PlayerIndex } from '../types.js';
import { getLegalPlays, isPenaltyCard, trickPoints } from '../game/Rules.js';

const QUEEN_OF_SPADES: Card = { suit: Suit.Spades, rank: Rank.Queen };
const KING_OF_SPADES: Card = { suit: Suit.Spades, rank: Rank.King };
const ACE_OF_SPADES: Card = { suit: Suit.Spades, rank: Rank.Ace };

/** Compute penalty points each player has taken so far this round. */
function penaltyByPlayer(completedTricks: CompletedTrick[]): number[] {
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

/** Check if a player is on track to shoot the moon. */
function moonThreatPlayer(completedTricks: CompletedTrick[]): PlayerIndex | null {
  const pts = penaltyByPlayer(completedTricks);
  const totalPenalty = pts.reduce((a, b) => a + b, 0);
  if (totalPenalty === 0) return null; // no penalty cards taken yet

  // Exactly one player has ALL the penalty points so far
  for (let i = 0; i < 4; i++) {
    if (pts[i] === totalPenalty && totalPenalty >= 3) {
      return i as PlayerIndex;
    }
  }
  return null;
}

/** Should this AI attempt to shoot the moon based on its hand? */
function shouldAttemptMoon(hand: Card[]): boolean {
  const hearts = hand.filter(c => c.suit === Suit.Hearts);
  const highHearts = hearts.filter(c => c.rank >= Rank.Jack).length;
  const hasQS = hand.some(c => cardsEqual(c, QUEEN_OF_SPADES));
  const hasKS = hand.some(c => cardsEqual(c, KING_OF_SPADES));
  const hasAS = hand.some(c => cardsEqual(c, ACE_OF_SPADES));
  const highSpades = (hasQS ? 1 : 0) + (hasKS ? 1 : 0) + (hasAS ? 1 : 0);

  // Need lots of high hearts + high spades + general strength
  const aces = hand.filter(c => c.rank === Rank.Ace).length;
  const kings = hand.filter(c => c.rank === Rank.King).length;

  // Heuristic: need 4+ hearts including 3+ high ones, or massive overall strength
  if (highHearts >= 3 && hearts.length >= 5 && highSpades >= 2) return true;
  if (highHearts >= 4 && hearts.length >= 6) return true;
  if (aces + kings >= 7 && hearts.length >= 4) return true;

  return false;
}

export function aiChoosePass(hand: Card[]): Card[] {
  if (shouldAttemptMoon(hand)) {
    // Keep high cards, pass low ones
    const scored = hand.map(card => ({
      card,
      value: moonPassValue(card, hand),
    }));
    scored.sort((a, b) => a.value - b.value);
    return scored.slice(0, 3).map(s => s.card);
  }

  // Normal strategy: pass dangerous cards
  const scored = hand.map(card => ({
    card,
    danger: cardDanger(card, hand),
  }));
  scored.sort((a, b) => b.danger - a.danger);
  return scored.slice(0, 3).map(s => s.card);
}

function moonPassValue(card: Card, hand: Card[]): number {
  // Higher value = more worth keeping for a moon attempt
  let value = card.rank;
  if (card.suit === Suit.Hearts) value += 20;
  if (cardsEqual(card, QUEEN_OF_SPADES)) value += 30;
  if (cardsEqual(card, KING_OF_SPADES)) value += 25;
  if (cardsEqual(card, ACE_OF_SPADES)) value += 25;
  if (card.rank === Rank.Ace) value += 10;
  if (card.rank === Rank.King) value += 5;
  return value;
}

function cardDanger(card: Card, hand: Card[]): number {
  let danger = 0;

  // Queen of spades is very dangerous
  if (cardsEqual(card, QUEEN_OF_SPADES)) danger += 100;
  if (cardsEqual(card, KING_OF_SPADES)) danger += 80;
  if (cardsEqual(card, ACE_OF_SPADES)) danger += 80;

  // High hearts are dangerous
  if (card.suit === Suit.Hearts) {
    danger += card.rank * 2;
  }

  // High cards in general are somewhat dangerous
  danger += card.rank;

  // Cards from short suits are less dangerous (we want voids)
  const suitCount = hand.filter(c => c.suit === card.suit).length;
  if (suitCount <= 2) danger -= 15;
  if (suitCount === 1) danger -= 10;

  return danger;
}

export function aiChoosePlay(
  aiPlayer: PlayerIndex,
  hand: Card[],
  currentTrick: TrickCard[],
  heartsBroken: boolean,
  isFirstTrick: boolean,
  completedTricks: CompletedTrick[],
): Card {
  const legal = getLegalPlays(hand, currentTrick, heartsBroken, isFirstTrick);
  if (legal.length === 1) return legal[0];

  const threat = moonThreatPlayer(completedTricks);

  // If an opponent is threatening to shoot the moon, block them
  if (threat !== null && threat !== aiPlayer) {
    return chooseBlockMoon(legal, hand, currentTrick, completedTricks, threat);
  }

  // If WE are shooting the moon, play aggressively to win tricks
  if (threat === aiPlayer) {
    return chooseMoonPlay(legal, hand, currentTrick, completedTricks);
  }

  // Check if we should attempt moon based on hand strength (early game)
  if (completedTricks.length <= 2 && shouldAttemptMoon(hand)) {
    return chooseMoonPlay(legal, hand, currentTrick, completedTricks);
  }

  // Normal play
  if (currentTrick.length === 0) {
    return chooseLead(legal, hand, completedTricks, heartsBroken);
  }
  return chooseFollow(legal, hand, currentTrick, isFirstTrick, completedTricks);
}

/** Play aggressively to WIN tricks and collect all penalty cards (shooting the moon). */
function chooseMoonPlay(
  legal: Card[],
  hand: Card[],
  currentTrick: TrickCard[],
  completedTricks: CompletedTrick[],
): Card {
  // Leading: lead highest card to win tricks
  if (currentTrick.length === 0) {
    // Lead high hearts if broken, otherwise lead aces/kings
    const hearts = legal.filter(c => c.suit === Suit.Hearts);
    if (hearts.length > 0 && legal.some(c => c.suit !== Suit.Hearts)) {
      // Lead high non-hearts first to establish control, then sweep hearts
      const nonHearts = legal.filter(c => c.suit !== Suit.Hearts);
      if (nonHearts.length > 0) return highestCard(nonHearts);
    }
    return highestCard(legal);
  }

  // Following: try to win the trick
  const leadSuit = currentTrick[0].card.suit;
  const followingSuit = legal.every(c => c.suit === leadSuit);

  if (followingSuit) {
    // Play highest to win
    return highestCard(legal);
  }

  // Can't follow suit: dump lowest non-penalty to save penalty cards for later winning
  const nonPenalty = legal.filter(c => !isPenaltyCard(c));
  if (nonPenalty.length > 0) return lowestCard(nonPenalty);
  // Only penalty cards: play lowest heart (save high ones for winning heart tricks)
  return lowestCard(legal);
}

/** Block an opponent from shooting the moon by trying to take at least one penalty card. */
function chooseBlockMoon(
  legal: Card[],
  hand: Card[],
  currentTrick: TrickCard[],
  completedTricks: CompletedTrick[],
  threatPlayer: PlayerIndex,
): Card {
  // Leading: lead hearts or spades to force the threat player to lose a penalty trick
  if (currentTrick.length === 0) {
    // Lead a heart — if someone else wins it, moon is blocked
    const hearts = legal.filter(c => c.suit === Suit.Hearts);
    if (hearts.length > 0) return highestCard(hearts);

    // Lead high cards to try to win tricks with penalty cards
    return highestCard(legal);
  }

  const leadSuit = currentTrick[0].card.suit;
  const followingSuit = legal.every(c => c.suit === leadSuit);
  const trickHasPenalty = currentTrick.some(tc => isPenaltyCard(tc.card));

  if (followingSuit) {
    if (trickHasPenalty) {
      // Trick has penalty points — try to WIN it to block the moon
      const highestInTrick = Math.max(
        ...currentTrick.filter(tc => tc.card.suit === leadSuit).map(tc => tc.card.rank)
      );
      const winners = legal.filter(c => c.rank > highestInTrick);
      if (winners.length > 0) return lowestCard(winners); // cheapest winning card
    }
    // No penalty in trick yet — play high to try to win anyway
    return highestCard(legal);
  }

  // Can't follow suit — dump a heart to add penalty to this trick (someone else may win it)
  const hearts = legal.filter(c => c.suit === Suit.Hearts);
  if (hearts.length > 0) return highestCard(hearts);

  // Dump QS if possible
  const qs = legal.find(c => cardsEqual(c, QUEEN_OF_SPADES));
  if (qs) return qs;

  return highestCard(legal);
}

function chooseLead(
  legal: Card[],
  hand: Card[],
  completedTricks: CompletedTrick[],
  heartsBroken: boolean,
): Card {
  const qsPlayed = isCardPlayed(QUEEN_OF_SPADES, completedTricks);

  // If QS not played and we don't have it, lead low spades to flush it
  if (!qsPlayed && !hand.some(c => cardsEqual(c, QUEEN_OF_SPADES))) {
    const lowSpades = legal.filter(c => c.suit === Suit.Spades && c.rank < Rank.Queen);
    if (lowSpades.length > 0) {
      return lowestCard(lowSpades);
    }
  }

  // Lead lowest card from longest non-hearts suit
  const nonHearts = legal.filter(c => c.suit !== Suit.Hearts);
  if (nonHearts.length > 0) {
    const bySuit = groupBySuit(nonHearts);
    let longestSuit: Card[] = [];
    for (const cards of Object.values(bySuit)) {
      if (cards.length > longestSuit.length) longestSuit = cards;
    }
    return lowestCard(longestSuit);
  }

  // Only hearts left
  return lowestCard(legal);
}

function chooseFollow(
  legal: Card[],
  hand: Card[],
  currentTrick: TrickCard[],
  isFirstTrick: boolean,
  completedTricks: CompletedTrick[],
): Card {
  const leadSuit = currentTrick[0].card.suit;
  const followingSuit = legal[0].suit === leadSuit && legal.every(c => c.suit === leadSuit);

  if (!followingSuit) {
    // Can't follow suit — dump dangerous cards
    const qs = legal.find(c => cardsEqual(c, QUEEN_OF_SPADES));
    if (qs) return qs;

    const hearts = legal.filter(c => c.suit === Suit.Hearts);
    if (hearts.length > 0) return highestCard(hearts);

    const highSpades = legal.filter(c => c.suit === Suit.Spades && c.rank > Rank.Queen);
    if (highSpades.length > 0) return highestCard(highSpades);

    return highestCard(legal);
  }

  // Following suit
  const currentPoints = trickPoints(currentTrick);
  const highestInTrick = Math.max(...currentTrick.filter(tc => tc.card.suit === leadSuit).map(tc => tc.card.rank));

  // Last to play
  if (currentTrick.length === 3) {
    if (currentPoints === 0) {
      return highestCard(legal);
    }
    const duckCards = legal.filter(c => c.rank < highestInTrick);
    if (duckCards.length > 0) return highestCard(duckCards);
    return lowestCard(legal);
  }

  // Not last
  if (currentPoints > 0 || leadSuit === Suit.Spades) {
    const duckCards = legal.filter(c => c.rank < highestInTrick);
    if (duckCards.length > 0) return highestCard(duckCards);
    return lowestCard(legal);
  }

  if (legal.length > 1) {
    const sorted = [...legal].sort((a, b) => a.rank - b.rank);
    return sorted[sorted.length - 2];
  }
  return legal[0];
}

function isCardPlayed(card: Card, completedTricks: CompletedTrick[]): boolean {
  for (const trick of completedTricks) {
    for (const tc of trick.cards) {
      if (cardsEqual(tc.card, card)) return true;
    }
  }
  return false;
}

function groupBySuit(cards: Card[]): Record<string, Card[]> {
  const groups: Record<string, Card[]> = {};
  for (const card of cards) {
    if (!groups[card.suit]) groups[card.suit] = [];
    groups[card.suit].push(card);
  }
  return groups;
}

function lowestCard(cards: Card[]): Card {
  return cards.reduce((low, c) => c.rank < low.rank ? c : low, cards[0]);
}

function highestCard(cards: Card[]): Card {
  return cards.reduce((high, c) => c.rank > high.rank ? c : high, cards[0]);
}
