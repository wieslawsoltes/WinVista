export function seededRandom(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffle(array, rng = Math.random) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
export class MinesweeperEngine {
  constructor(width = 9, height = 9, mines = 10, rng = Math.random) {
    if (
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width < 1 ||
      height < 1
    )
      throw new RangeError("Board dimensions must be positive integers.");
    this.width = width;
    this.height = height;
    this.mineCount = Math.max(
      0,
      Math.min(
        Math.trunc(mines) || 0,
        width * height - Math.min(3, width) * Math.min(3, height),
      ),
    );
    this.rng = rng;
    this.cells = Array.from({ length: width * height }, () => ({
      mine: false,
      count: 0,
      mark: 0,
    }));
    this.status = "ready";
    this.revealed = 0;
    this.started = 0;
    this.ended = 0;
  }
  neighbors(index) {
    const x = index % this.width,
      y = Math.floor(index / this.width),
      result = [];
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++)
        if (
          (dx || dy) &&
          x + dx >= 0 &&
          x + dx < this.width &&
          y + dy >= 0 &&
          y + dy < this.height
        )
          result.push((y + dy) * this.width + x + dx);
    return result;
  }
  place(first) {
    const excluded = new Set([first, ...this.neighbors(first)]),
      candidates = shuffle(
        this.cells.map((_, i) => i).filter((i) => !excluded.has(i)),
        this.rng,
      );
    for (const i of candidates.slice(0, this.mineCount))
      this.cells[i].mine = true;
    this.cells.forEach(
      (cell, i) =>
        (cell.count = this.neighbors(i).filter(
          (j) => this.cells[j].mine,
        ).length),
    );
    this.status = "playing";
    this.started = Date.now();
  }
  reveal(index) {
    if (
      !this.cells[index] ||
      ["won", "lost"].includes(this.status) ||
      this.cells[index].mark === 2
    )
      return false;
    if (this.status === "ready") this.place(index);
    if (this.cells[index].mark === 1) {
      this.chord(index);
      return true;
    }
    const queue = [index],
      queued = new Uint8Array(this.cells.length);
    queued[index] = 1;
    for (let i = 0; i < queue.length; i++) {
      const idx = queue[i],
        cell = this.cells[idx];
      if (cell.mark === 1 || cell.mark === 2) continue;
      cell.mark = 1;
      if (cell.mine) {
        this.status = "lost";
        this.exploded = idx;
        this.ended = Date.now();
        return true;
      }
      this.revealed++;
      if (cell.count === 0)
        for (const n of this.neighbors(idx))
          if (
            this.cells[n].mark !== 1 &&
            this.cells[n].mark !== 2 &&
            !queued[n]
          ) {
            queued[n] = 1;
            queue.push(n);
          }
    }
    if (this.revealed === this.cells.length - this.mineCount) {
      this.status = "won";
      this.ended = Date.now();
      for (const c of this.cells) if (c.mine) c.mark = 2;
    }
    return true;
  }
  chord(index) {
    const cell = this.cells[index];
    if (cell.mark !== 1 || cell.count === 0 || this.status !== "playing")
      return;
    const neighbors = this.neighbors(index);
    if (neighbors.filter((i) => this.cells[i].mark === 2).length === cell.count)
      for (const n of neighbors)
        if (
          this.cells[n].mark !== 1 &&
          this.cells[n].mark !== 2 &&
          this.status === "playing"
        )
          this.reveal(n);
  }
  flag(index) {
    const c = this.cells[index];
    if (!c || c.mark === 1 || ["won", "lost"].includes(this.status)) return;
    c.mark = c.mark === 0 ? 2 : c.mark === 2 ? 3 : 0;
  }
  get flags() {
    return this.cells.filter((c) => c.mark === 2).length;
  }
  get seconds() {
    return this.started
      ? Math.floor(((this.ended || Date.now()) - this.started) / 1000)
      : 0;
  }
}
export const SUITS = ["♠", "♥", "♣", "♦"];
export const isRed = (card) => card.suit === 1 || card.suit === 3;
export const rankLabel = (rank) =>
  ({ 1: "A", 11: "J", 12: "Q", 13: "K" })[rank] || String(rank);
