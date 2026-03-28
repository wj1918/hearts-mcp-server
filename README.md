# Hearts MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io/) server that lets you play the classic Hearts game against AI.

## Features

- Full Hearts rules: passing, trick-taking, hearts breaking, Queen of Spades
- Shoot the Moon detection and scoring
- Smart AI opponents with moon shooting/blocking strategies
- Unicode card symbols (♠♥♦♣)
- Mid-round penalty tracking and moon threat alerts
- Card counting via trick history

## Installation

### Claude Code

```bash
# Via npx (recommended)
claude mcp add hearts -- npx -y hearts-mcp-server

# Or global install
npm install -g hearts-mcp-server
claude mcp add hearts -- hearts-mcp-server
```

### From source

```bash
git clone https://github.com/wj1918/hearts-mcp-server.git
cd hearts-mcp-server
npm install
npm run build
npm link
```

Then add to your MCP config:
```bash
claude mcp add hearts -- hearts-mcp-server
```

## Tools

| Tool | Description |
|------|-------------|
| `create_game` | Start a new game. You sit South against 3 AI opponents. |
| `pass_cards` | Pass 3 cards during the passing phase. |
| `play_card` | Play a card on your turn. AI opponents auto-play after you. |
| `get_game_state` | View your hand, current trick, scores, legal plays, and moon threats. |
| `get_legal_plays` | List the cards you can legally play. |
| `get_scores` | Get cumulative scores and round-by-round breakdown. |
| `get_trick_history` | Review all completed tricks this round for card counting. |
| `list_games` | List all active games. |

## How to Play

Once configured, just ask your AI agent to play Hearts:

> "Let's play hearts"

The agent will deal the cards, show your hand, and guide you through each step:

1. **Passing** — The agent shows your hand and suggests which 3 cards to pass. You can accept the suggestion or pick your own.
2. **Playing** — Each turn, the agent shows the current trick, your hand, and legal plays with strategic advice. Just name the card you want to play (e.g. "play the Queen of Spades" or "♠Q").
3. **Between turns** — AI opponents play automatically. The agent reports what they played and who won each trick.
4. **Scoring** — The agent tracks points, warns about moon threats, and shows round summaries.

You can also ask things like:
- "What cards have been played?"
- "Show me the scores"
- "What are my legal plays?"

### Card Format

Three input formats are supported:

| Format | Example | Description |
|--------|---------|-------------|
| Unicode symbol + rank | `♠Q`, `♣2`, `♥10`, `♦A` | Symbol prefix |
| Letter + rank | `SQ`, `C2`, `H10`, `DA` | Letter prefix (case-insensitive) |
| Rank + letter | `QS`, `2C`, `10H`, `AD` | Letter suffix (case-insensitive) |
| Rank only | `Q`, `3`, `10` | When suit is unambiguous from legal plays |

- Ranks: 2, 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K, A
- Suits: C (Clubs), D (Diamonds), S (Spades), H (Hearts)
- If only one suit is possible, you can type just the rank (e.g. "Q" instead of "♠Q")

### Example Turn

```
Trick 8: North won with ♠A (+1 pt, West dumped ♥8). North now at 4 penalty pts, 8 tricks, still threatening the moon!

Now North leads ♥Q — going straight for hearts! East plays ♥5.

              North (AI)
              ♥Q (lead)

  West (AI)                   East (AI)
     —                          ♥5

              South (You)
                 ?

         ┌──────────────┐
Trick 9  │  N: ♥Q       │
         │  E: ♥5       │
         │  S: ?        │
         │  W: waiting  │
         └──────────────┘

┌───────┬───────┬──────┬─────────────┬──────┬────────┬─────┐
│ Trick │ North │ East │ South (You) │ West │ Winner │ Pts │
├───────┼───────┼──────┼─────────────┼──────┼────────┼─────┤
│ 1-5   │ ...   │ ...  │ ...         │ ...  │ North  │ 0   │
├───────┼───────┼──────┼─────────────┼──────┼────────┼─────┤
│ 6     │ ♦K    │ ♥A   │ ♦5          │ ♦2   │ North  │ 1   │
├───────┼───────┼──────┼─────────────┼──────┼────────┼─────┤
│ 7     │ ♦A    │ ♥K   │ ♦10         │ ♥9   │ North  │ 2   │
├───────┼───────┼──────┼─────────────┼──────┼────────┼─────┤
│ 8     │ ♠A    │ ♠K   │ ♠10         │ ♥8   │ North  │ 1   │
├───────┼───────┼──────┼─────────────┼──────┼────────┼─────┤
│ 9     │ ♥Q    │ ♥5   │ ?           │ ...  │ —      │ —   │
└───────┴───────┴──────┴─────────────┴──────┴────────┴─────┘

Penalties: North: 4 (ALL penalty cards so far) -- MOON THREAT!

Your hand: ♣8 ♣J | ♠J ♠Q | ♥3

Legal plays: ♥3 (forced — only heart)

Our ♥3 can't beat ♥Q, so North wins this too. Moon is looking very real... We'll need to win a trick with hearts in the remaining 4 tricks to block it.
```

### Example: Shoot the Moon

```
North SHOT THE MOON! They took all 26 penalty points — so everyone else gets 26 instead.

╔═══════════════════════════════════════════════╗
║        🌙 NORTH SHOT THE MOON! 🌙             ║
║  North: 0  East: 26  South: 26  West: 26      ║
╚═══════════════════════════════════════════════╝

That was devastating. North dominated from trick 1 with all those aces and kings. We never had a chance to block — no hearts to win a trick with.
```

## Rules

- 4 players, 13 cards each. Goal: score the **fewest** points.
- Each Heart = 1 point. Queen of Spades = 13 points.
- Pass 3 cards each round: left, right, across, then no pass (repeating).
- 2 of Clubs leads the first trick. Must follow suit if able.
- Hearts cannot be led until broken (played when unable to follow suit).
- First trick: cannot play Hearts or Queen of Spades unless forced.
- **Shoot the Moon**: take all 26 penalty points and everyone else gets 26 instead.
- Game ends when any player reaches 100 points. Lowest score wins.

## License

MIT
