import { h, icon, button, menuBar, statusBar, field } from "../ui/index.js";
import {
  MinesweeperEngine,
  SolitaireEngine,
  HeartsEngine,
  ChessEngine,
  MahjongEngine,
  pieceColor,
  bestChessMove,
  SUITS,
  rankLabel,
  isRed,
  shuffle,
} from "./engines.js";

export function launch(d, id, args = {}) {
  if (id === "games") return gamesExplorer(d);
  if (id === "minesweeper") return minesweeper(d);
  if (["solitaire", "freecell", "spider"].includes(id)) return solitaire(d, id);
  if (id === "hearts") return hearts(d);
  if (id === "chess") return chess(d);
  if (id === "mahjong") return mahjong(d);
  if (id === "purble") return purble(d);
  if (id === "inkball") return inkball(d);
}
function gamesExplorer(d) {
  const win = d.wm.create({
      title: "Games",
      icon: "games",
      appId: "games",
      width: 775,
      height: 530,
      remember: true,
    }),
    grid = h("div", { class: "games-explorer" });
  for (const app of d.apps.filter(
    (a) => a.category === "Games" && a.id !== "games",
  ))
    grid.append(
      button(
        [icon(app.icon, 80), h("span", {}, app.name)],
        () => d.open(app.id),
        "game-cover",
      ),
    );
  win.body.append(
    h(
      "div",
      { class: "toolbar" },
      h("span", { style: { padding: "3px 8px" } }, "Games Explorer"),
      h("span", { class: "spacer" }),
      button(
        "Options",
        () =>
          d.dialog.message(
            "Games",
            "Double-click or select a game to play. Each game has its own difficulty, rules, and New Game command.",
          ),
        "toolbar-button",
      ),
    ),
    grid,
    statusBar("9 games", "Select a game to play."),
  );
  return win;
}

function minesweeper(d) {
  const levels = {
    Beginner: [9, 9, 10],
    Intermediate: [16, 16, 40],
    Expert: [30, 16, 99],
  };
  let difficulty = d.settings.get("mineDifficulty", "Beginner"),
    engine = new MinesweeperEngine(...(levels[difficulty] || levels.Beginner)),
    finished = false;
  const win = d.wm.create({
      title: "Minesweeper",
      icon: "games",
      appId: "minesweeper",
      width: 365,
      height: 415,
      resizable: true,
    }),
    board = h("div", {
      class: "mine-board",
      role: "grid",
      "aria-label": "Minesweeper board",
    }),
    mines = h("div", { class: "mine-counter" }),
    time = h("div", { class: "mine-counter" }),
    reset = button("☺", () => fresh(), "mine-reset", {
      title: "New game",
      "aria-label": "New game",
    }),
    footer = h("div", { class: "game-footer" }),
    stage = h(
      "div",
      { class: "minesweeper-layout" },
      h("div", { class: "mine-header" }, mines, reset, time),
      board,
      footer,
    );
  const fit = () => {
    const mobile = innerWidth <= 650,
      cell = mobile ? 26 : 30;
    win.rect.width = Math.min(
      innerWidth,
      Math.max(340, engine.width * cell + 55),
    );
    win.rect.height = Math.min(innerHeight - 34, engine.height * cell + 146);
    d.wm.clamp(win);
    d.wm.applyRect(win);
  };
  const fresh = (level) => {
    if (level) {
      difficulty = level;
      d.settings.set("mineDifficulty", level);
    }
    engine = new MinesweeperEngine(...levels[difficulty]);
    finished = false;
    fit();
    render();
  };
  const render = () => {
    mines.textContent = String(engine.mineCount - engine.flags).padStart(
      3,
      "0",
    );
    time.textContent = String(engine.seconds).padStart(3, "0");
    reset.textContent =
      engine.status === "lost" ? "☹" : engine.status === "won" ? "☻" : "☺";
    board.style.gridTemplateColumns = `repeat(${engine.width},1fr)`;
    board.replaceChildren();
    engine.cells.forEach((c, i) => {
      const visible = c.mark === 1,
        showMine = engine.status === "lost" && c.mine,
        text = showMine
          ? "✹"
          : c.mark === 2
            ? "⚑"
            : c.mark === 3
              ? "?"
              : visible && c.count
                ? String(c.count)
                : "";
      const el = button(
        text,
        () => {
          engine.reveal(i);
          render();
        },
        `mine-cell ${visible ? "revealed n" + c.count : ""} ${i === engine.exploded ? "exploded" : ""}`,
        {
          role: "gridcell",
          "aria-label": `${visible ? (c.mine ? "Mine" : c.count + " adjacent mines") : c.mark === 2 ? "Flagged" : "Unopened"}; row ${Math.floor(i / engine.width) + 1}, column ${(i % engine.width) + 1}`,
        },
      );
      el.oncontextmenu = (e) => {
        e.preventDefault();
        engine.flag(i);
        render();
      };
      el.ondblclick = (e) => {
        e.preventDefault();
        engine.chord(i);
        render();
      };
      let longPress;
      el.onpointerdown = (e) => {
        if (e.pointerType === "touch")
          longPress = setTimeout(() => {
            engine.flag(i);
            render();
          }, 450);
      };
      el.onpointerup = () => clearTimeout(longPress);
      el.onpointercancel = () => clearTimeout(longPress);
      board.append(el);
    });
    footer.replaceChildren(
      h("span", {}, difficulty),
      h(
        "span",
        {},
        engine.status === "won"
          ? "You won!"
          : engine.status === "lost"
            ? "Game over"
            : `${engine.mineCount} mines`,
      ),
    );
    if (!finished && ["won", "lost"].includes(engine.status)) {
      finished = true;
      const stats = d.settings.get("mineStats", {}),
        s = stats[difficulty] || { played: 0, won: 0, best: null };
      s.played++;
      if (engine.status === "won") {
        s.won++;
        s.best =
          s.best == null ? engine.seconds : Math.min(s.best, engine.seconds);
      }
      stats[difficulty] = s;
      d.settings.set("mineStats", stats);
    }
  };
  win.body.append(
    menuBar([
      {
        label: "Game",
        items: () => [
          { label: "New Game", shortcut: "F2", action: () => fresh() },
          null,
          ...Object.keys(levels).map((level) => ({
            label: level,
            checked: difficulty === level,
            action: () => fresh(level),
          })),
          null,
          {
            label: "Statistics",
            action: () => {
              const s = d.settings.get("mineStats", {})[difficulty] || {
                played: 0,
                won: 0,
                best: null,
              };
              d.dialog.message(
                "Minesweeper Statistics",
                `${difficulty}\nGames played: ${s.played}\nGames won: ${s.won}\nBest time: ${s.best == null ? "—" : s.best + " seconds"}`,
              );
            },
          },
          { label: "Exit", action: () => win.close() },
        ],
      },
      {
        label: "Help",
        items: [
          {
            label: "How to Play",
            action: () =>
              d.dialog.message(
                "Minesweeper",
                "Find all the empty squares without uncovering a mine.\nNumbers show how many mines touch that square.\nRight-click or touch and hold to flag a mine.\nClick a revealed number to uncover adjacent squares when the correct number of flags surrounds it.\nYour first click is always safe.",
              ),
          },
        ],
      },
    ]),
    stage,
  );
  const timer = setInterval(
    () => (time.textContent = String(engine.seconds).padStart(3, "0")),
    1000,
  );
  win.onCleanup(() => clearInterval(timer));
  win.el.onkeydown = (e) => {
    if (e.key === "F2") {
      e.preventDefault();
      fresh();
    }
  };
  fit();
  render();
  return win;
}