export function makeDeck(copies = 1, suits = 4) {
  const result = [];
  for (let c = 0; c < copies; c++)
    for (let s = 0; s < 4; s++)
      for (let rank = 1; rank <= 13; rank++)
        result.push({
          id: c * 52 + s * 13 + rank - 1,
          suit: s % suits,
          rank,
          faceUp: false,
        });
  return result;
}

export class SolitaireEngine {
  constructor(mode = "solitaire", seed = Date.now(), suits = 1) {
    this.mode = mode;
    this.seed = seed;
    this.rng = seededRandom(seed);
    this.suits = suits;
    this.drawCount = 1;
    this.history = [];
    this.moves = 0;
    this.score = 0;
    this.state = {
      tableau: [],
      stock: [],
      waste: [],
      foundations: Array.from({ length: 4 }, () => []),
      cells: Array.from({ length: 4 }, () => []),
      completed: [],
    };
    const deck = shuffle(
      makeDeck(mode === "spider" ? 2 : 1, mode === "spider" ? suits : 4),
      this.rng,
    );
    if (mode === "freecell") {
      this.state.tableau = Array.from({ length: 8 }, () => []);
      deck.forEach((c, i) => {
        c.faceUp = true;
        this.state.tableau[i % 8].push(c);
      });
    } else if (mode === "spider") {
      this.state.tableau = Array.from({ length: 10 }, () => []);
      for (let i = 0; i < 54; i++) this.state.tableau[i % 10].push(deck.pop());
      for (const pile of this.state.tableau) pile.at(-1).faceUp = true;
      this.state.stock = deck;
    } else {
      for (let i = 0; i < 7; i++) {
        const pile = [];
        for (let j = 0; j <= i; j++) pile.push(deck.pop());
        pile.at(-1).faceUp = true;
        this.state.tableau.push(pile);
      }
      this.state.stock = deck;
    }
  }
  snapshot() {
    return structuredClone({
      state: this.state,
      moves: this.moves,
      score: this.score,
    });
  }
  push() {
    this.history.push(this.snapshot());
    if (this.history.length > 100) this.history.shift();
  }
  undo() {
    const previous = this.history.pop();
    if (previous) {
      this.state = previous.state;
      this.moves = previous.moves;
      this.score = previous.score;
      return true;
    }
    return false;
  }
  pile(ref) {
    return ref.kind === "stock" || ref.kind === "waste"
      ? this.state[ref.kind]
      : this.state[ref.kind]?.[ref.pile];
  }
  cards(ref) {
    const pile = this.pile(ref);
    if (!pile) return [];
    return pile.slice(ref.index ?? pile.length - 1);
  }
  validRun(cards) {
    return (
      cards.length > 0 &&
      cards.every(
        (c, i) =>
          c.faceUp &&
          (!i ||
            (cards[i - 1].rank === c.rank + 1 &&
              (this.mode === "spider"
                ? cards[i - 1].suit === c.suit
                : isRed(cards[i - 1]) !== isRed(c)))),
      )
    );
  }
  canMove(from, to) {
    if (
      from.kind === "foundations" &&
      (this.mode !== "solitaire" || to.kind === "foundations")
    )
      return false;
    if (from.kind === to.kind && from.pile === to.pile) return false;
    const source = this.pile(from),
      dest = this.pile(to),
      cards = this.cards(from);
    if (
      !source ||
      !dest ||
      !this.validRun(cards) ||
      from.kind === "stock" ||
      from.kind === "completed"
    )
      return false;
    if (from.kind !== "tableau" && cards.length !== 1) return false;
    const card = cards[0],
      top = dest.at(-1);
    if (to.kind === "foundations") {
      return (
        this.mode !== "spider" &&
        cards.length === 1 &&
        (!top
          ? card.rank === 1
          : top.suit === card.suit && card.rank === top.rank + 1)
      );
    }
    if (to.kind === "cells")
      return this.mode === "freecell" && !top && cards.length === 1;
    if (to.kind !== "tableau") return false;
    if (this.mode === "freecell") {
      const emptyCells = this.state.cells.filter((p) => !p.length).length,
        emptyCols = this.state.tableau.filter(
          (p, i) =>
            !p.length &&
            i !== to.pile &&
            !(from.kind === "tableau" && i === from.pile),
        ).length,
        max = (emptyCells + 1) * 2 ** emptyCols;
      if (cards.length > max) return false;
    }
    if (!top) return this.mode === "solitaire" ? card.rank === 13 : true;
    if (!top.faceUp) return false;
    return (
      top.rank === card.rank + 1 &&
      (this.mode === "spider" || isRed(top) !== isRed(card))
    );
  }
  move(from, to) {
    if (!this.canMove(from, to)) return false;
    this.push();
    const source = this.pile(from),
      dest = this.pile(to),
      index = from.index ?? source.length - 1,
      cards = source.splice(index);
    dest.push(...cards);
    this.moves++;
    this.score += to.kind === "foundations" ? 10 : 5;
    if (from.kind === "tableau" && source.length && !source.at(-1).faceUp) {
      source.at(-1).faceUp = true;
      this.score += 5;
    }
    this.collectSpider();
    return true;
  }
  collectSpider() {
    if (this.mode !== "spider") return;
    for (const pile of this.state.tableau) {
      const run = pile.slice(-13);
      if (run.length === 13 && run[0].rank === 13 && this.validRun(run)) {
        this.state.completed.push(pile.splice(-13));
        this.score += 100;
        if (pile.length) pile.at(-1).faceUp = true;
      }
    }
  }
  draw() {
    if (this.mode === "freecell") return false;
    const s = this.state;
    if (this.mode === "spider") {
      if (!s.stock.length || s.tableau.some((p) => !p.length)) return false;
      this.push();
      for (const p of s.tableau) {
        const card = s.stock.pop();
        card.faceUp = true;
        p.push(card);
      }
      this.collectSpider();
    } else {
      if (!s.stock.length && !s.waste.length) return false;
      this.push();
      if (!s.stock.length) {
        s.stock = s.waste.reverse();
        s.waste = [];
        for (const c of s.stock) c.faceUp = false;
        this.score = Math.max(0, this.score - 15);
      } else
        for (let i = 0; i < this.drawCount && s.stock.length; i++) {
          const c = s.stock.pop();
          c.faceUp = true;
          s.waste.push(c);
        }
    }
    this.moves++;
    return true;
  }
  autoFoundation(from) {
    if (this.mode === "spider") return false;
    for (let pile = 0; pile < 4; pile++)
      if (this.move(from, { kind: "foundations", pile })) return true;
    return false;
  }
  hints() {
    const sources = [];
    if (this.mode === "solitaire")
      for (let pile = 0; pile < 4; pile++)
        if (this.state.foundations[pile].length)
          sources.push({
            kind: "foundations",
            pile,
            index: this.state.foundations[pile].length - 1,
          });
    for (let p = 0; p < this.state.tableau.length; p++)
      for (let i = 0; i < this.state.tableau[p].length; i++)
        if (this.state.tableau[p][i].faceUp)
          sources.push({ kind: "tableau", pile: p, index: i });
    if (this.state.waste.length)
      sources.push({ kind: "waste", index: this.state.waste.length - 1 });
    for (let p = 0; p < 4; p++)
      if (this.state.cells[p].length)
        sources.push({ kind: "cells", pile: p, index: 0 });
    const destinations = [
      ...this.state.foundations.map((_, pile) => ({
        kind: "foundations",
        pile,
      })),
      ...this.state.tableau.map((_, pile) => ({ kind: "tableau", pile })),
      ...(this.mode === "freecell"
        ? this.state.cells.map((_, pile) => ({ kind: "cells", pile }))
        : []),
    ];
    const hints = [];
    for (const from of sources)
      for (const to of destinations)
        if (
          this.canMove(from, to) &&
          !(
            from.kind === "tableau" &&
            from.index === 0 &&
            to.kind === "tableau" &&
            !this.pile(to).length
          )
        )
          hints.push({ from, to });
    return hints;
  }
  get won() {
    return this.mode === "spider"
      ? this.state.completed.length === 8
      : this.state.foundations.reduce((n, p) => n + p.length, 0) === 52;
  }
}

