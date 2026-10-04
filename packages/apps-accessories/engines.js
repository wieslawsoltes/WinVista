/** Calculator state machine: standard mode intentionally evaluates pending operations left to right. */
export class CalculatorEngine {
  constructor() {
    this.clear();
    this.memory = 0;
  }
  clear() {
    this.display = "0";
    this.accumulator = null;
    this.pending = null;
    this.fresh = true;
    this.last = null;
    this.error = false;
    this.hasOperand = false;
  }
  digit(value) {
    if (this.error) this.clear();
    this.hasOperand = true;
    if (this.fresh) {
      this.display = value === "." ? "0." : value;
      this.fresh = false;
    } else if (value === "." && !this.display.includes("."))
      this.display += ".";
    else if (value !== "." && this.display.replace("-", "").length < 16)
      this.display = this.display === "0" ? value : this.display + value;
    return this.display;
  }
  number() {
    return Number(this.display);
  }
  set(value) {
    this.hasOperand = true;
    if (!Number.isFinite(value)) {
      this.display = "Cannot divide by zero";
      this.error = true;
      this.fresh = true;
    } else {
      this.display = String(Number(value.toPrecision(14)));
      this.error = false;
    }
    return this.display;
  }
  apply(a, b, op) {
    if (op === "+") return a + b;
    if (op === "−" || op === "-") return a - b;
    if (op === "×" || op === "*") return a * b;
    if (op === "÷" || op === "/") return b === 0 ? NaN : a / b;
    if (op === "^") return a ** b;
    return b;
  }
  operation(op) {
    if (this.error) return;
    if (this.pending && this.hasOperand)
      this.set(this.apply(this.accumulator, this.number(), this.pending));
    this.accumulator = this.number();
    this.pending = op;
    this.fresh = true;
    this.hasOperand = false;
    this.last = null;
  }
  equals() {
    if (this.error) return;
    if (this.pending) {
      const rhs = this.number();
      this.set(this.apply(this.accumulator, rhs, this.pending));
      this.last = { op: this.pending, rhs };
      this.pending = null;
      this.accumulator = null;
    } else if (this.last)
      this.set(this.apply(this.number(), this.last.rhs, this.last.op));
    this.fresh = true;
  }
  unary(op) {
    const n = this.number();
    let v = n;
    if (op === "negate") v = -n;
    else if (op === "sqrt") v = n < 0 ? NaN : Math.sqrt(n);
    else if (op === "reciprocal") v = 1 / n;
    else if (op === "percent")
      v =
        this.accumulator != null &&
        (this.pending === "+" || this.pending === "-")
          ? (this.accumulator * n) / 100
          : n / 100;
    else if (op === "sin") v = Math.sin((n * Math.PI) / 180);
    else if (op === "cos") v = Math.cos((n * Math.PI) / 180);
    else if (op === "tan") v = Math.tan((n * Math.PI) / 180);
    else if (op === "log") v = Math.log10(n);
    else if (op === "ln") v = Math.log(n);
    else if (op === "square") v = n * n;
    else if (op === "factorial") {
      if (n < 0 || n > 170 || !Number.isInteger(n)) v = NaN;
      else {
        v = 1;
        for (let i = 2; i <= n; i++) v *= i;
      }
    }
    this.set(v);
    this.fresh = true;
  }
  memoryCommand(op) {
    if (op === "MC") this.memory = 0;
    if (op === "MR") {
      this.set(this.memory);
      this.fresh = true;
    }
    if (op === "MS") {
      this.memory = this.number();
      this.fresh = true;
    }
    if (op === "M+") this.memory += this.number();
  }
  backspace() {
    if (this.fresh || this.error) return;
    this.display = this.display.length > 1 ? this.display.slice(0, -1) : "0";
    if (this.display === "-") this.display = "0";
  }
  clearEntry() {
    this.display = "0";
    this.error = false;
    this.fresh = true;
    this.hasOperand = true;
  }
}