function cardVisual(card) {
  const rank = rankLabel(card.rank),
    suit = SUITS[card.suit];
  return [
    h("span", { class: "rank" }, h("span", {}, rank), h("span", {}, suit)),
    h("span", { class: "suit-center" }, suit),
    h(
      "span",
      { class: "rank bottom" },
      h("span", {}, rank),
      h("span", {}, suit),
    ),
  ];
}
function solitaire(d, mode) {
  const name = {
    solitaire: "Solitaire",
    freecell: "FreeCell",
    spider: "Spider Solitaire",
  }[mode];
  let seed = Date.now(),
    suits = 1,
    engine = new SolitaireEngine(mode, seed, suits),
    selected = null,
    winnerShown = false;
  const win = d.wm.create({
      title: name,
      icon: mode === "solitaire" ? "solitaire" : mode,
      appId: mode,
      width: mode === "spider" ? 990 : mode === "freecell" ? 845 : 775,
      height: 590,
      remember: true,
    }),
    board = h("div", {
      class: "solitaire-board",
      "aria-label": name + " table",
    }),
    status = statusBar("");
  const fresh = (same = false) => {
    if (!same) seed = Date.now();
    engine = new SolitaireEngine(mode, seed, suits);
    selected = null;
    winnerShown = false;
    render();
  };
  const move = (to) => {
    if (selected && engine.move(selected, to)) {
      selected = null;
      render();
      return true;
    }
    return false;
  };
  function dropTarget(el, to) {
    el.ondragover = (e) => {
      if (e.dataTransfer.types.includes("application/x-vista-card")) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }
    };
    el.ondrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        const data = JSON.parse(
          e.dataTransfer.getData("application/x-vista-card"),
        );
        if (data.window !== win.id) return;
        selected = data.ref;
        move(to);
      } catch {}
    };
  }
  function cardNode(card, ref, offset = 0) {
    const el = button(
      card.faceUp ? cardVisual(card) : [],
      (e) => {
        e.stopPropagation();
        if (!card.faceUp) return;
        if (selected && move({ kind: ref.kind, pile: ref.pile })) return;
        selected =
          selected &&
          selected.kind === ref.kind &&
          selected.pile === ref.pile &&
          selected.index === ref.index
            ? null
            : ref;
        updateSelection();
      },
      "card" +
        (isRed(card) ? " red" : "") +
        (!card.faceUp ? " back" : "") +
        (selected &&
        selected.kind === ref.kind &&
        selected.pile === ref.pile &&
        ref.index >= selected.index
          ? " selected"
          : ""),
      {
        "data-kind": ref.kind,
        "data-pile": ref.pile ?? 0,
        "data-index": ref.index,
        style: { top: offset + "px" },
        "aria-label": card.faceUp
          ? `${rankLabel(card.rank)} of ${["spades", "hearts", "clubs", "diamonds"][card.suit]}`
          : "Face down card",
      },
    );
    el.draggable = card.faceUp;
    el.ondragstart = (e) => {
      if (!engine.validRun(engine.cards(ref))) {
        e.preventDefault();
        return;
      }
      selected = ref;
      e.dataTransfer.setData(
        "application/x-vista-card",
        JSON.stringify({ window: win.id, ref }),
      );
      e.dataTransfer.effectAllowed = "move";
    };
    el.ondblclick = (e) => {
      e.stopPropagation();
      if (engine.autoFoundation(ref)) {
        selected = null;
        render();
      }
    };
    dropTarget(el, { kind: ref.kind, pile: ref.pile });
    return el;
  }
  const updateSelection = () => {
    for (const el of board.querySelectorAll(".card[data-kind]"))
      el.classList.toggle(
        "selected",
        !!selected &&
          el.dataset.kind === selected.kind &&
          Number(el.dataset.pile) === (selected.pile ?? 0) &&
          Number(el.dataset.index) >= selected.index,
      );
  };
  function makePile(kind, pile, style = {}) {
    const ref = { kind, pile },
      cards = engine.pile(ref),
      el = h("div", {
        class: "card-pile " + (kind === "foundations" ? "foundation" : ""),
        style,
        "data-suit": kind === "foundations" ? SUITS[pile] : "",
      });
    el.onclick = () => move(ref);
    dropTarget(el, ref);
    if (cards?.length) {
      const index = cards.length - 1;
      el.append(cardNode(cards[index], { kind, pile, index }));
    }
    return el;
  }
  const hint = () => {
    const hints = engine.hints();
    if (hints.length) {
      selected = hints[0].from;
      render();
      status.textContent = `Hint: Move the highlighted card${engine.cards(selected).length > 1 ? "s" : ""} to ${hints[0].to.kind === "foundations" ? "a foundation" : hints[0].to.kind === "cells" ? "an empty free cell" : "column " + (hints[0].to.pile + 1)}.`;
    } else if (engine.state.stock.length || engine.state.waste.length)
      status.textContent = "Hint: Click the stock pile to deal cards.";
    else
      status.textContent =
        "No legal moves remain. Try Undo or start a new game.";
  };
  const autocomplete = () => {
    let count = 0,
      changed = true;
    while (changed && count < 52) {
      changed = false;
      for (const hint of engine.hints())
        if (hint.to.kind === "foundations") {
          engine.move(hint.from, hint.to);
          count++;
          changed = true;
          break;
        }
    }
    selected = null;
    render();
    if (!count)
      status.textContent = "No cards can be moved to the foundations yet.";
  };
  function render() {
    board.replaceChildren();
    const top = h("div", { class: "solitaire-top" }),
      table = h("div", { class: "solitaire-tableau" });
    if (mode === "freecell") {
      top.style.gridTemplateColumns = "repeat(8,minmax(48px,1fr))";
      table.style.gridTemplateColumns = "repeat(8,minmax(48px,1fr))";
      for (let i = 0; i < 4; i++) top.append(makePile("cells", i));
      for (let i = 0; i < 4; i++) top.append(makePile("foundations", i));
    } else {
      const stock = h("div", {
        class: "card-pile",
        title: "Deal cards",
        "aria-label": "Deal cards",
        role: "button",
        tabIndex: 0,
      });
      stock.onclick = () => {
        if (
          !engine.draw() &&
          mode === "spider" &&
          engine.state.tableau.some((p) => !p.length)
        )
          d.dialog.message(
            name,
            "Place a card in every empty column before dealing a new row.",
          );
        selected = null;
        render();
      };
      stock.onkeydown = (e) => {
        if (e.key === "Enter" || e.key === " ") stock.click();
      };
      if (engine.state.stock.length)
        stock.append(h("div", { class: "card back" }));
      else stock.append(h("div", { class: "stock-empty" }, "↻"));
      top.append(stock);
      if (mode === "solitaire") {
        top.append(makePile("waste", 0), h("div", {}));
        for (let i = 0; i < 4; i++) top.append(makePile("foundations", i));
      } else {
        top.style.gridTemplateColumns = "repeat(10,minmax(46px,1fr))";
        table.style.gridTemplateColumns = "repeat(10,minmax(46px,1fr))";
        top.append(
          h(
            "div",
            {
              style: { color: "#c2e2c9", padding: "12px 0", fontSize: "12px" },
            },
            engine.state.stock.length / 10 + " deals left",
          ),
        );
        for (let i = 0; i < engine.state.completed.length; i++) {
          const completed = engine.state.completed[i][0];
          top.append(
            h(
              "div",
              { class: "card-pile" },
              h("div", { class: "card" }, ...cardVisual(completed)),
            ),
          );
        }
      }
    }
    engine.state.tableau.forEach((cards, pile) => {
      const el = h("div", {
        class: "card-pile",
        style: {
          height:
            Math.max(
              190,
              cards.reduce((n, c) => n + (c.faceUp ? 24 : 13), 0) + 95,
            ) + "px",
        },
        "aria-label": "Column " + (pile + 1),
      });
      el.onclick = () => move({ kind: "tableau", pile });
      dropTarget(el, { kind: "tableau", pile });
      let offset = 0;
      cards.forEach((card, index) => {
        el.append(cardNode(card, { kind: "tableau", pile, index }, offset));
        offset += card.faceUp ? (innerWidth <= 650 ? 19 : 24) : 13;
      });
      table.append(el);
    });
    board.append(top, table);
    status.replaceChildren(
      h("span", {}, "Score: " + engine.score),
      h("span", {}, "Moves: " + engine.moves),
      h("span", { class: "spacer" }),
      h(
        "span",
        {},
        mode === "spider"
          ? `${suits} suit${suits === 1 ? "" : "s"} · ${engine.state.completed.length}/8 completed`
          : "Double-click a card to move it to a foundation.",
      ),
    );
    if (engine.won && !winnerShown) {
      winnerShown = true;
      d.playSound("start");
      d.dialog
        .message(name, `Congratulations! You won in ${engine.moves} moves.`, {
          buttons: [
            { label: "New Game", value: true, primary: true },
            { label: "Keep Playing", value: false },
          ],
        })
        .then((result) => {
          if (result) fresh();
        });
    }
  }
  win.body.append(
    menuBar([
      {
        label: "Game",
        items: () => [
          { label: "New Game", shortcut: "F2", action: () => fresh() },
          { label: "Restart This Game", action: () => fresh(true) },
          null,
          {
            label: "Undo",
            shortcut: "Ctrl+Z",
            disabled: !engine.history.length,
            action: () => {
              engine.undo();
              selected = null;
              render();
            },
          },
          { label: "Hint", shortcut: "H", action: hint },
          ...(mode !== "spider"
            ? [
                {
                  label: "Move Available Cards to Foundations",
                  action: autocomplete,
                },
              ]
            : []),
          null,
          ...(mode === "solitaire"
            ? [
                {
                  label: "Draw One",
                  checked: engine.drawCount === 1,
                  action: () => (engine.drawCount = 1),
                },
                {
                  label: "Draw Three",
                  checked: engine.drawCount === 3,
                  action: () => (engine.drawCount = 3),
                },
              ]
            : mode === "spider"
              ? [1, 2, 4].map((n) => ({
                  label: `${n} suit${n === 1 ? "" : "s"}`,
                  checked: suits === n,
                  action: () => {
                    suits = n;
                    fresh();
                  },
                }))
              : []),
          { label: "Exit", action: () => win.close() },
        ],
      },
      {
        label: "Help",
        items: [
          {
            label: "How to Play",
            action: () =>
              d.dialog.message(
                name,
                mode === "spider"
                  ? "Build descending same-suit runs from King to Ace. A complete run is removed. Deal a new row from the stock when all columns have cards."
                  : mode === "freecell"
                    ? "Move all cards to the foundations, starting with Aces. Build columns down in alternating colors. Use the four free cells to hold individual cards. Empty columns can hold any card."
                    : "Build the four foundations from Ace to King in suit. Build columns down in alternating colors. Only a King can start an empty column. Click the stock to draw.\nClick a card, then its destination; drag and drop also works.",
              ),
          },
        ],
      },
    ]),
    board,
    status,
  );
  win.el.addEventListener("keydown", (e) => {
    if (e.key === "F2") {
      e.preventDefault();
      fresh();
    }
    if (e.key.toLowerCase() === "h") hint();
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      engine.undo();
      selected = null;
      render();
    }
  });
  render();
  return win;
}