export class HeartsEngine {
  constructor(seed = Date.now()) {
    this.rng = seededRandom(seed);
    this.scores = [0, 0, 0, 0];
    this.round = 0;
    this.nextRound();
  }
  nextRound() {
    this.round++;
    const deck = shuffle(makeDeck(), this.rng);
    this.hands = Array.from({ length: 4 }, (_, p) =>
      deck
        .slice(p * 13, p * 13 + 13)
        .sort((a, b) => a.suit - b.suit || a.rank - b.rank),
    );
    this.trick = [];
    this.roundScores = [0, 0, 0, 0];
    this.broken = false;
    this.tricks = 0;
    this.phase = this.round % 4 === 0 ? "playing" : "passing";
    this.turn = this.hands.findIndex((h) =>
      h.some((c) => c.suit === 2 && c.rank === 2),
    );
    this.lastTrick = [];
  }
  pass(ids) {
    if (this.phase !== "passing" || ids.length !== 3 || new Set(ids).size !== 3)
      return false;
    const selected = this.hands[0].filter((c) => ids.includes(c.id));
    if (selected.length !== 3) return false;
    const passes = [
        selected,
        ...this.hands
          .slice(1)
          .map((hand) =>
            [...hand]
              .sort((a, b) => this.danger(b) - this.danger(a))
              .slice(0, 3),
          ),
      ],
      offset = [0, 1, 3, 2][this.round % 4];
    for (let p = 0; p < 4; p++)
      this.hands[p] = this.hands[p].filter(
        (c) => !passes[p].some((x) => x.id === c.id),
      );
    for (let p = 0; p < 4; p++) this.hands[(p + offset) % 4].push(...passes[p]);
    for (const hand of this.hands)
      hand.sort((a, b) => a.suit - b.suit || this.rank(a) - this.rank(b));
    this.phase = "playing";
    this.turn = this.hands.findIndex((h) =>
      h.some((c) => c.suit === 2 && c.rank === 2),
    );
    return true;
  }
  rank(c) {
    return c.rank === 1 ? 14 : c.rank;
  }
  points(c) {
    return c.suit === 1 ? 1 : c.suit === 0 && c.rank === 12 ? 13 : 0;
  }
  danger(c) {
    return this.points(c) * 4 + this.rank(c);
  }
  legal(player = this.turn) {
    const hand = this.hands[player];
    if (this.phase !== "playing") return [];
    if (this.tricks === 0 && !this.trick.length)
      return hand.filter((c) => c.suit === 2 && c.rank === 2);
    if (this.trick.length) {
      const suit = this.trick[0].card.suit,
        following = hand.filter((c) => c.suit === suit);
      if (following.length) return following;
      if (this.tricks === 0) {
        const safe = hand.filter((c) => this.points(c) === 0);
        if (safe.length) return safe;
      }
      return hand;
    }
    if (!this.broken) {
      const nonhearts = hand.filter((c) => c.suit !== 1);
      if (nonhearts.length) return nonhearts;
    }
    return hand;
  }
  play(id) {
    if (this.phase !== "playing") return false;
    const c = this.legal().find((c) => c.id === id);
    if (!c) return false;
    this.hands[this.turn] = this.hands[this.turn].filter((x) => x.id !== id);
    this.trick.push({ player: this.turn, card: c });
    if (c.suit === 1) this.broken = true;
    if (this.trick.length === 4) this.phase = "collect";
    else this.turn = (this.turn + 1) % 4;
    return true;
  }
  collect() {
    if (this.phase !== "collect") return;
    const suit = this.trick[0].card.suit,
      winner = this.trick
        .filter((t) => t.card.suit === suit)
        .sort((a, b) => this.rank(b.card) - this.rank(a.card))[0].player;
    this.roundScores[winner] += this.trick.reduce(
      (n, t) => n + this.points(t.card),
      0,
    );
    this.lastTrick = this.trick;
    this.trick = [];
    this.tricks++;
    this.turn = winner;
    this.phase = "playing";
    if (this.tricks === 13) {
      const moon = this.roundScores.findIndex((x) => x === 26);
      if (moon >= 0)
        this.roundScores = this.roundScores.map((_, i) =>
          i === moon ? 0 : 26,
        );
      this.scores = this.scores.map((v, i) => v + this.roundScores[i]);
      this.phase = this.scores.some((v) => v >= 100) ? "over" : "roundOver";
    }
  }
  ai() {
    const cards = this.legal();
    if (!cards.length) return null;
    const trick = this.trick;
    if (!trick.length)
      return [...cards].sort((a, b) => this.rank(a) - this.rank(b))[0];
    const suit = trick[0].card.suit,
      top = Math.max(
        ...trick
          .filter((t) => t.card.suit === suit)
          .map((t) => this.rank(t.card)),
      );
    if (cards[0].suit !== suit)
      return [...cards].sort((a, b) => this.danger(b) - this.danger(a))[0];
    const losing = cards.filter((c) => this.rank(c) < top);
    return losing.length
      ? losing.sort((a, b) => this.rank(b) - this.rank(a))[0]
      : [...cards].sort((a, b) => this.rank(a) - this.rank(b))[0];
  }
}

