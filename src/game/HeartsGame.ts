import {
  Card, Suit, Rank, PlayerIndex, PassDirection, GamePhase,
  TrickCard, CompletedTrick, PlayerState, GameState,
  cardsEqual, cardToString, sortHand,
} from '../types.js';
import { deal } from './Deck.js';
import {
  getPassDirection, getPassTarget, findTwoOfClubsHolder,
  validatePass, getLegalPlays, trickWinner, trickPoints,
} from './Rules.js';
import { scoreRound, isGameOver, getWinner, penaltyPointsByPlayer, moonThreat } from './Scorer.js';
import { aiChoosePass, aiChoosePlay } from '../ai/AiPlayer.js';

export class HeartsGame {
  state: GameState;

  constructor(id: string, agentSeat: PlayerIndex = 0) {
    const hands = deal();
    const passDir = getPassDirection(0);

    const players: [PlayerState, PlayerState, PlayerState, PlayerState] = [
      { hand: sortHand(hands[0]), tricksTaken: [], score: 0, isAgent: false, passedCards: null, receivedCards: null },
      { hand: sortHand(hands[1]), tricksTaken: [], score: 0, isAgent: false, passedCards: null, receivedCards: null },
      { hand: sortHand(hands[2]), tricksTaken: [], score: 0, isAgent: false, passedCards: null, receivedCards: null },
      { hand: sortHand(hands[3]), tricksTaken: [], score: 0, isAgent: false, passedCards: null, receivedCards: null },
    ];
    players[agentSeat].isAgent = true;

    const leader = findTwoOfClubsHolder(hands);

    this.state = {
      id,
      phase: passDir === 'none' ? GamePhase.Playing : GamePhase.Passing,
      round: 0,
      passDirection: passDir,
      players,
      currentTrick: [],
      leadPlayer: leader,
      currentPlayer: leader,
      heartsBroken: false,
      trickNumber: 0,
      completedTricks: [],
      roundScoreHistory: [],
    };
  }

  getAgentSeat(): PlayerIndex {
    return this.state.players.findIndex(p => p.isAgent) as PlayerIndex;
  }

  submitPass(player: PlayerIndex, cards: Card[]): { error?: string; receivedCards?: Card[] } {
    if (this.state.phase !== GamePhase.Passing) {
      return { error: 'Not in passing phase' };
    }
    if (this.state.passDirection === 'none') {
      return { error: 'No passing this round' };
    }

    const pState = this.state.players[player];
    if (pState.passedCards) {
      return { error: 'Already passed cards' };
    }

    const err = validatePass(cards, pState.hand);
    if (err) return { error: err };

    pState.passedCards = cards;

    // Auto-pass for AI players
    for (let i = 0; i < 4; i++) {
      const p = this.state.players[i];
      if (!p.isAgent && !p.passedCards) {
        p.passedCards = aiChoosePass(p.hand);
      }
    }

    // Check if all players have passed
    if (this.state.players.every(p => p.passedCards)) {
      this.executePassing();
      return { receivedCards: pState.receivedCards! };
    }

    return {};
  }

  private executePassing(): void {
    const dir = this.state.passDirection;
    // Collect cards to pass
    const passing: Card[][] = [[], [], [], []];
    for (let i = 0; i < 4; i++) {
      passing[i] = this.state.players[i].passedCards!;
    }

    // Remove passed cards and add received cards
    for (let i = 0; i < 4; i++) {
      const pi = i as PlayerIndex;
      const target = getPassTarget(pi, dir);
      const p = this.state.players[pi];

      // Remove passed cards
      p.hand = p.hand.filter(c => !passing[i].some(pc => cardsEqual(pc, c)));

      // The cards coming TO player i are from whichever player passes TO i
      // If direction is 'left', player 0 passes to 1, so player 1 receives from 0
      // We need: who passes to player i?
    }

    // Better approach: compute received cards
    const received: Card[][] = [[], [], [], []];
    for (let i = 0; i < 4; i++) {
      const target = getPassTarget(i as PlayerIndex, dir);
      received[target] = passing[i];
    }

    for (let i = 0; i < 4; i++) {
      const p = this.state.players[i];
      // Remove passed cards from hand
      p.hand = p.hand.filter(c => !passing[i].some(pc => cardsEqual(pc, c)));
      // Add received cards
      p.hand.push(...received[i]);
      p.hand = sortHand(p.hand);
      p.receivedCards = received[i];
    }

    // Find who has 2 of clubs
    const leader = findTwoOfClubsHolder(this.state.players.map(p => p.hand));
    this.state.leadPlayer = leader;
    this.state.currentPlayer = leader;
    this.state.phase = GamePhase.Playing;
  }