function hearts(d) {
  let engine = new HeartsEngine(),
    selected = [],
    pending = null;
  const win = d.wm.create({
      title: "Hearts",
      icon: "hearts",
      appId: "hearts",
      width: 825,
      height: 595,
      remember: true,
    }),
    board = h("div", { class: "hearts-board" }),
    status = statusBar("");
  const names = ["You", "West", "North", "East"];
  const schedule = () => {
    clearTimeout(pending);
    if (win.closed) return;
    if (engine.phase === "collect")
      pending = setTimeout(() => {
        engine.collect();
        render();
      }, 900);
    else if (engine.phase === "playing" && engine.turn !== 0)
      pending = setTimeout(() => {
        const card = engine.ai();
        if (card) engine.play(card.id);
        render();
      }, 350);
  };
  const fresh = () => {
    engine = new HeartsEngine();
    selected = [];
    render();
  };
  const render = () => {
    board.replaceChildren();
    const scores = h("div", { class: "hearts-scores" });
    for (let i = 0; i < 4; i++)
      scores.append(
        h(
          "div",
          {
            class:
              engine.turn === i && engine.phase === "playing" ? "active" : "",
          },
          h("b", {}, names[i]),
          h("span", {}, `${engine.scores[i]} pts`),
          h("small", {}, `${engine.hands[i].length} cards`),
        ),
      );
    board.append(scores);
    const center = h("div", { class: "hearts-center" });
    for (const trick of engine.trick) {
      const card = h(
        "div",
        {
          class: "card " + (isRed(trick.card) ? "red" : ""),
          style: { position: "relative", width: "76px", height: "102px" },
        },
        ...cardVisual(trick.card),
      );
      center.append(
        h(
          "div",
          { style: { textAlign: "center", color: "white" } },
          h("div", { style: { marginBottom: "8px" } }, names[trick.player]),
          card,
        ),
      );
    }
    if (!engine.trick.length)
      center.append(
        h(
          "div",
          { class: "hearts-message" },
          engine.phase === "passing"
            ? [
                "",
                "Pass three cards to the left.",
                "Pass three cards to the right.",
                "Pass three cards across.",
              ][engine.round % 4]
            : engine.phase === "roundOver"
              ? "Round complete"
              : engine.phase === "over"
                ? "Game over"
                : names[engine.turn] + " leads.",
        ),
      );
    board.append(center);
    const hand = h("div", { class: "hearts-hand" }),
      legal = engine.turn === 0 ? engine.legal(0).map((c) => c.id) : [];
    engine.hands[0].forEach((card, i) => {
      const node = button(
        cardVisual(card),
        () => {
          if (engine.phase === "passing") {
            if (selected.includes(card.id))
              selected = selected.filter((id) => id !== card.id);
            else if (selected.length < 3) selected.push(card.id);
            render();
          } else if (engine.turn === 0 && engine.play(card.id)) {
            render();
          }
        },
        "card" +
          (isRed(card) ? " red" : "") +
          (selected.includes(card.id) ? " selected" : ""),
        {
          style: {
            left: `${i * 44}px`,
            top: selected.includes(card.id) ? "-15px" : "0",
            width: "72px",
            opacity:
              engine.phase === "playing" &&
              !legal.includes(card.id) &&
              engine.turn === 0
                ? ".6"
                : "1",
          },
          "aria-label": rankLabel(card.rank) + " of " + SUITS[card.suit],
        },
      );
      hand.append(node);
    });
    board.append(hand);
    if (engine.phase === "passing")
      board.append(
        button(
          "Pass Cards",
          () => {
            if (engine.pass(selected)) {
              selected = [];
              render();
            }
          },
          "vista-button hearts-action",
          { disabled: selected.length !== 3 },
        ),
      );
    if (engine.phase === "roundOver" || engine.phase === "over")
      board.append(
        button(
          engine.phase === "over" ? "New Game" : "Next Round",
          () => {
            if (engine.phase === "over") fresh();
            else {
              engine.nextRound();
              selected = [];
              render();
            }
          },
          "vista-button hearts-action",
        ),
      );
    status.textContent = `Round ${engine.round} · ${engine.broken ? "Hearts broken" : "Hearts not broken"} · This round: ${names.map((n, i) => n + " " + engine.roundScores[i]).join(" / ")}`;
    schedule();
  };
  win.body.append(
    menuBar([
      {
        label: "Game",
        items: [
          { label: "New Game", shortcut: "F2", action: fresh },
          { label: "Exit", action: () => win.close() },
        ],
      },
      {
        label: "Help",
        items: [
          {
            label: "How to Play",
            action: () =>
              d.dialog.message(
                "Hearts",
                "Avoid taking hearts (1 point each) and the Queen of Spades (13 points). The lowest score wins.\nFollow the suit led if possible. Hearts cannot be led until broken, unless you have only hearts.\nPass three cards before each round; every fourth round has no pass.\nTaking all 26 points gives each opponent 26 points.",
              ),
          },
        ],
      },
    ]),
    board,
    status,
  );
  win.onCleanup(() => clearTimeout(pending));
  bindNewGame(win, fresh);
  render();
  return win;
}