const knight = [
    [1, 2],
    [2, 1],
    [2, -1],
    [1, -2],
    [-1, -2],
    [-2, -1],
    [-2, 1],
    [-1, 2],
  ],
  diagonal = [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ],
  orthogonal = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
export const pieceColor = (p) =>
  !p ? null : p === p.toUpperCase() ? "w" : "b";
export const opposite = (c) => (c === "w" ? "b" : "w");
export class ChessEngine {
  constructor(state) {
    if (state) {
      Object.assign(this, structuredClone(state));
      this.history ??= [];
      return;
    }
    this.board =
      "rnbqkbnrpppppppp................................PPPPPPPPRNBQKBNR"
        .split("")
        .map((c) => (c === "." ? null : c));
    this.turn = "w";
    this.castle = "KQkq";
    this.ep = -1;
    this.halfmove = 0;
    this.fullmove = 1;
    this.history = [];
    this.log = [];
    this.positions = {};
    this.positions[this.key()] = 1;
  }
  export() {
    return {
      board: [...this.board],
      turn: this.turn,
      castle: this.castle,
      ep: this.ep,
      halfmove: this.halfmove,
      fullmove: this.fullmove,
      log: [...this.log],
      positions: { ...this.positions },
      history: [],
    };
  }
  key() {
    let ep = -1;
    if (this.ep >= 0) {
      for (const dx of [-1, 1]) {
        const from = this.ep + (this.turn === "w" ? 8 : -8) + dx;
        if (
          from < 0 ||
          from > 63 ||
          Math.abs((from % 8) - (this.ep % 8)) !== 1 ||
          this.board[from] !== (this.turn === "w" ? "P" : "p")
        )
          continue;
        if (
          this.pseudo(from).some(
            (m) => m.enPassant && !this.inCheck(this.turn, this.applyBoard(m)),
          )
        ) {
          ep = this.ep;
          break;
        }
      }
    }
    return (
      this.board.map((p) => p || ".").join("") + this.turn + this.castle + ep
    );
  }
  attacked(square, by, board = this.board) {
    const x = square % 8,
      y = Math.floor(square / 8);
    for (let i = 0; i < 64; i++) {
      const p = board[i];
      if (pieceColor(p) !== by) continue;
      const px = i % 8,
        py = Math.floor(i / 8),
        dx = x - px,
        dy = y - py,
        type = p.toLowerCase();
      if (type === "p" && Math.abs(dx) === 1 && dy === (by === "w" ? -1 : 1))
        return true;
      if (type === "n" && knight.some(([a, b]) => a === dx && b === dy))
        return true;
      if (type === "k" && Math.max(Math.abs(dx), Math.abs(dy)) === 1)
        return true;
      if (
        (type === "b" && Math.abs(dx) === Math.abs(dy)) ||
        (type === "r" && (dx === 0 || dy === 0)) ||
        (type === "q" &&
          (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy)))
      ) {
        if (dx === 0 && dy === 0) continue;
        const sx = Math.sign(dx),
          sy = Math.sign(dy);
        let cx = px + sx,
          cy = py + sy,
          clear = true;
        while (cx !== x || cy !== y) {
          if (board[cy * 8 + cx]) {
            clear = false;
            break;
          }
          cx += sx;
          cy += sy;
        }
        if (clear) return true;
      }
    }
    return false;
  }
  inCheck(color = this.turn, board = this.board) {
    const index = board.indexOf(color === "w" ? "K" : "k");
    return index < 0 || this.attacked(index, opposite(color), board);
  }
  pseudo(index) {
    const p = this.board[index],
      color = pieceColor(p);
    if (!p) return [];
    const type = p.toLowerCase(),
      x = index % 8,
      y = Math.floor(index / 8),
      moves = [];
    const add = (tx, ty, extra = {}) => {
      if (tx < 0 || tx > 7 || ty < 0 || ty > 7) return false;
      const to = ty * 8 + tx,
        target = this.board[to];
      if (pieceColor(target) === color || target?.toLowerCase() === "k")
        return false;
      moves.push({ from: index, to, ...extra });
      return !target;
    };
    if (type === "p") {
      const dir = color === "w" ? -1 : 1,
        ny = y + dir;
      if (ny >= 0 && ny < 8) {
        if (!this.board[ny * 8 + x]) {
          add(x, ny, ny === 0 || ny === 7 ? { promotion: true } : {});
          if (
            y === (color === "w" ? 6 : 1) &&
            !this.board[(y + dir * 2) * 8 + x]
          )
            add(x, y + dir * 2, { double: true });
        }
        for (const dx of [-1, 1])
          if (x + dx >= 0 && x + dx < 8) {
            const to = ny * 8 + x + dx,
              target = this.board[to];
            if (target && pieceColor(target) !== color)
              add(x + dx, ny, ny === 0 || ny === 7 ? { promotion: true } : {});
            else if (to === this.ep) add(x + dx, ny, { enPassant: true });
          }
      }
    } else if (type === "n") for (const [dx, dy] of knight) add(x + dx, y + dy);
    else if (type === "k") {
      for (const [dx, dy] of [...diagonal, ...orthogonal]) add(x + dx, y + dy);
      const base = color === "w" ? 56 : 0,
        right = color === "w" ? "K" : "k",
        left = color === "w" ? "Q" : "q",
        enemy = opposite(color);
      if (index === base + 4 && !this.inCheck(color)) {
        if (
          this.castle.includes(right) &&
          this.board[base + 7] === (color === "w" ? "R" : "r") &&
          !this.board[base + 5] &&
          !this.board[base + 6] &&
          !this.attacked(base + 5, enemy) &&
          !this.attacked(base + 6, enemy)
        )
          moves.push({ from: index, to: base + 6, castling: "king" });
        if (
          this.castle.includes(left) &&
          this.board[base] === (color === "w" ? "R" : "r") &&
          !this.board[base + 1] &&
          !this.board[base + 2] &&
          !this.board[base + 3] &&
          !this.attacked(base + 3, enemy) &&
          !this.attacked(base + 2, enemy)
        )
          moves.push({ from: index, to: base + 2, castling: "queen" });
      }
    } else
      for (const [dx, dy] of type === "b"
        ? diagonal
        : type === "r"
          ? orthogonal
          : [...diagonal, ...orthogonal]) {
        let tx = x + dx,
          ty = y + dy;
        while (tx >= 0 && tx < 8 && ty >= 0 && ty < 8) {
          if (!add(tx, ty)) break;
          tx += dx;
          ty += dy;
        }
      }
    return moves;
  }
  applyBoard(move, promotion = "q") {
    const board = [...this.board],
      p = board[move.from],
      color = pieceColor(p);
    board[move.from] = null;
    board[move.to] = move.promotion
      ? color === "w"
        ? promotion.toUpperCase()
        : promotion.toLowerCase()
      : p;
    if (move.enPassant) board[move.to + (color === "w" ? 8 : -8)] = null;
    if (move.castling) {
      const base = color === "w" ? 56 : 0;
      if (move.castling === "king") {
        board[base + 5] = board[base + 7];
        board[base + 7] = null;
      } else {
        board[base + 3] = board[base];
        board[base] = null;
      }
    }
    return board;
  }
  legal(index = null) {
    const result = [];
    for (let i = 0; i < 64; i++)
      if (
        (index == null || i === index) &&
        pieceColor(this.board[i]) === this.turn
      )
        for (const move of this.pseudo(i))
          if (!this.inCheck(this.turn, this.applyBoard(move)))
            result.push(move);
    return result;
  }
  move(from, to, promotion = "q", record = true) {
    const move = this.legal(from).find((m) => m.to === to);
    if (!move) return false;
    if (!["q", "r", "b", "n"].includes(promotion)) promotion = "q";
    if (record) this.history.push(this.export());
    const piece = this.board[from],
      captured = this.board[to],
      color = this.turn;
    this.board = this.applyBoard(move, promotion);
    if (piece === "K") this.castle = this.castle.replace(/[KQ]/g, "");
    if (piece === "k") this.castle = this.castle.replace(/[kq]/g, "");
    for (const [index, right] of [
      [0, "q"],
      [7, "k"],
      [56, "Q"],
      [63, "K"],
    ])
      if (from === index || to === index)
        this.castle = this.castle.replace(right, "");
    this.ep = move.double ? (from + to) / 2 : -1;
    this.halfmove =
      piece.toLowerCase() === "p" || captured || move.enPassant
        ? 0
        : this.halfmove + 1;
    if (color === "b") this.fullmove++;
    this.turn = opposite(color);
    const square = (i) => "abcdefgh"[i % 8] + (8 - Math.floor(i / 8));
    this.log.push(
      `${square(from)}${captured || move.enPassant ? "×" : "–"}${square(to)}${move.promotion ? "=" + promotion.toUpperCase() : ""}${this.inCheck() ? "+" : ""}`,
    );
    const key = this.key();
    this.positions[key] = (this.positions[key] || 0) + 1;
    return true;
  }
  undo() {
    const previous = this.history.pop();
    if (!previous) return false;
    const history = this.history;
    Object.assign(this, previous);
    this.history = history;
    return true;
  }
  outcome() {
    const legal = this.legal();
    if (!legal.length)
      return this.inCheck()
        ? { type: "checkmate", winner: opposite(this.turn) }
        : { type: "draw", reason: "Stalemate" };
    if (this.halfmove >= 100)
      return { type: "draw", reason: "Fifty-move rule" };
    if (this.positions[this.key()] >= 3)
      return { type: "draw", reason: "Threefold repetition" };
    const material = this.board.filter((p) => p && p.toLowerCase() !== "k");
    if (
      !material.length ||
      (material.length === 1 && ["b", "n"].includes(material[0].toLowerCase()))
    )
      return { type: "draw", reason: "Insufficient material" };
    return null;
  }
}
const values = { p: 100, n: 320, b: 335, r: 500, q: 900, k: 20000 };
export function bestChessMove(state, maxDepth = 3, budget = 250) {
  const root = new ChessEngine(state),
    deadline = Date.now() + budget;
  let best = null,
    nodes = 0,
    expired = false;
  const score = (game) =>
    game.board.reduce((n, p, i) => {
      if (!p) return n;
      const color = pieceColor(p),
        type = p.toLowerCase(),
        x = i % 8,
        y = Math.floor(i / 8),
        center = 7 - Math.abs(3.5 - x) - Math.abs(3.5 - y),
        advance = color === "w" ? 6 - y : y - 1;
      const v =
        values[type] +
        (type === "p" ? advance * 5 : type === "k" ? 0 : center * 4);
      return n + (color === game.turn ? v : -v);
    }, 0);
  const search = (game, depth, alpha, beta) => {
    nodes++;
    if ((nodes & 127) === 0 && Date.now() > deadline) {
      expired = true;
      return score(game);
    }
    const moves = game.legal();
    if (!moves.length) return game.inCheck() ? -100000 - depth : 0;
    if (depth === 0) return score(game);
    moves.sort(
      (a, b) =>
        (values[game.board[b.to]?.toLowerCase()] || 0) -
        (values[game.board[a.to]?.toLowerCase()] || 0),
    );
    let value = -Infinity;
    for (const move of moves) {
      const next = new ChessEngine(game.export());
      next.move(move.from, move.to, "q", false);
      const s = -search(next, depth - 1, -beta, -alpha);
      value = Math.max(value, s);
      alpha = Math.max(alpha, s);
      if (alpha >= beta || expired) break;
    }
    return value;
  };
  const moves = root.legal();
  for (let depth = 1; depth <= maxDepth; depth++) {
    let scoreBest = -Infinity,
      candidate = null;
    for (const move of moves) {
      const next = new ChessEngine(root.export());
      next.move(move.from, move.to, "q", false);
      const score = -search(next, depth - 1, -Infinity, Infinity);
      if (score > scoreBest) {
        scoreBest = score;
        candidate = move;
      }
      if (expired) break;
    }
    if (candidate && !expired) best = candidate;
    if (expired) break;
  }
  return { move: best || moves[0] || null, nodes };
}