  playCard(player: PlayerIndex, card: Card): {
    error?: string;
    trickComplete?: boolean;
    trickWinner?: PlayerIndex;
    trickCards?: TrickCard[];
    roundComplete?: boolean;
    roundScores?: number[];
    shotTheMoon?: PlayerIndex | null;
    gameOver?: boolean;
    winner?: PlayerIndex;
    scores?: number[];
  } {
    if (this.state.phase !== GamePhase.Playing) {
      return { error: `Not in playing phase (current: ${this.state.phase})` };
    }
    if (this.state.currentPlayer !== player) {
      return { error: `Not player ${player}'s turn (current: ${this.state.currentPlayer})` };
    }

    const pState = this.state.players[player];
    const isFirstTrick = this.state.trickNumber === 0;
    const legal = getLegalPlays(pState.hand, this.state.currentTrick, this.state.heartsBroken, isFirstTrick);

    if (!legal.some(c => cardsEqual(c, card))) {
      return { error: `Illegal play: ${cardToString(card)}. Legal: ${legal.map(cardToString).join(', ')}` };
    }

    // Play the card
    pState.hand = pState.hand.filter(c => !cardsEqual(c, card));
    this.state.currentTrick.push({ player, card });

    // Check if hearts broken
    if (card.suit === Suit.Hearts) {
      this.state.heartsBroken = true;
    }

    // Trick not complete yet
    if (this.state.currentTrick.length < 4) {
      this.state.currentPlayer = ((this.state.currentPlayer + 1) % 4) as PlayerIndex;
      return {};
    }

    // Trick complete
    return this.completeTrick();
  }

  private completeTrick(): {
    trickComplete: boolean;
    trickWinner: PlayerIndex;
    trickCards: TrickCard[];
    roundComplete?: boolean;
    roundScores?: number[];
    shotTheMoon?: PlayerIndex | null;
    gameOver?: boolean;
    winner?: PlayerIndex;
    scores?: number[];
  } {
    const winner = trickWinner(this.state.currentTrick);
    const completed: CompletedTrick = {
      leader: this.state.leadPlayer,
      cards: [...this.state.currentTrick],
      winner,
    };

    this.state.completedTricks.push(completed);
    this.state.players[winner].tricksTaken.push(completed);
    const trickCards = [...this.state.currentTrick];

    this.state.currentTrick = [];
    this.state.trickNumber++;
    this.state.leadPlayer = winner;
    this.state.currentPlayer = winner;

    const result: any = {
      trickComplete: true,
      trickWinner: winner,
      trickCards,
    };

    // Check if round is complete (13 tricks)
    if (this.state.trickNumber === 13) {
      return { ...result, ...this.completeRound() };
    }

    return result;
  }

  private completeRound(): {
    roundComplete: boolean;
    roundScores: number[];
    shotTheMoon: PlayerIndex | null;
    gameOver?: boolean;
    winner?: PlayerIndex;
    scores?: number[];
  } {
    const tricksByPlayer = this.state.players.map(p => p.tricksTaken);
    const result = scoreRound(tricksByPlayer);
    const roundScores = result.scores;
    const shotTheMoon = result.shotTheMoon;

    // Add to cumulative scores
    for (let i = 0; i < 4; i++) {
      this.state.players[i].score += roundScores[i];
    }
    this.state.roundScoreHistory.push(roundScores);

    const cumScores = this.state.players.map(p => p.score);

    if (isGameOver(cumScores)) {
      this.state.phase = GamePhase.GameOver;
      return {
        roundComplete: true,
        roundScores,
        shotTheMoon,
        gameOver: true,
        winner: getWinner(cumScores),
        scores: cumScores,
      };
    }

    // Start new round
    this.startNewRound();
    return { roundComplete: true, roundScores, shotTheMoon };
  }

