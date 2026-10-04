import test from "node:test";
import assert from "node:assert/strict";
import {
  MinesweeperEngine,
  SolitaireEngine,
  HeartsEngine,
  ChessEngine,
  MahjongEngine,
  seededRandom,
} from "../packages/apps-games/engines.js";

test("Minesweeper first reveal is safe; counts and win state agree with the board", () => {
  const g = new MinesweeperEngine(16, 16, 40, seededRandom(42));
  g.reveal(119);
  assert.equal(g.cells[119].count, 0);
  assert.equal(g.cells.filter((c) => c.mine).length, 40);
  g.cells.forEach((c, i) =>
    assert.equal(c.count, g.neighbors(i).filter((n) => g.cells[n].mine).length),
  );
  g.cells.forEach((c, i) => {
    if (!c.mine) g.reveal(i);
  });
  assert.equal(g.status, "won");
  assert.equal(g.flags, 40);
  const tiny = new MinesweeperEngine(1, 1, 0);
  tiny.reveal(0);
  assert.equal(tiny.status, "won");
});
function cards(g) {
  return [
    g.state.stock,
    g.state.waste,
    ...g.state.tableau,
    ...g.state.foundations,
    ...g.state.cells,
    ...g.state.completed,
  ].flat();
}
test("Solitaire variants conserve unique cards through moves, dealing, and undo", () => {
  for (const mode of ["solitaire", "freecell", "spider"])
    for (const seed of [1, 42, 82]) {
      const g = new SolitaireEngine(mode, seed),
        rng = seededRandom(seed),
        expected = mode === "spider" ? 104 : 52;
      for (let i = 0; i < 120; i++) {
        const hints = g.hints();
        if (i % 9 === 0 && g.history.length) g.undo();
        else if (hints.length) {
          const move = hints[Math.floor(rng() * hints.length)];
          assert.equal(g.move(move.from, move.to), true);
        } else g.draw();
        assert.equal(cards(g).length, expected);
        assert.equal(new Set(cards(g).map((c) => c.id)).size, expected);
      }
    }
});
test("Hearts deals and passes preserve the deck; complete round assigns all penalty points", () => {
  const g = new HeartsEngine(23);
  assert.equal(g.pass(g.hands[0].slice(0, 3).map((c) => c.id)), true);
  assert.equal(new Set(g.hands.flat().map((c) => c.id)).size, 52);
  const played = new Set();
  while (!["roundOver", "over"].includes(g.phase)) {
    if (g.phase === "collect") {
      g.collect();
      continue;
    }
    const card = g.ai();
    assert.ok(card);
    assert.ok(!played.has(card.id));
    played.add(card.id);
    assert.equal(g.play(card.id), true);
  }
  assert.equal(played.size, 52);
  assert.equal(g.tricks, 13);
  assert.ok([26, 78].includes(g.roundScores.reduce((a, b) => a + b, 0)));
});
function perft(g, depth) {
  if (!depth) return 1;
  let count = 0;
  for (const move of g.legal())
    for (const promotion of move.promotion ? ["q", "r", "b", "n"] : ["q"]) {
      const next = new ChessEngine(g.export());
      assert.equal(next.move(move.from, move.to, promotion, false), true);
      count += perft(next, depth - 1);
    }
  return count;
}
test("Chess legal moves match canonical starting position perft", () => {
  const g = new ChessEngine();
  assert.equal(perft(g, 1), 20);
  assert.equal(perft(g, 2), 400);
  assert.equal(perft(g, 3), 8902);
});
test("Chess undo restores every rule state and cannot manufacture repetition", () => {
  const g = new ChessEngine(),
    before = g.export();
  g.move(62, 45);
  g.move(6, 21);
  g.undo();
  g.undo();
  assert.deepEqual(g.export(), before);
  for (let i = 0; i < 4; i++) {
    g.move(62, 45);
    assert.equal(g.outcome(), null);
    g.undo();
  }
  assert.deepEqual(g.export(), before);
});
test("Chess repetition ignores unusable en-passant targets; Fool’s Mate is checkmate", () => {
  const g = new ChessEngine();
  g.move(52, 36);
  for (let i = 0; i < 2; i++)
    for (const [a, b] of [
      [6, 21],
      [62, 45],
      [21, 6],
      [45, 62],
    ])
      assert.equal(g.move(a, b), true);
  assert.equal(g.outcome()?.reason, "Threefold repetition");
  const mate = new ChessEngine();
  for (const [a, b] of [
    [53, 45],
    [12, 28],
    [54, 38],
    [3, 39],
  ])
    assert.equal(mate.move(a, b), true);
  assert.deepEqual(mate.outcome(), { type: "checkmate", winner: "b" });
});
test("Mahjong deals have complete legal solutions, including previously failing seeds", () => {
  for (const seed of [0, 1, 41, 82, 299]) {
    const g = new MahjongEngine(seed);
    assert.ok(g.tiles.every((t) => Number.isInteger(t.value)));
    for (const [a, b] of g.solution) assert.equal(g.match(a, b), true);
    assert.equal(g.won, true);
    assert.equal(g.undo(), true);
    assert.equal(g.won, false);
  }
});
test("An impossible Mahjong reshuffle leaves values, geometry, and undo intact", () => {
  const g = new MahjongEngine(4);
  g.tiles.forEach((t) => (t.removed = true));
  g.tiles[0].removed = false;
  g.history = [[1, 2]];
  const before = structuredClone({ tiles: g.tiles, history: g.history });
  assert.equal(g.assignPairs(), false);
  assert.deepEqual({ tiles: g.tiles, history: g.history }, before);
});
