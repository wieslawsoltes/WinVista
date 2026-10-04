import test from "node:test";
import assert from "node:assert/strict";
import {
  CalculatorEngine,
  encodeRTF,
  decodeRTF,
  tokenizeCommand,
  splitCommands,
  floodFill,
} from "../packages/apps-accessories/engines.js";
import { filterPixels } from "../packages/renderer/index.js";
import {
  exportCalendar,
  importCalendar,
} from "../packages/apps-productivity/index.js";

test("Calculator chaining, unary operands, repeated equals, memory, and recovery", () => {
  const c = new CalculatorEngine();
  c.digit("2");
  c.operation("+");
  c.digit("9");
  c.unary("sqrt");
  c.operation("*");
  c.digit("4");
  c.equals();
  assert.equal(c.number(), 20);
  c.equals();
  assert.equal(c.number(), 80);
  c.memoryCommand("MS");
  c.clear();
  c.memoryCommand("MR");
  assert.equal(c.number(), 80);
  c.operation("/");
  c.digit("0");
  c.equals();
  assert.equal(c.error, true);
  c.digit("7");
  assert.equal(c.display, "7");
  assert.equal(c.error, false);
});
test("Calculator operator replacement and relative percentages", () => {
  const c = new CalculatorEngine();
  c.digit("2");
  c.operation("+");
  c.operation("*");
  c.digit("3");
  c.equals();
  assert.equal(c.number(), 6);
  c.clear();
  for (const n of "200") c.digit(n);
  c.operation("+");
  for (const n of "10") c.digit(n);
  c.unary("percent");
  c.equals();
  assert.equal(c.number(), 220);
});
test("Basic RTF round-trips Unicode including surrogate pairs, braces, and backslashes", () => {
  const text = "Hello 😀 — Zażółć\n日本語 {text} \\ end";
  assert.equal(decodeRTF(encodeRTF(text)), text);
});
test("Command quoting protects spaces and command separators", () => {
  assert.deepEqual(tokenizeCommand('copy "a b.txt" "c d.txt"'), [
    "copy",
    "a b.txt",
    "c d.txt",
  ]);
  assert.deepEqual(splitCommands('echo "a && b"&&dir && echo done'), [
    'echo "a && b"',
    "dir",
    "echo done",
  ]);
});
test("Flood fill stays within connected pixels and preserves separated regions", () => {
  const bytes = new Uint8ClampedArray([
    255, 255, 255, 255, 0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 255, 0,
    0, 0, 255, 255, 255, 255, 255,
  ]);
  floodFill(bytes, 3, 2, 0, 0, [255, 0, 0, 255]);
  assert.deepEqual([...bytes.slice(0, 4)], [255, 0, 0, 255]);
  assert.deepEqual([...bytes.slice(12, 16)], [255, 0, 0, 255]);
  assert.deepEqual([...bytes.slice(8, 12)], [255, 255, 255, 255]);
});
test("Raster fallbacks clamp, round, and preserve alpha", () => {
  const data = new Uint8ClampedArray([100, 150, 200, 77, 255, 255, 255, 0]);
  assert.deepEqual([...filterPixels(data, 0)], [155, 105, 55, 77, 0, 0, 0, 0]);
  assert.deepEqual(
    [...filterPixels(data, 1)],
    [141, 141, 141, 77, 255, 255, 255, 0],
  );
  assert.equal(filterPixels(data, 2)[7], 0);
  assert.equal(filterPixels(data, 3)[0], 255);
});
test("iCalendar preserves event identity and escaped Unicode text across repeated round trips", () => {
  const events = [
    {
      id: "stable-id",
      title: "Review, design; 😀",
      start: "2026-10-04T09:00:00.000Z",
      end: "2026-10-04T10:00:00.000Z",
      notes: "One\nTwo",
      location: "Room 1",
      repeat: "WEEKLY",
    },
  ];
  let actual = events;
  for (let n = 0; n < 3; n++) actual = importCalendar(exportCalendar(actual));
  assert.equal(actual[0].id, "stable-id");
  assert.equal(actual[0].title, events[0].title);
  assert.equal(actual[0].notes, "One\nTwo");
  assert.equal(new Date(actual[0].start).toISOString(), events[0].start);
});
