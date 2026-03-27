#!/usr/bin/env bash
# Test MCP server configurations exactly as documented in README.md.
# All tests use "npx -y hearts-mcp-server" — the same command users are told to configure.
# Runs in an isolated temp environment; cleans up on exit.
#
# Usage:
#   ./scripts/test-config.sh              # run all tests
#   ./scripts/test-config.sh stdio        # stdio only
#   ./scripts/test-config.sh claude       # Claude Code only
#   ./scripts/test-config.sh gemini       # Gemini CLI only
#   ./scripts/test-config.sh codex        # Codex CLI only

TARGETS="${1:-all}"
PASS=0
FAIL=0
SKIP=0

pass() { PASS=$((PASS + 1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  ✗ $1"; }
skip() { SKIP=$((SKIP + 1)); echo "  ⊘ SKIP: $1"; }

# ── Isolated temp environment ──────────────────────────────────────────
WORKDIR=$(mktemp -d)
FAKE_HOME=$(mktemp -d)
trap 'rm -rf "$WORKDIR" "$FAKE_HOME"' EXIT

echo "Workspace: $WORKDIR"
echo ""

# The exact command from README — all CLI configs use this
README_CMD="npx"
README_ARGS=("-y" "hearts-mcp-server")
echo "Testing README command: $README_CMD ${README_ARGS[*]}"
echo ""

# ── Helper: MCP SDK client test ────────────────────────────────────────
# Spawns the server with the given command+args via StdioClientTransport,
# validates initialization, tool listing, and tool calls.
write_sdk_test() {
  # Install the SDK client dependency in the workdir
  cd "$WORKDIR"
  npm init -y --silent >/dev/null 2>&1
  npm install @modelcontextprotocol/sdk --silent 2>/dev/null

  cat > "$WORKDIR/_sdk_test.mjs" <<'SDKEOF'
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const [cmd, ...args] = process.argv.slice(2);
let pass = 0, fail = 0;
function ok(m)  { pass++; console.log(`  ✓ ${m}`); }
function ng(m)  { fail++; console.log(`  ✗ ${m}`); }
function chk(c, m) { c ? ok(m) : ng(m); }

const transport = new StdioClientTransport({ command: cmd, args });
const client = new Client(
  { name: "config-test", version: "1.0.0" },
  { capabilities: {} },
);
await client.connect(transport);

// tools/list
const { tools } = await client.listTools();
const names = tools.map(t => t.name);
chk(tools.length === 8, `All 8 tools registered (got ${tools.length})`);
for (const t of ["create_game","get_game_state","pass_cards","play_card","get_legal_plays","get_scores","get_trick_history","list_games"]) {
  chk(names.includes(t), `Tool '${t}'`);
}

// create_game
const res = await client.callTool({ name: "create_game", arguments: {} });
const game = JSON.parse(res.content[0].text);
chk(typeof game.gameId === "string",       `Game created: ${game.gameId}`);
chk(game.agentSeat === 2,                  "Agent seat = 2 (South)");
chk(game.hand?.length === 13,              "Dealt 13 cards");
chk(JSON.stringify(game.scores)==="[0,0,0,0]", "Scores [0,0,0,0]");

// get_game_state
const st = JSON.parse((await client.callTool({ name: "get_game_state", arguments: { gameId: game.gameId } })).content[0].text);
chk(st.hand.length === 13,                 "get_game_state: 13 cards");
chk(st.heartsBroken === false,             "Hearts not broken");

// error handling
const err = await client.callTool({ name: "get_game_state", arguments: { gameId: "bad" } });
chk(err.isError === true,                  "Invalid ID returns error");

// get_scores
const sc = JSON.parse((await client.callTool({ name: "get_scores", arguments: { gameId: game.gameId } })).content[0].text);
chk(sc.scores.length === 4,                "get_scores: 4 players");
chk(sc.scores[2].isAgent === true,         "Player 2 is agent");

// list_games
const lg = JSON.parse((await client.callTool({ name: "list_games", arguments: {} })).content[0].text);
chk(lg.games.length >= 1,                  "list_games >= 1");

// trick_history
const th = JSON.parse((await client.callTool({ name: "get_trick_history", arguments: { gameId: game.gameId } })).content[0].text);
chk(Array.isArray(th.tricks),              "trick_history is array");

await client.close();
console.log(`\nResults: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
SDKEOF
}

run_sdk_test() {
  local cmd="$1"
  shift
  if node "$WORKDIR/_sdk_test.mjs" "$cmd" "$@"; then
    pass "SDK client test passed"
  else
    fail "SDK client test failed"
  fi
}

# ═══════════════════════════════════════════════════════════════════════
# STDIO TEST — "npx -y hearts-mcp-server" over MCP stdio transport
# This is the core path all CLI configs rely on.
# ═══════════════════════════════════════════════════════════════════════
test_stdio() {
  echo ""
  echo "╔══════════════════════════════════════════╗"
  echo "║  Test: stdio (npx -y hearts-mcp-server)  ║"
  echo "╚══════════════════════════════════════════╝"
  echo ""
  echo "Setting up isolated workdir..."
  write_sdk_test
  # Also install hearts-mcp-server so npx resolves it instantly
  # (avoids timeout — npx still runs it the same way)
  cd "$WORKDIR"
  npm install hearts-mcp-server --silent 2>/dev/null
  echo ""

  # Exact README command: npx -y hearts-mcp-server
  run_sdk_test "$README_CMD" "${README_ARGS[@]}"
}

# ═══════════════════════════════════════════════════════════════════════
# CLAUDE CODE — README: ~/.claude/settings.json
# {
#   "mcpServers": {
#     "hearts": {
#       "command": "npx",
#       "args": ["-y", "hearts-mcp-server"]
#     }
#   }
# }
# ═══════════════════════════════════════════════════════════════════════
test_claude() {
  echo ""
  echo "╔══════════════════════════════════════════╗"
  echo "║  Test: Claude Code                       ║"
  echo "║  README: npx -y hearts-mcp-server        ║"
  echo "╚══════════════════════════════════════════╝"
  echo ""

  if ! command -v claude &>/dev/null; then
    skip "claude CLI not installed"
    return 0
  fi
  echo "Version: $(claude --version 2>&1)"

  local name="hearts-config-test"
  _claude_cleanup() { claude mcp remove -s user "$name" >/dev/null 2>&1 || true; }
  trap '_claude_cleanup' RETURN

  # Add using exact README command: npx -y hearts-mcp-server
  local add_out
  add_out=$(claude mcp add -s user "$name" -- npx -y hearts-mcp-server 2>&1)
  if echo "$add_out" | grep -qi "added\|$name"; then
    pass "Server added (npx -y hearts-mcp-server)"
  else
    fail "Failed to add server"
    echo "  $add_out"
    return
  fi

  # List
  if claude mcp list 2>&1 | grep -q "$name"; then
    pass "Server listed"
  else
    fail "Server not in list"
  fi

  # Health check — verifies the npx command actually starts the server
  local get_out
  get_out=$(claude mcp get "$name" 2>&1)
  if echo "$get_out" | grep -qi "Connected"; then
    pass "Health check: Connected"
  else
    fail "Health check failed"
    echo "  $(echo "$get_out" | head -5)"
  fi

  # Verify the configured command matches README
  if echo "$get_out" | grep -q "npx"; then
    pass "Command is 'npx'"
  else
    fail "Command is not 'npx'"
  fi
  if echo "$get_out" | grep -q "hearts-mcp-server"; then
    pass "Args include 'hearts-mcp-server'"
  else
    fail "Args missing 'hearts-mcp-server'"
  fi

  # E2E tool call
  local e2e_out
  e2e_out=$(echo "Call the create_game tool from the $name MCP server. Return only the raw JSON." \
    | claude -p --allowedTools "mcp__${name}__create_game" 2>&1) || true
  if echo "$e2e_out" | grep -qi "game\|hand\|heart\|agentSeat"; then
    pass "E2E: create_game returned game data"
  else
    fail "E2E: unexpected output"
    echo "  $(echo "$e2e_out" | head -3)"
  fi
}

# ═══════════════════════════════════════════════════════════════════════
# GEMINI CLI — README: ~/.gemini/settings.json
# {
#   "mcpServers": {
#     "hearts": {
#       "command": "npx",
#       "args": ["-y", "hearts-mcp-server"]
#     }
#   }
# }
# ═══════════════════════════════════════════════════════════════════════
test_gemini() {
  echo ""
  echo "╔══════════════════════════════════════════╗"
  echo "║  Test: Gemini CLI                        ║"
  echo "║  README: npx -y hearts-mcp-server        ║"
  echo "╚══════════════════════════════════════════╝"
  echo ""

  if ! command -v gemini &>/dev/null; then
    skip "gemini CLI not installed"
    return 0
  fi
  echo "Version: $(gemini --version 2>&1)"

  local name="hearts-config-test"
  _gemini_cleanup() { gemini mcp remove "$name" >/dev/null 2>&1 || true; }
  trap '_gemini_cleanup' RETURN

  # Add using exact README command: npx -y hearts-mcp-server
  local add_out
  add_out=$(gemini mcp add -s user "$name" npx -- -y hearts-mcp-server 2>&1)
  # Verify via list
  if gemini mcp list 2>&1 | grep -q "$name"; then
    pass "Server added and listed (npx -y hearts-mcp-server)"
  else
    fail "Server not in list after add"
    echo "  add output: $add_out"
  fi

  # E2E tool call
  local e2e_out
  e2e_out=$(gemini \
    -p "Call the create_game tool from the $name MCP server and return the raw JSON." \
    --allowed-mcp-server-names "$name" \
    -y 2>&1) || true
  if echo "$e2e_out" | grep -qi "game\|hand\|heart\|agentSeat\|create_game"; then
    pass "E2E: create_game returned game data"
  else
    fail "E2E: unexpected output"
    echo "  $(echo "$e2e_out" | head -3)"
  fi
}

# ═══════════════════════════════════════════════════════════════════════
# CODEX CLI — README: ~/.codex/config.toml
# [mcp_servers.hearts]
# command = "npx"
# args = ["-y", "hearts-mcp-server"]
# ═══════════════════════════════════════════════════════════════════════
test_codex() {
  echo ""
  echo "╔══════════════════════════════════════════╗"
  echo "║  Test: Codex CLI                         ║"
  echo "║  README: npx -y hearts-mcp-server        ║"
  echo "╚══════════════════════════════════════════╝"
  echo ""

  if ! command -v codex &>/dev/null; then
    skip "codex CLI not installed"
    return 0
  fi
  echo "Version: $(codex --version 2>&1)"

  # Write exact README config into isolated HOME
  local codex_config="$FAKE_HOME/.codex/config.toml"
  mkdir -p "$FAKE_HOME/.codex"
  cat > "$codex_config" <<'EOF'
[mcp_servers.hearts]
command = "npx"
args = ["-y", "hearts-mcp-server"]
EOF

  if grep -q 'hearts-mcp-server' "$codex_config"; then
    pass "Config written (exact README format)"
  else
    fail "Config write failed"
    return
  fi

  # Verify TOML matches README
  if grep -q 'command = "npx"' "$codex_config" && grep -q 'args = \["-y", "hearts-mcp-server"\]' "$codex_config"; then
    pass "Config matches README exactly"
  else
    fail "Config does not match README"
  fi

  # E2E tool call (use FAKE_HOME so codex reads our config)
  local e2e_out
  e2e_out=$(HOME="$FAKE_HOME" codex \
    -p "Call the create_game tool and return the raw JSON." \
    --full-auto 2>&1) || true
  if echo "$e2e_out" | grep -qi "game\|hand\|heart"; then
    pass "E2E: create_game returned game data"
  else
    fail "E2E: unexpected output"
    echo "  $(echo "$e2e_out" | head -3)"
  fi
}

# ── Run selected tests ─────────────────────────────────────────────────
if [ "$TARGETS" = "all" ] || [ "$TARGETS" = "stdio" ];  then test_stdio;  fi
if [ "$TARGETS" = "all" ] || [ "$TARGETS" = "claude" ]; then test_claude; fi
if [ "$TARGETS" = "all" ] || [ "$TARGETS" = "gemini" ]; then test_gemini; fi
if [ "$TARGETS" = "all" ] || [ "$TARGETS" = "codex" ];  then test_codex;  fi

# ── Summary ────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════"
echo "  Total: $PASS passed, $FAIL failed, $SKIP skipped"
echo "════════════════════════════════════════════"
[ "$FAIL" -eq 0 ]