function chess(d) {
  let engine = new ChessEngine(),
    selected = null,
    twoPlayer = false,
    depth = 2,
    busy = false,
    generation = 0,
    worker = null;
  const win = d.wm.create({
      title: "Chess Titans",
      icon: "chess",
      appId: "chess",
      width: 735,
      height: 627,
      remember: true,
    }),
    stage = h("div", { class: "chess-stage" }),
    board = h("div", { class: "chess-board", "aria-label": "Chess board" }),
    side = h("div", { class: "chess-side" }),
    status = statusBar("White to move");
  const pieces = {
    K: "♔",
    Q: "♕",
    R: "♖",
    B: "♗",
    N: "♘",
    P: "♙",
    k: "♚",
    q: "♛",
    r: "♜",
    b: "♝",
    n: "♞",
    p: "♟",
  };
  const fresh = () => {
    generation++;
    busy = false;
    worker?.terminate();
    worker = null;
    engine = new ChessEngine();
    selected = null;
    render();
  };
  const ai = () => {
    if (
      twoPlayer ||
      engine.turn !== "b" ||
      engine.outcome() ||
      busy ||
      win.closed
    )
      return;
    busy = true;
    const id = ++generation,
      state = engine.export();
    status.textContent = "Black is thinking…";
    const receive = (result) => {
      if (id !== generation || win.closed) return;
      if (result.error) result = bestChessMove(state, 1, 100);
      busy = false;
      if (result.move) {
        engine.move(result.move.from, result.move.to, "q");
        render();
      } else {
        render(false);
        status.textContent =
          "The computer could not choose a move. Use Undo or New Game to continue.";
      }
    };
    try {
      const taskWorker = new Worker(
        new URL("./chess-worker.js", import.meta.url),
        { type: "module" },
      );
      worker = taskWorker;
      taskWorker.onmessage = (e) => {
        taskWorker.terminate();
        if (worker === taskWorker) worker = null;
        if (e.data.id === id) receive(e.data);
      };
      taskWorker.onerror = () => {
        taskWorker.terminate();
        if (worker === taskWorker) worker = null;
        receive(bestChessMove(state, 1, 100));
      };
      taskWorker.postMessage({
        id,
        state,
        depth,
        budget: depth === 3 ? 500 : 250,
      });
    } catch {
      setTimeout(() => receive(bestChessMove(state, 1, 100)), 10);
    }
  };

  const click = async (index) => {
    if (busy || engine.outcome() || (!twoPlayer && engine.turn === "b")) return;
    const moves = selected == null ? [] : engine.legal(selected),
      move = moves.find((m) => m.to === index);
    if (move) {
      const token = generation,
        current = engine;
      let promotion = "q";
      if (move.promotion) {
        busy = true;
        promotion = await d.dialog.message(
          "Pawn Promotion",
          "Choose a piece for your pawn.",
          {
            buttons: [
              { label: "Queen", value: "q", primary: true },
              { label: "Rook", value: "r" },
              { label: "Bishop", value: "b" },
              { label: "Knight", value: "n" },
            ],
          },
        );
        if (win.closed || token !== generation || engine !== current) return;
        busy = false;
        if (!promotion) return;
      }
      engine.move(move.from, move.to, promotion);
      selected = null;
      render();
    } else {
      selected = pieceColor(engine.board[index]) === engine.turn ? index : null;
      render(false);
    }
  };
  const render = (runAI = true) => {
    board.replaceChildren();
    const legal =
      selected == null ? [] : engine.legal(selected).map((m) => m.to);
    engine.board.forEach((piece, index) => {
      const row = Math.floor(index / 8),
        col = index % 8,
        node = button(
          piece ? pieces[piece] : "",
          () => click(index),
          "chess-cell" +
            ((row + col) % 2 ? " dark" : "") +
            (selected === index ? " selected" : "") +
            (legal.includes(index) ? " possible" : ""),
          {
            "aria-label": `${"abcdefgh"[col]}${8 - row}${piece ? " " + (pieceColor(piece) === "w" ? "White" : "Black") + " " + { k: "king", q: "queen", r: "rook", b: "bishop", n: "knight", p: "pawn" }[piece.toLowerCase()] : " empty"}`,
          },
        );
      if (piece && pieceColor(piece) === "w") node.style.color = "#fff8e4";
      else node.style.color = "#27231e";
      board.append(node);
    });
    side.replaceChildren(
      h("h2", {}, "Chess Titans"),
      h(
        "p",
        {},
        twoPlayer
          ? "Two players"
          : `You play White\n${depth === 1 ? "Easy" : depth === 2 ? "Medium" : "Hard"} opponent`,
      ),
      h(
        "div",
        { class: "chess-moves" },
        ...engine.log.map((text, i) =>
          h(
            "div",
            {},
            i % 2 === 0 ? Math.floor(i / 2) + 1 + ". " + text : "   " + text,
          ),
        ),
      ),
      button(
        "Undo",
        () => {
          generation++;
          busy = false;
          worker?.terminate();
          worker = null;
          engine.undo();
          if (!twoPlayer && engine.turn === "b") engine.undo();
          selected = null;
          render();
        },
        "vista-button",
      ),
      button("New Game", fresh, "vista-button"),
    );
    const outcome = engine.outcome();
    status.textContent = outcome
      ? outcome.type === "checkmate"
        ? `${outcome.winner === "w" ? "White" : "Black"} wins by checkmate.`
        : `Draw — ${outcome.reason}`
      : `${engine.turn === "w" ? "White" : "Black"} to move${engine.inCheck() ? " — Check!" : ""}`;
    if (runAI) ai();
  };
  win.body.append(
    menuBar([
      {
        label: "Game",
        items: () => [
          { label: "New Game", shortcut: "F2", action: fresh },
          {
            label: "Two Players",
            checked: twoPlayer,
            action: () => {
              twoPlayer = !twoPlayer;
              fresh();
            },
          },
          null,
          ...[1, 2, 3].map((n) => ({
            label: ["", "Easy", "Medium", "Hard"][n],
            checked: depth === n,
            action: () => {
              depth = n;
              fresh();
            },
          })),
          null,
          { label: "Exit", action: () => win.close() },
        ],
      },
      {
        label: "Help",
        items: [
          {
            label: "How to Play",
            action: () =>
              d.dialog.message(
                "Chess Titans",
                "Select a piece to see its legal moves, then select a destination.\nCastling, en passant, pawn promotion, check, checkmate, stalemate, repetition, and the fifty-move rule are implemented.\nPlay against the computer or switch to Two Players.",
              ),
          },
        ],
      },
    ]),
    stage,
    status,
  );
  stage.append(board, side);
  win.onCleanup(() => {
    generation++;
    worker?.terminate();
  });
  bindNewGame(win, fresh);
  render();
  return win;
}