/** Linear-time RGBA flood fill, bounded by image dimensions. */
export function floodFill(data, width, height, x, y, color, tolerance = 0) {
  x = Math.floor(x);
  y = Math.floor(y);
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const start = (y * width + x) * 4,
    target = [data[start], data[start + 1], data[start + 2], data[start + 3]];
  if (target.every((v, i) => v === color[i])) return;
  const match = (i) =>
    Math.abs(data[i] - target[0]) <= tolerance &&
    Math.abs(data[i + 1] - target[1]) <= tolerance &&
    Math.abs(data[i + 2] - target[2]) <= tolerance &&
    Math.abs(data[i + 3] - target[3]) <= tolerance;
  const visited = new Uint8Array(width * height),
    queue = new Int32Array(width * height);
  let read = 0,
    write = 1;
  queue[0] = y * width + x;
  visited[queue[0]] = 1;
  while (read < write) {
    const index = queue[read++],
      i = index * 4;
    if (!match(i)) continue;
    data[i] = color[0];
    data[i + 1] = color[1];
    data[i + 2] = color[2];
    data[i + 3] = color[3];
    const cx = index % width,
      cy = (index / width) | 0;
    for (const n of [
      cx > 0 ? index - 1 : -1,
      cx + 1 < width ? index + 1 : -1,
      cy > 0 ? index - width : -1,
      cy + 1 < height ? index + width : -1,
    ])
      if (n >= 0 && !visited[n]) {
        visited[n] = 1;
        queue[write++] = n;
      }
  }
}
export function tokenizeCommand(text) {
  const result = [];
  const regex = /"([^"]*)"|'([^']*)'|([^\s]+)/g;
  let match;
  while ((match = regex.exec(text)))
    result.push(match[1] ?? match[2] ?? match[3]);
  return result;
}
export function encodeRTF(text) {
  let result = "{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Arial;}}\\f0\\fs22 ";
  for (let index = 0; index < text.length; index++) {
    const c = text[index],
      n = c.charCodeAt(0);
    if (c === "\n") result += "\\par\n";
    else if (c === "\r") continue;
    else if ("\\{}".includes(c)) result += "\\" + c;
    else if (n > 127) result += "\\u" + (n > 32767 ? n - 65536 : n) + "?";
    else result += c;
  }
  return result + "}";
}
export function decodeRTF(rtf) {
  let out = "",
    skip = 0,
    depth = 0,
    uc = 1,
    fallback = 0;
  for (let i = 0; i < rtf.length;) {
    const c = rtf[i++];
    if (c === "{") {
      depth++;
      continue;
    }
    if (c === "}") {
      if (skip === depth) skip = 0;
      depth--;
      continue;
    }
    if (c !== "\\") {
      if (!skip && c !== "\r" && c !== "\n") {
        if (fallback) fallback--;
        else out += c;
      }
      continue;
    }
    if (rtf[i] === "'") {
      const hex = rtf.slice(i + 1, i + 3);
      i += 3;
      if (!skip) out += String.fromCharCode(parseInt(hex, 16));
      continue;
    }
    if ("\\{}".includes(rtf[i])) {
      if (!skip) out += rtf[i];
      i++;
      continue;
    }
    if (rtf[i] === "*") {
      skip = depth;
      i++;
      continue;
    }
    const m = /^([a-z]+)(-?\d+)? ?/.exec(rtf.slice(i));
    if (!m) {
      i++;
      continue;
    }
    i += m[0].length;
    const word = m[1],
      num = m[2] ? Number(m[2]) : null;
    if (
      ["fonttbl", "colortbl", "stylesheet", "info", "pict", "object"].includes(
        word,
      )
    ) {
      skip = depth;
      continue;
    }
    if (skip) continue;
    if (word === "par" || word === "line") out += "\n";
    if (word === "tab") out += "\t";
    if (word === "uc") uc = num;
    if (word === "u") {
      out += String.fromCharCode(num < 0 ? num + 65536 : num);
      fallback = uc;
    }
  }
  return out;
}

export function splitCommands(text) {
  const commands = [];
  let quote = null,
    start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (c === '\"' || c === "'") {
      quote = c;
      continue;
    }
    if (c === "&" && text[i + 1] === "&") {
      commands.push(text.slice(start, i).trim());
      start = i + 2;
      i++;
    }
  }
  commands.push(text.slice(start).trim());
  return commands.filter(Boolean);
}