export class MahjongEngine {
  constructor(seed = Date.now()) {
    this.rng = seededRandom(seed);
    this.tiles = [];
    for (let y = 0; y < 6; y++)
      for (let x = 0; x < 8; x++)
        this.tiles.push({ id: this.tiles.length, x, y, z: 0, removed: false });
    for (let y = 1; y < 5; y++)
      for (let x = 2; x < 6; x++)
        this.tiles.push({
          id: this.tiles.length,
          x: x - 0.08,
          y: y - 0.08,
          z: 1,
          removed: false,
        });
    for (let y = 2; y < 4; y++)
      for (let x = 3; x < 5; x++)
        this.tiles.push({
          id: this.tiles.length,
          x: x - 0.16,
          y: y - 0.16,
          z: 2,
          removed: false,
        });
    this.assignPairs();
    this.moves = 0;
    this.history = [];
  }
  available(tile) {
    if (tile.removed) return false;
    const overlaps = (a, b) =>
      Math.abs(a.x - b.x) < 0.99 && Math.abs(a.y - b.y) < 0.99;
    if (this.tiles.some((t) => !t.removed && t.z > tile.z && overlaps(t, tile)))
      return false;
    const left = this.tiles.some(
        (t) =>
          !t.removed &&
          t.z === tile.z &&
          Math.abs(t.y - tile.y) < 0.1 &&
          Math.abs(t.x - (tile.x - 1)) < 0.1,
      ),
      right = this.tiles.some(
        (t) =>
          !t.removed &&
          t.z === tile.z &&
          Math.abs(t.y - tile.y) < 0.1 &&
          Math.abs(t.x - (tile.x + 1)) < 0.1,
      );
    return !left || !right;
  }
  assignPairs() {
    const original = this.tiles.map((t) => ({
        removed: t.removed,
        value: t.value,
      })),
      order = [],
      dead = new Set();
    let visits = 0;
    const search = () => {
      if (++visits > 20000) return false;
      const remaining = this.tiles.filter((t) => !t.removed);
      if (!remaining.length) return true;
      const key = remaining.map((t) => t.id).join(",");
      if (dead.has(key)) return false;
      const available = shuffle(
        remaining.filter((t) => this.available(t)),
        this.rng,
      ).sort((a, b) => b.z - a.z);
      if (available.length < 2) {
        dead.add(key);
        return false;
      }
      for (let i = 0; i < available.length; i++)
        for (let j = i + 1; j < available.length; j++) {
          const a = available[i],
            b = available[j];
          a.removed = b.removed = true;
          order.push([a.id, b.id]);
          if (search()) return true;
          order.pop();
          a.removed = b.removed = false;
          if (visits > 20000) return false;
        }
      dead.add(key);
      return false;
    };
    const solved = search();
    this.tiles.forEach((tile, i) => {
      tile.removed = original[i].removed;
      tile.value = original[i].value;
    });
    if (!solved) return false;
    const values = shuffle(
      order.map((_, i) => i % 17),
      this.rng,
    );
    order.forEach(
      ([a, b], i) => (this.tiles[a].value = this.tiles[b].value = values[i]),
    );
    this.solution = order;
    return true;
  }

  match(a, b) {
    const first = this.tiles[a],
      second = this.tiles[b];
    if (
      a === b ||
      !first ||
      !second ||
      !Number.isInteger(first.value) ||
      first.value !== second.value ||
      !this.available(first) ||
      !this.available(second)
    )
      return false;
    this.history.push([a, b]);
    first.removed = second.removed = true;
    this.moves++;
    return true;
  }
  undo() {
    const pair = this.history.pop();
    if (!pair) return false;
    for (const id of pair) this.tiles[id].removed = false;
    this.moves--;
    return true;
  }
  hint() {
    const available = this.tiles.filter((t) => this.available(t));
    for (let i = 0; i < available.length; i++)
      for (let j = i + 1; j < available.length; j++)
        if (available[i].value === available[j].value)
          return [available[i].id, available[j].id];
    return null;
  }
  get won() {
    return this.tiles.every((t) => t.removed);
  }
}