function mahjong(d) {
  let engine = new MahjongEngine(),
    selected = null,
    hints = [];
  const win = d.wm.create({
      title: "Mahjong Titans",
      icon: "games",
      appId: "mahjong",
      width: 720,
      height: 575,
      remember: true,
    }),
    stage = h("div", { class: "puzzle-stage" }),
    board = h("div", { class: "mahjong-stack" }),
    status = statusBar("");
  const symbols = [
    "一",
    "二",
    "三",
    "四",
    "五",
    "六",
    "七",
    "八",
    "九",
    "東",
    "南",
    "西",
    "北",
    "中",
    "發",
    "白",
    "春",
  ];
  const fresh = () => {
    engine = new MahjongEngine();
    selected = null;
    hints = [];
    render();
  };
  const render = () => {
    board.replaceChildren();
    for (const tile of engine.tiles) {
      if (tile.removed) continue;
      const available = engine.available(tile),
        node = button(
          symbols[tile.value],
          () => {
            if (!available) return;
            if (selected != null && engine.match(selected, tile.id)) {
              selected = null;
              hints = [];
            } else selected = selected === tile.id ? null : tile.id;
            render();
          },
          "mahjong-tile" +
            (selected === tile.id || hints.includes(tile.id)
              ? " selected"
              : ""),
          {
            style: {
              position: "absolute",
              left: tile.x * 57 + tile.z * 3 + "px",
              top: tile.y * 65 - tile.z * 4 + "px",
              width: "54px",
              height: "63px",
              zIndex: tile.z * 100 + tile.id,
              color:
                tile.value > 12
                  ? "#ab3524"
                  : tile.value > 8
                    ? "#164686"
                    : "#276749",
              filter: available ? "none" : "brightness(.82)",
            },
            "aria-label": `${symbols[tile.value]} ${available ? "available" : "blocked"}`,
          },
        );
      board.append(node);
    }
    status.textContent = engine.won
      ? "Congratulations! You cleared the board."
      : `${engine.tiles.filter((t) => !t.removed).length} tiles remaining · ${engine.moves} pairs matched`;
  };
  win.body.append(
    menuBar([
      {
        label: "Game",
        items: [
          { label: "New Game", shortcut: "F2", action: fresh },
          {
            label: "Undo",
            action: () => {
              engine.undo();
              selected = null;
              render();
            },
          },
          {
            label: "Hint",
            action: () => {
              hints = engine.hint() || [];
              render();
              if (!hints.length)
                status.textContent =
                  "No matching free tiles. Shuffle to continue.";
            },
          },
          {
            label: "Shuffle Remaining Tiles",
            action: () => {
              const solved = engine.assignPairs();
              selected = null;
              hints = [];
              if (solved) engine.history = [];
              render();
              if (!solved)
                status.textContent =
                  "This arrangement cannot be shuffled. Use Undo to return to an earlier move.";
            },
          },
          { label: "Exit", action: () => win.close() },
        ],
      },
      {
        label: "Help",
        items: [
          {
            label: "How to Play",
            action: () =>
              d.dialog.message(
                "Mahjong Titans",
                "Match two identical free tiles.\nA tile is free when no other tile covers it and at least one side is open.\nClear all the tiles to win. Use Hint, Undo, or Shuffle if you get stuck.",
              ),
          },
        ],
      },
    ]),
    stage,
    status,
  );
  stage.append(board);
  bindNewGame(win, fresh);
  render();
  return win;
}

