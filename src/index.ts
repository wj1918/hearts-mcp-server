#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { GameManager } from './manager/GameManager.js';
import { registerTools } from './tools/register.js';

const server = new McpServer(
  {
    name: 'hearts-game',
    version: '1.0.0',
  },
  {
    instructions: `Hearts Card Game MCP Server - Play Hearts against 3 AI opponents.

## How to Play
1. Call "create_game" to start a new game. You'll receive your hand and game state.
2. If it's a passing round, call "pass_cards" with 3 cards to pass.
3. On your turn, call "play_card" with a legal card. AI opponents auto-play after you.
4. Use "get_game_state" to see the current state at any time.
5. Use "get_trick_history" to review played cards for strategy.

## Card Format
Two input formats: Unicode symbols ("♣2", "♠Q", "♥10") or letter codes ("2C", "QS", "10H"). Case-insensitive.
Ranks: 2,3,4,5,6,7,8,9,10,J,Q,K,A. Suits: C(Clubs), D(Diamonds), S(Spades), H(Hearts).
When the user gives just a rank (e.g. "Q", "3", "10"), infer the suit from the current legal plays.

## Hearts Rules
- 4 players, 13 cards each. Goal: score the FEWEST points.
- Each Heart = 1 point, Queen of Spades = 13 points.
- Pass 3 cards each round (left, right, across, then no-pass, repeating).
- 2 of Clubs leads the first trick. Must follow suit if able.
- Cannot lead Hearts until they are "broken" (played when unable to follow suit).
- First trick: cannot play Hearts or Queen of Spades (unless forced).
- "Shooting the Moon": take ALL 26 penalty points = you get 0, everyone else gets 26.
- Game ends when someone reaches 100 points. Lowest score wins.

## Display Format
After every move, show the table and trick state using this layout:

### Table (show on every turn)
\`\`\`
              North (AI)
              [card or —]

  West (AI)                   East (AI)
  [card or —]                 [card or —]

              South (You)
              [card or —]

         ┌──────────────┐
Trick N  │  N: card     │
         │  E: card     │
         │  S: card     │
         │  W: card     │
         └──────────────┘
\`\`\`
Mark the lead player with "(lead)" and the user's turn with "?". Use "—" for players who haven't played yet and "waiting" for players after the user.

### Trick History (show on every turn)
Show a markdown table of all completed tricks this round:
| Trick | North | East | South (You) | West | Winner | Pts |

### Hand (show on every turn)
Show the user's hand grouped by suit: Clubs | Diamonds | Spades | Hearts

### Scores
Show cumulative scores and penalty points for the current round. Warn if any player is threatening to shoot the moon.

### Strategy
Briefly suggest which card to play and why.

## Strategy Tips
- Avoid taking Hearts and the Queen of Spades.
- Pass dangerous high cards (♠Q, ♠K, ♠A, high Hearts).
- Create voids (empty suits) to dump penalty cards.
- Track which cards have been played to make better decisions.`,
  },
);

const manager = new GameManager();
registerTools(server, manager);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
