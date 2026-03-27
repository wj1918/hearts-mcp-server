import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

describe('MCP Server Integration', () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    transport = new StdioClientTransport({
      command: 'npx',
      args: ['tsx', 'src/index.ts'],
    });
    client = new Client({ name: 'test-client', version: '1.0.0' });
    await client.connect(transport);
  });

  afterAll(async () => {
    await client.close();
  });

  it('should initialize and list all 8 tools', async () => {
    const { tools } = await client.listTools();
    const names = tools.map(t => t.name).sort();
    expect(names).toEqual([
      'create_game',
      'get_game_state',
      'get_legal_plays',
      'get_scores',
      'get_trick_history',
      'list_games',
      'pass_cards',
      'play_card',
    ]);
  });

  it('should create a game and return valid state', async () => {
    const result = await client.callTool({ name: 'create_game', arguments: {} });
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content).toHaveLength(1);
    expect(content[0].type).toBe('text');

    const data = JSON.parse(content[0].text);
    expect(data.gameId).toBeTypeOf('string');
    expect(data.agentSeat).toBe(2);
    expect(data.hand).toBeInstanceOf(Array);
    expect(data.hand).toHaveLength(13);
    expect(data.round).toBe(0);
    expect(data.scores).toEqual([0, 0, 0, 0]);
  });

  it('should list games after creating one', async () => {
    const result = await client.callTool({ name: 'list_games', arguments: {} });
    const data = JSON.parse((result.content as any)[0].text);
    expect(data.games.length).toBeGreaterThanOrEqual(1);
    expect(data.games[0]).toHaveProperty('id');
    expect(data.games[0]).toHaveProperty('phase');
    expect(data.games[0]).toHaveProperty('round');
  });

  it('should get game state for a valid game', async () => {
    // Create a fresh game
    const createResult = await client.callTool({ name: 'create_game', arguments: {} });
    const { gameId } = JSON.parse((createResult.content as any)[0].text);

    const stateResult = await client.callTool({
      name: 'get_game_state',
      arguments: { gameId },
    });
    const state = JSON.parse((stateResult.content as any)[0].text);
    expect(state.hand).toHaveLength(13);
    expect(state.scores).toEqual([0, 0, 0, 0]);
    expect(state.heartsBroken).toBe(false);
  });

  it('should return error for invalid game ID', async () => {
    const result = await client.callTool({
      name: 'get_game_state',
      arguments: { gameId: 'nonexistent' },
    });
    expect(result.isError).toBe(true);
    const data = JSON.parse((result.content as any)[0].text);
    expect(data.error).toBe('Game not found');
  });

  it('should get scores for a game', async () => {
    const createResult = await client.callTool({ name: 'create_game', arguments: {} });
    const { gameId } = JSON.parse((createResult.content as any)[0].text);

    const scoresResult = await client.callTool({
      name: 'get_scores',
      arguments: { gameId },
    });
    const data = JSON.parse((scoresResult.content as any)[0].text);
    expect(data.scores).toHaveLength(4);
    expect(data.scores[2].isAgent).toBe(true);
    expect(data.roundHistory).toEqual([]);
  });

  it('should handle pass_cards in a passing round', async () => {
    const createResult = await client.callTool({ name: 'create_game', arguments: {} });
    const createData = JSON.parse((createResult.content as any)[0].text);
    const { gameId, hand, phase } = createData;

    if (phase !== 'Passing') {
      // Round 4 is a no-pass round — skip
      return;
    }

    // Pass the first 3 cards from our hand
    const cardsToPass = hand.slice(0, 3);
    const passResult = await client.callTool({
      name: 'pass_cards',
      arguments: { gameId, cards: cardsToPass },
    });
    const passData = JSON.parse((passResult.content as any)[0].text);
    expect(passData.success).toBe(true);
    expect(passData.receivedCards).toHaveLength(3);
    expect(passData.hand).toHaveLength(13); // still 13 after swap
  });

  it('should play a full passing + first trick cycle', async () => {
    const createResult = await client.callTool({ name: 'create_game', arguments: {} });
    const createData = JSON.parse((createResult.content as any)[0].text);
    let { gameId, hand, phase } = createData;

    // Handle passing phase if needed
    if (phase === 'Passing') {
      const cardsToPass = hand.slice(0, 3);
      const passResult = await client.callTool({
        name: 'pass_cards',
        arguments: { gameId, cards: cardsToPass },
      });
      const passData = JSON.parse((passResult.content as any)[0].text);
      hand = passData.hand;
    }

    // Get legal plays
    const legalResult = await client.callTool({
      name: 'get_legal_plays',
      arguments: { gameId },
    });
    const legalData = JSON.parse((legalResult.content as any)[0].text);

    if (!legalData.isYourTurn || legalData.legalPlays.length === 0) {
      // AI may have already played or game moved past — that's ok
      return;
    }

    // Play the first legal card
    const cardToPlay = legalData.legalPlays[0];
    const playResult = await client.callTool({
      name: 'play_card',
      arguments: { gameId, card: cardToPlay },
    });
    const playData = JSON.parse((playResult.content as any)[0].text);
    expect(playData.success).toBe(true);
  });

  it('should return trick history', async () => {
    const createResult = await client.callTool({ name: 'create_game', arguments: {} });
    const { gameId } = JSON.parse((createResult.content as any)[0].text);

    const historyResult = await client.callTool({
      name: 'get_trick_history',
      arguments: { gameId },
    });
    const data = JSON.parse((historyResult.content as any)[0].text);
    expect(data.tricks).toBeInstanceOf(Array);
  });

  it('should reject playing an invalid card format', async () => {
    const createResult = await client.callTool({ name: 'create_game', arguments: {} });
    const createData = JSON.parse((createResult.content as any)[0].text);
    const { gameId, phase } = createData;

    // Get past passing phase first
    if (phase === 'Passing') {
      const hand = createData.hand;
      await client.callTool({
        name: 'pass_cards',
        arguments: { gameId, cards: hand.slice(0, 3) },
      });
    }

    const result = await client.callTool({
      name: 'play_card',
      arguments: { gameId, card: 'INVALID' },
    });
    expect(result.isError).toBe(true);
  });
});