function purble(d) {
  const win = d.wm.create({
      title: "Purble Place",
      icon: "purble",
      appId: "purble",
      width: 650,
      height: 540,
      remember: true,
    }),
    stage = h("div", { class: "puzzle-stage" }),
    status = statusBar("Choose a game.");
  let mode = "menu",
    generation = 0;
  const symbols = ["☀", "☂", "★", "♫", "✿", "☘", "♠", "♥"];
  const menu = () => {
    generation++;
    mode = "menu";
    stage.replaceChildren(h("h1", {}, "Purble Place"));
    const options = h("div", { class: "purble-options" });
    for (const [name, description, action, glyph] of [
      ["Purble Pairs", "Find the matching pairs.", pairs, "♧"],
      ["Comfy Cakes", "Make each cake to order.", cakes, "♨"],
      ["Purble Shop", "Discover the hidden outfit.", shop, "☻"],
    ])
      options.append(
        button(
          [
            h("div", { class: "purble-glyph" }, glyph),
            h("h2", {}, name),
            h("p", {}, description),
          ],
          action,
          "purble-option",
        ),
      );
    stage.append(options);
    status.textContent =
      "Three games to exercise your memory, observation, and logic.";
  };
  function pairs() {
    mode = "pairs";
    const token = ++generation,
      cards = shuffle([...symbols, ...symbols]),
      matched = new Set();
    let revealed = [],
      moves = 0,
      locked = false;
    const draw = () => {
      stage.replaceChildren(h("h2", {}, "Purble Pairs"));
      const grid = h("div", { class: "memory-board" });
      cards.forEach((value, index) =>
        grid.append(
          button(
            matched.has(index) || revealed.includes(index) ? value : "?",
            () => {
              if (locked || matched.has(index) || revealed.includes(index))
                return;
              revealed.push(index);
              if (revealed.length === 2) {
                moves++;
                if (cards[revealed[0]] === cards[revealed[1]]) {
                  revealed.forEach((i) => matched.add(i));
                  revealed = [];
                } else {
                  locked = true;
                  setTimeout(() => {
                    if (token !== generation) return;
                    revealed = [];
                    locked = false;
                    draw();
                  }, 800);
                }
              }
              draw();
            },
            "memory-card" +
              (revealed.includes(index) ? " flipped" : "") +
              (matched.has(index) ? " matched" : ""),
          ),
        ),
      );
      stage.append(
        grid,
        button(
          matched.size === 16 ? "Play Again" : "New Game",
          pairs,
          "vista-button",
        ),
      );
      status.textContent =
        matched.size === 16
          ? `You found all the pairs in ${moves} turns!`
          : `${matched.size / 2}/8 pairs · ${moves} turns`;
    };
    draw();
  }
  function cakes() {
    mode = "cakes";
    generation++;
    let score = 0,
      recipe,
      chosen = [0, 0, 0];
    const options = [
        ["Round", "Square", "Heart"],
        ["Vanilla", "Chocolate", "Strawberry"],
        ["White icing", "Pink icing", "Chocolate icing"],
      ],
      colors = ["#f5dfaa", "#7a472c", "#eba4b7"];
    const newRecipe = () =>
      (recipe = options.map(() => Math.floor(Math.random() * 3)));
    newRecipe();
    const draw = () => {
      stage.replaceChildren(
        h("h2", {}, "Comfy Cakes"),
        h(
          "div",
          { class: "cake-order" },
          "Order: " + recipe.map((v, i) => options[i][v]).join(" · "),
        ),
      );
      const visual = h(
        "div",
        {
          class: "cake-preview",
          style: {
            borderRadius:
              chosen[0] === 0
                ? "50%"
                : chosen[0] === 1
                  ? "6px"
                  : "45% 45% 12% 12%",
            background: colors[chosen[1]],
            borderTop:
              "15px solid " + ["#fff5dd", "#f5a4ce", "#573326"][chosen[2]],
          },
        },
        "✦",
      );
      stage.append(visual);
      for (let i = 0; i < 3; i++) {
        const select = h(
          "select",
          { class: "vista-input" },
          options[i].map((label, j) =>
            h("option", { value: j, selected: chosen[i] === j }, label),
          ),
        );
        select.onchange = () => {
          chosen[i] = Number(select.value);
          draw();
        };
        stage.append(field(["Shape", "Cake", "Frosting"][i], select));
      }
      stage.append(
        button(
          "Deliver Cake",
          () => {
            if (chosen.every((v, i) => v === recipe[i])) {
              score++;
              newRecipe();
              draw();
              status.textContent = "Perfect! Cakes delivered: " + score;
            } else {
              status.textContent =
                "That cake does not match the order. Check the shape, flavor, and frosting.";
            }
          },
          "vista-button",
        ),
      );
    };
    draw();
    status.textContent =
      "Match every part of the order before delivering the cake.";
  }
  function shop() {
    mode = "shop";
    generation++;
    const categories = ["Hat", "Eyes", "Nose", "Shirt"],
      choices = [
        ["Blue", "Red", "Green"],
        ["Round", "Square", "Star"],
        ["Small", "Medium", "Large"],
        ["Blue", "Yellow", "Purple"],
      ],
      secret = categories.map(() => Math.floor(Math.random() * 3));
    let guess = [0, 0, 0, 0],
      attempts = 0;
    const history = h("div", { class: "purble-history" });
    stage.replaceChildren(
      h("h2", {}, "Purble Shop"),
      h(
        "p",
        {},
        "Find the secret outfit. Each check tells you how many features are correct.",
      ),
    );
    for (let i = 0; i < 4; i++) {
      const select = h(
        "select",
        { class: "vista-input" },
        choices[i].map((name, j) => h("option", { value: j }, name)),
      );
      select.onchange = () => (guess[i] = Number(select.value));
      stage.append(field(categories[i] + ":", select));
    }
    stage.append(
      button(
        "Check Outfit",
        () => {
          attempts++;
          const correct = guess.filter((v, i) => v === secret[i]).length;
          history.prepend(
            h(
              "div",
              {},
              `Try ${attempts}: ${guess.map((v, i) => choices[i][v]).join(", ")} — ${correct} of 4 correct`,
            ),
          );
          status.textContent =
            correct === 4
              ? `You found the outfit in ${attempts} tries!`
              : `${correct} features are correct. Change your guess and try again.`;
        },
        "vista-button",
      ),
      history,
      button("New Puzzle", shop, "vista-button"),
    );
    status.textContent = "Deduce the outfit using the clues.";
  }
  win.body.append(
    menuBar([
      {
        label: "Game",
        items: [
          { label: "Choose a Game", action: menu },
          { label: "Purble Pairs", action: pairs },
          { label: "Comfy Cakes", action: cakes },
          { label: "Purble Shop", action: shop },
          { label: "Exit", action: () => win.close() },
        ],
      },
      {
        label: "Help",
        items: [
          {
            label: "How to Play",
            action: () =>
              d.dialog.message(
                "Purble Place",
                "Purble Pairs: turn over two cards at a time and find every pair.\nComfy Cakes: match the shape, flavor, and frosting in each order.\nPurble Shop: discover all four hidden features from the feedback.",
              ),
          },
        ],
      },
    ]),
    stage,
    status,
  );
  win.onCleanup(() => generation++);
  menu();
  return win;
}