  private startNewRound(): void {
    this.state.round++;
    const hands = deal();
    const passDir = getPassDirection(this.state.round);
    this.state.passDirection = passDir;

    for (let i = 0; i < 4; i++) {
      this.state.players[i].hand = sortHand(hands[i]);
      this.state.players[i].tricksTaken = [];
      this.state.players[i].passedCards = null;
      this.state.players[i].receivedCards = null;
    }

    this.state.currentTrick = [];
    this.state.completedTricks = [];
    this.state.heartsBroken = false;
    this.state.trickNumber = 0;

    if (passDir === 'none') {
      const leader = findTwoOfClubsHolder(hands);
      this.state.leadPlayer = leader;
      this.state.currentPlayer = leader;
      this.state.phase = GamePhase.Playing;
    } else {
      this.state.phase = GamePhase.Passing;
    }
  }

  /** Auto-play AI turns until it's the agent's turn or the game ends. Returns events. */
  autoPlayAI(): {
    plays: { player: PlayerIndex; card: string }[];
    tricks: { winner: PlayerIndex; cards: string[]; points: number }[];
    roundComplete?: boolean;
    roundScores?: number[];
    shotTheMoon?: PlayerIndex | null;
    gameOver?: boolean;
    winner?: PlayerIndex;
    scores?: number[];
  } {
    const agentSeat = this.getAgentSeat();
    const plays: { player: PlayerIndex; card: string }[] = [];
    const tricks: { winner: PlayerIndex; cards: string[]; points: number }[] = [];
    let lastRoundResult: any = {};

    while (
      this.state.phase as string === GamePhase.Playing &&
      this.state.currentPlayer !== agentSeat
    ) {
      const player = this.state.currentPlayer;
      const pState = this.state.players[player];
      const isFirstTrick = this.state.trickNumber === 0;
      const card = aiChoosePlay(
        player,
        pState.hand,
        this.state.currentTrick,
        this.state.heartsBroken,
        isFirstTrick,
        this.state.completedTricks,
      );

      plays.push({ player, card: cardToString(card) });
      const result = this.playCard(player, card);

      if (result.error) {
        throw new Error(`AI error: ${result.error}`);
      }

      if (result.trickComplete) {
        tricks.push({
          winner: result.trickWinner!,
          cards: result.trickCards!.map(tc => `P${tc.player}:${cardToString(tc.card)}`),
          points: trickPoints(result.trickCards!),
        });
      }

      if (result.roundComplete) {
        lastRoundResult = {
          roundComplete: true,
          roundScores: result.roundScores,
          shotTheMoon: result.shotTheMoon,
          gameOver: result.gameOver,
          winner: result.winner,
          scores: result.scores,
        };
        // If new round started and it's passing phase, stop
        if ((this.state.phase as string) === GamePhase.Passing) break;
        if ((this.state.phase as string) === GamePhase.GameOver) break;
      }
    }

    return { plays, tricks, ...lastRoundResult };
  }

  getVisibleState(player: PlayerIndex) {
    const p = this.state.players[player];
    return {
      gameId: this.state.id,
      phase: this.state.phase,
      round: this.state.round,
      passDirection: this.state.passDirection,
      hand: sortHand(p.hand).map(cardToString),
      handSize: p.hand.length,
      currentTrick: this.state.currentTrick.map(tc => ({
        player: tc.player,
        card: cardToString(tc.card),
      })),
      currentPlayer: this.state.currentPlayer,
      isYourTurn: this.state.currentPlayer === player,
      trickNumber: this.state.trickNumber,
      heartsBroken: this.state.heartsBroken,
      scores: this.state.players.map(pl => pl.score),
      penaltyThisRound: penaltyPointsByPlayer(this.state.completedTricks),
      moonThreat: moonThreat(this.state.completedTricks),
      tricksTakenCount: this.state.players.map(pl => pl.tricksTaken.length),
      legalPlays: this.state.phase === GamePhase.Playing && this.state.currentPlayer === player
        ? getLegalPlays(p.hand, this.state.currentTrick, this.state.heartsBroken, this.state.trickNumber === 0).map(cardToString)
        : [],
      cardsPlayedThisRound: this.state.completedTricks.flatMap(t =>
        t.cards.map(tc => ({ player: tc.player, card: cardToString(tc.card) }))
      ),
    };
  }

  getTrickHistory() {
    return this.state.completedTricks.map(t => ({
      leader: t.leader,
      cards: t.cards.map(tc => ({ player: tc.player, card: cardToString(tc.card) })),
      winner: t.winner,
      points: trickPoints(t.cards),
    }));
  }
}
