import { bestChessMove } from "./engines.js";
self.onmessage = (event) => {
  const { state, depth, budget, id } = event.data;
  try {
    self.postMessage({ id, ...bestChessMove(state, depth, budget) });
  } catch (error) {
    self.postMessage({ id, error: error.message });
  }
};
