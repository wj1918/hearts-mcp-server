import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { GameManager } from '../manager/GameManager.js';
import { PlayerIndex, cardFromString, cardToString, GamePhase } from '../types.js';

export function registerTools(server: McpServer, manager: GameManager): void {
  server.tool(
    'create_game',
    'Create a new Hearts game. You sit South against 3 AI opponents (North, East, West).',
    {},
    async () => {
      const seat = 2 as PlayerIndex;
      const game = manager.createGame(seat);

      // If no passing round, auto-play AI turns before agent's first turn
      const autoResult = game.state.phase === GamePhase.Playing ? game.autoPlayAI() : undefined;

      const visible = game.getVisibleState(seat);
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            agentSeat: seat,
            ...visible,
            ...(autoResult ? { aiPlays: autoResult } : {}),
          }, null, 2),
        }],
      };
    },
  );

  server.tool(
    'get_game_state',
    'Get the current visible game state for your seat, including your hand, current trick, scores, and legal plays.',
    {
      gameId: z.string().describe('The game ID'),
    },
    async ({ gameId }) => {
      const game = manager.getGame(gameId);
      if (!game) return err('Game not found');

      const seat = game.getAgentSeat();
      const visible = game.getVisibleState(seat);
      return ok(visible);
    },
  );

  server.tool(
    'pass_cards',
    'Pass 3 cards during the passing phase. Cards use "♠Q" or "QS" format. Examples: "♠Q"/"QS" (Queen of Spades), "♥A"/"AH" (Ace of Hearts), "♣10"/"10C" (Ten of Clubs).',
    {
      gameId: z.string().describe('The game ID'),
      cards: z.array(z.string()).length(3).describe('3 cards to pass, e.g. ["♠Q", "♥A", "♦K"] or ["QS", "AH", "KD"]'),
    },
    async ({ gameId, cards: cardStrs }) => {
      const game = manager.getGame(gameId);
      if (!game) return err('Game not found');

      const seat = game.getAgentSeat();
      let parsedCards;
      try {
        parsedCards = cardStrs.map(cardFromString);
      } catch (e: any) {
        return err(e.message);
      }

      const result = game.submitPass(seat, parsedCards);
      if (result.error) return err(result.error);

      // Auto-play AI turns after passing is resolved
      const autoResult = game.state.phase === GamePhase.Playing ? game.autoPlayAI() : undefined;

      const visible = game.getVisibleState(seat);
      return ok({
        success: true,
        receivedCards: result.receivedCards?.map(cardToString),
        ...visible,
        ...(autoResult ? { aiPlays: autoResult } : {}),
      });
    },
  );

  server.tool(
    'play_card',
    'Play a card on your turn. After you play, AI opponents auto-play until it is your turn again. Card format: "♠Q" or "QS". Examples: "♣2"/"2C", "♠Q"/"QS", "♥10"/"10H".',
    {
      gameId: z.string().describe('The game ID'),
      card: z.string().describe('Card to play, e.g. "♠Q" or "QS" for Queen of Spades'),
    },
    async ({ gameId, card: cardStr }) => {
      const game = manager.getGame(gameId);
      if (!game) return err('Game not found');

      const seat = game.getAgentSeat();
      let card;
      try {
        card = cardFromString(cardStr);
      } catch (e: any) {
        return err(e.message);
      }

      const result = game.playCard(seat, card);
      if (result.error) return err(result.error);

      // Build response for the agent's play
      const agentPlayResult: any = { success: true };
      if (result.trickComplete) {
        agentPlayResult.trickComplete = true;
        agentPlayResult.trickWinner = result.trickWinner;
        agentPlayResult.trickCards = result.trickCards?.map(tc => ({
          player: tc.player,
          card: cardToString(tc.card),
        }));
      }

      // Auto-play AI turns
      let autoResult;
      if (game.state.phase === GamePhase.Playing) {
        autoResult = game.autoPlayAI();
      }

      // Handle round/game completion from either the agent's play or AI auto-play
      const roundComplete = result.roundComplete || autoResult?.roundComplete;
      const gameOver = result.gameOver || autoResult?.gameOver;
      const shotTheMoon = result.shotTheMoon ?? autoResult?.shotTheMoon ?? null;

      const visible = game.getVisibleState(seat);
      return ok({
        ...agentPlayResult,
        ...(autoResult ? { aiPlays: autoResult } : {}),
        roundComplete,
        ...(roundComplete ? { roundScores: result.roundScores || autoResult?.roundScores } : {}),
        ...(shotTheMoon !== null ? { shotTheMoon: `Player ${shotTheMoon} shot the moon! They get 0, everyone else gets 26.` } : {}),
        gameOver,
        ...(gameOver ? {
          winner: result.winner ?? autoResult?.winner,
          finalScores: result.scores ?? autoResult?.scores,
        } : {}),
        state: visible,
      });
    },
  );

  server.tool(
    'get_legal_plays',
    'Get the list of legal cards you can play right now.',
    {
      gameId: z.string().describe('The game ID'),
    },
    async ({ gameId }) => {
      const game = manager.getGame(gameId);
      if (!game) return err('Game not found');

      const seat = game.getAgentSeat();
      const visible = game.getVisibleState(seat);
      return ok({
        legalPlays: visible.legalPlays,
        isYourTurn: visible.isYourTurn,
        phase: visible.phase,
      });
    },
  );

  server.tool(
    'get_scores',
    'Get cumulative scores and round-by-round breakdown.',
    {
      gameId: z.string().describe('The game ID'),
    },
    async ({ gameId }) => {
      const game = manager.getGame(gameId);
      if (!game) return err('Game not found');

      return ok({
        scores: game.state.players.map((p, i) => ({
          player: i,
          isAgent: p.isAgent,
          score: p.score,
        })),
        roundHistory: game.state.roundScoreHistory,
      });
    },
  );

  server.tool(
    'get_trick_history',
    'Get all completed tricks this round. Useful for card counting strategy.',
    {
      gameId: z.string().describe('The game ID'),
    },
    async ({ gameId }) => {
      const game = manager.getGame(gameId);
      if (!game) return err('Game not found');

      return ok({ tricks: game.getTrickHistory() });
    },
  );

  server.tool(
    'list_games',
    'List all active games.',
    {},
    async () => {
      return ok({ games: manager.listGames() });
    },
  );
}

function ok(data: any) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function err(message: string) {
  return { content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }], isError: true };
}