function inkball(d) {
  const win = d.wm.create({
      title: "InkBall",
      icon: "inkball",
      appId: "inkball",
      width: 650,
      height: 600,
      remember: true,
    }),
    stage = h("div", { class: "puzzle-stage" }),
    canvas = h("canvas", {
      class: "inkball-canvas",
      width: 560,
      height: 440,
      "aria-label": "InkBall play field",
    }),
    ctx = canvas.getContext("2d"),
    status = statusBar("Draw ink lines to guide balls into matching holes.");
  let balls = [],
    strokes = [],
    current = null,
    score = 0,
    level = 1,
    paused = false,
    last = 0,
    accumulator = 0,
    frame;
  const colors = ["#d84136", "#357bd8", "#e4af23", "#41974a"],
    holes = [
      { x: 40, y: 40, c: 0 },
      { x: 520, y: 40, c: 1 },
      { x: 40, y: 400, c: 2 },
      { x: 520, y: 400, c: 3 },
    ];
  const fresh = () => {
    strokes = [];
    score = 0;
    level = 1;
    spawn();
  };
  const spawn = () => {
    balls = Array.from({ length: 4 + level }, (_, i) => ({
      x: 200 + Math.random() * 150,
      y: 120 + Math.random() * 150,
      vx: (Math.random() - 0.5) * (110 + level * 12),
      vy: (Math.random() - 0.5) * (110 + level * 12),
      c: i % 4,
      r: 8,
    }));
  };
  const point = (e) => {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * 560) / r.width,
      y: ((e.clientY - r.top) * 440) / r.height,
    };
  };
  canvas.onpointerdown = (e) => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    current = { points: [point(e)], time: performance.now() };
    strokes.push(current);
  };
  canvas.onpointermove = (e) => {
    if (current) {
      const p = point(e),
        last = current.points.at(-1);
      if (Math.hypot(p.x - last.x, p.y - last.y) > 3) current.points.push(p);
    }
  };
  canvas.onpointerup = canvas.onpointercancel = () => (current = null);
  const step = (dt) => {
    for (const ball of balls) {
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      if (ball.x < ball.r) {
        ball.x = ball.r;
        ball.vx = Math.abs(ball.vx);
      }
      if (ball.x > 560 - ball.r) {
        ball.x = 560 - ball.r;
        ball.vx = -Math.abs(ball.vx);
      }
      if (ball.y < ball.r) {
        ball.y = ball.r;
        ball.vy = Math.abs(ball.vy);
      }
      if (ball.y > 440 - ball.r) {
        ball.y = 440 - ball.r;
        ball.vy = -Math.abs(ball.vy);
      }
      for (const line of strokes)
        for (let i = 1; i < line.points.length; i++) {
          const a = line.points[i - 1],
            b = line.points[i],
            dx = b.x - a.x,
            dy = b.y - a.y,
            length2 = dx * dx + dy * dy;
          if (length2 < 1) continue;
          const t = Math.max(
              0,
              Math.min(
                1,
                ((ball.x - a.x) * dx + (ball.y - a.y) * dy) / length2,
              ),
            ),
            nx = ball.x - (a.x + t * dx),
            ny = ball.y - (a.y + t * dy),
            dist = Math.hypot(nx, ny);
          if (dist < ball.r + 2 && dist > 0.01) {
            const ux = nx / dist,
              uy = ny / dist,
              dot = ball.vx * ux + ball.vy * uy;
            if (dot < 0) {
              ball.vx -= 2 * dot * ux;
              ball.vy -= 2 * dot * uy;
            }
            ball.x += ux * (ball.r + 2 - dist);
            ball.y += uy * (ball.r + 2 - dist);
          }
        }
      for (const hole of holes)
        if (Math.hypot(ball.x - hole.x, ball.y - hole.y) < 15) {
          ball.gone = true;
          score += ball.c === hole.c ? 100 : -50;
        }
    }
    balls = balls.filter((b) => !b.gone);
    if (!balls.length) {
      level++;
      spawn();
      strokes = [];
    }
    strokes = strokes.filter(
      (s) => s === current || performance.now() - s.time < 8000,
    );
  };
  const draw = (t) => {
    if (win.closed) return;
    const elapsed = Math.min(0.08, (t - (last || t)) / 1000);
    last = t;
    if (!paused && !win.minimized && !document.hidden) {
      accumulator += elapsed;
      while (accumulator >= 1 / 120) {
        step(1 / 120);
        accumulator -= 1 / 120;
      }
    }
    ctx.fillStyle = "#e1dcc5";
    ctx.fillRect(0, 0, 560, 440);
    ctx.strokeStyle = "#c9c4ab";
    ctx.lineWidth = 1;
    for (let x = 0; x < 560; x += 28) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 440);
      ctx.stroke();
    }
    for (let y = 0; y < 440; y += 28) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(560, y);
      ctx.stroke();
    }
    for (const hole of holes) {
      ctx.fillStyle = colors[hole.c];
      ctx.beginPath();
      ctx.arc(hole.x, hole.y, 22, 0, Math.PI * 2);
      ctx.fill();
      const g = ctx.createRadialGradient(hole.x, hole.y, 1, hole.x, hole.y, 16);
      g.addColorStop(0, "#000");
      g.addColorStop(1, "#1c2022");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(hole.x, hole.y, 16, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "#263345";
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    for (const s of strokes) {
      ctx.globalAlpha = Math.min(1, (8000 - (t - s.time)) / 1500);
      ctx.beginPath();
      s.points.forEach((p, i) =>
        i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y),
      );
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const ball of balls) {
      const gradient = ctx.createRadialGradient(
        ball.x - 3,
        ball.y - 3,
        0,
        ball.x,
        ball.y,
        9,
      );
      gradient.addColorStop(0, "#fff");
      gradient.addColorStop(0.35, colors[ball.c]);
      gradient.addColorStop(1, "#26303b");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      ctx.fill();
    }
    status.textContent = `Score: ${score} · Level: ${level} · ${balls.length} balls remaining${paused ? " · Paused" : ""}`;
    frame = requestAnimationFrame(draw);
  };
  win.body.append(
    menuBar([
      {
        label: "Game",
        items: () => [
          { label: "New Game", shortcut: "F2", action: fresh },
          {
            label: paused ? "Resume" : "Pause",
            action: () => (paused = !paused),
          },
          { label: "Clear Ink", action: () => (strokes = []) },
          { label: "Exit", action: () => win.close() },
        ],
      },
      {
        label: "Help",
        items: [
          {
            label: "How to Play",
            action: () =>
              d.dialog.message(
                "InkBall",
                "Draw ink lines to redirect the moving balls.\nGuide each ball into a hole of the same color for 100 points. Wrong holes lose 50 points.\nInk fades after eight seconds. Clear every ball to advance to the next level.",
              ),
          },
        ],
      },
    ]),
    stage,
    status,
  );
  stage.append(canvas);
  win.onCleanup(() => cancelAnimationFrame(frame));
  bindNewGame(win, fresh);
  fresh();
  frame = requestAnimationFrame(draw);
  return win;
}

function bindNewGame(win, fresh) {
  win.el.addEventListener("keydown", (e) => {
    if (e.key === "F2") {
      e.preventDefault();
      fresh();
    }
  });
}
