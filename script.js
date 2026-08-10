const THEME_KEY = "opencalculate.theme";

function getPreferredTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch (_) {}
  if (window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
  return "light";
}

function applyTheme(theme) {
  const t = theme === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", t);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", t === "dark" ? "#000000" : "#ffffff");
  return t;
}

function initTheme() {
  return applyTheme(getPreferredTheme());
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || getPreferredTheme();
  const next = current === "dark" ? "light" : "dark";
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch (_) {}
  return applyTheme(next);
}

const HISTORY_KEY = "opencalculate.history";
const MAX_HISTORY = 100;

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (_) {
    return [];
  }
}

function saveHistory(items) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY)));
  } catch (_) {}
}

function getHistory() {
  return loadHistory();
}

function addHistory(expression, result) {
  const items = loadHistory();
  if (items[0] && items[0].expression === expression && items[0].result === result) {
    return items[0];
  }
  const item = {
    id: Date.now() + "-" + Math.random().toString(36).slice(2, 8),
    expression: expression,
    result: result,
    ts: Date.now(),
  };
  items.unshift(item);
  saveHistory(items);
  return item;
}

function removeHistory(id) {
  saveHistory(loadHistory().filter(function (x) {
    return x.id !== id;
  }));
}

function clearHistory() {
  saveHistory([]);
}

var TokenType = {
  NUMBER: "NUMBER",
  IDENT: "IDENT",
  OP: "OP",
  LPAREN: "LPAREN",
  RPAREN: "RPAREN",
  COMMA: "COMMA",
  EOF: "EOF",
};

function ParseError(message) {
  this.name = "ParseError";
  this.message = message;
}
ParseError.prototype = Object.create(Error.prototype);

function isDigit(c) {
  return c >= "0" && c <= "9";
}

function isAlpha(c) {
  return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_";
}

function normalize(input) {
  return String(input)
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-")
    .replace(/–/g, "-")
    .replace(/√\s*\(/g, "sqrt(")
    .replace(/√\s*([0-9.]+(?:e[+-]?[0-9]+)?)/gi, "sqrt($1)")
    .trim();
}

function tokenize(input) {
  var src = normalize(input);
  var tokens = [];
  var i = 0;

  while (i < src.length) {
    var c = src[i];

    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i++;
      continue;
    }

    if (isDigit(c) || (c === "." && isDigit(src[i + 1]))) {
      var start = i;
      while (isDigit(src[i])) i++;
      if (src[i] === ".") {
        i++;
        while (isDigit(src[i])) i++;
      }
      if (src[i] === "e" || src[i] === "E") {
        i++;
        if (src[i] === "+" || src[i] === "-") i++;
        if (!isDigit(src[i])) throw new ParseError("Invalid scientific notation");
        while (isDigit(src[i])) i++;
      }
      var raw = src.slice(start, i);
      var value = Number(raw);
      if (!Number.isFinite(value)) throw new ParseError("Invalid number");
      tokens.push({ type: TokenType.NUMBER, value: value, raw: raw });
      continue;
    }

    if (isAlpha(c) || c === "π") {
      if (c === "π") {
        tokens.push({ type: TokenType.IDENT, value: "pi" });
        i++;
        continue;
      }
      var s = i;
      while (isAlpha(src[i]) || isDigit(src[i])) i++;
      tokens.push({ type: TokenType.IDENT, value: src.slice(s, i).toLowerCase() });
      continue;
    }

    if ("+-*/^%!(),".indexOf(c) !== -1) {
      if (c === "(") tokens.push({ type: TokenType.LPAREN, value: c });
      else if (c === ")") tokens.push({ type: TokenType.RPAREN, value: c });
      else if (c === ",") tokens.push({ type: TokenType.COMMA, value: c });
      else tokens.push({ type: TokenType.OP, value: c });
      i++;
      continue;
    }

    throw new ParseError('Unexpected character: "' + c + '"');
  }

  tokens.push({ type: TokenType.EOF, value: null });
  return tokens;
}

function evaluate(input, options) {
  options = options || {};
  var angleMode = options.angleMode === "rad" ? "rad" : "deg";
  var tokens = tokenize(input);
  if (tokens.length === 1) throw new ParseError("Empty expression");

  var pos = 0;

  function peek() {
    return tokens[pos];
  }

  function consume(type) {
    var t = tokens[pos];
    if (t.type !== type) throw new ParseError("Unexpected token");
    pos++;
    return t;
  }

  function match(type, value) {
    var t = tokens[pos];
    if (t.type === type && (value === undefined || t.value === value)) {
      pos++;
      return true;
    }
    return false;
  }

  function toRad(x) {
    return angleMode === "deg" ? (x * Math.PI) / 180 : x;
  }

  function fromRad(x) {
    return angleMode === "deg" ? (x * 180) / Math.PI : x;
  }

  function factorial(n) {
    if (!Number.isFinite(n) || n < 0) throw new ParseError("Factorial requires n ≥ 0");
    if (!Number.isInteger(n)) throw new ParseError("Factorial requires an integer");
    if (n > 170) throw new ParseError("Factorial overflow");
    var r = 1;
    for (var i = 2; i <= n; i++) r *= i;
    return r;
  }

  function canImplicitMultiply(t) {
    if (t.type === TokenType.IDENT && t.value === "of") return false;
    return (
      t.type === TokenType.NUMBER ||
      t.type === TokenType.IDENT ||
      t.type === TokenType.LPAREN
    );
  }

  function parseExpression() {
    var left = parseTerm();
    while (true) {
      if (peek().type === TokenType.IDENT && peek().value === "of") {
        pos++;
        left = left * parseTerm();
        continue;
      }
      if (match(TokenType.OP, "+")) left = left + parseTerm();
      else if (match(TokenType.OP, "-")) left = left - parseTerm();
      else break;
    }
    return left;
  }

  function parseTerm() {
    var left = parsePower();
    while (true) {
      if (match(TokenType.OP, "*")) left = left * parsePower();
      else if (match(TokenType.OP, "/")) {
        var right = parsePower();
        if (right === 0) throw new ParseError("Division by zero");
        left = left / right;
      } else if (canImplicitMultiply(peek())) left = left * parsePower();
      else break;
    }
    return left;
  }

  function parsePower() {
    var base = parseUnary();
    if (match(TokenType.OP, "^")) {
      var exp = parsePower();
      var r = Math.pow(base, exp);
      if (!Number.isFinite(r)) throw new ParseError("Power overflow");
      return r;
    }
    return base;
  }

  function parseUnary() {
    if (match(TokenType.OP, "+")) return parseUnary();
    if (match(TokenType.OP, "-")) return -parseUnary();
    return parsePostfix();
  }

  function parsePostfix() {
    var value = parsePrimary();
    while (true) {
      if (match(TokenType.OP, "!")) value = factorial(value);
      else if (match(TokenType.OP, "%")) value = value / 100;
      else break;
    }
    return value;
  }

  function parsePrimary() {
    var t = peek();

    if (t.type === TokenType.NUMBER) {
      pos++;
      return t.value;
    }

    if (t.type === TokenType.IDENT) {
      pos++;
      var name = t.value;

      if (name === "pi" || name === "π") return Math.PI;
      if (name === "e" && peek().type !== TokenType.LPAREN) return Math.E;
      if (name === "of") throw new ParseError('Unexpected "of"');

      if (peek().type === TokenType.LPAREN) {
        consume(TokenType.LPAREN);
        var args = [];
        if (peek().type !== TokenType.RPAREN) {
          args.push(parseExpression());
          while (match(TokenType.COMMA)) args.push(parseExpression());
        }
        consume(TokenType.RPAREN);
        return callFunction(name, args);
      }

      if (name === "e") return Math.E;
      throw new ParseError("Unknown identifier: " + name);
    }

    if (t.type === TokenType.LPAREN) {
      consume(TokenType.LPAREN);
      var v = parseExpression();
      consume(TokenType.RPAREN);
      return v;
    }

    throw new ParseError("Expected number or expression");
  }

  function callFunction(name, args) {
    function one() {
      if (args.length !== 1) throw new ParseError(name + "() expects 1 argument");
      return args[0];
    }
    function two() {
      if (args.length !== 2) throw new ParseError(name + "() expects 2 arguments");
      return args;
    }

    switch (name) {
      case "sin":
        return Math.sin(toRad(one()));
      case "cos":
        return Math.cos(toRad(one()));
      case "tan": {
        var tr = Math.tan(toRad(one()));
        if (!Number.isFinite(tr)) throw new ParseError("Undefined tan");
        return tr;
      }
      case "asin": {
        var ax = one();
        if (ax < -1 || ax > 1) throw new ParseError("asin domain is [-1, 1]");
        return fromRad(Math.asin(ax));
      }
      case "acos": {
        var cx = one();
        if (cx < -1 || cx > 1) throw new ParseError("acos domain is [-1, 1]");
        return fromRad(Math.acos(cx));
      }
      case "atan":
        return fromRad(Math.atan(one()));
      case "log":
      case "log10": {
        var lx = one();
        if (lx <= 0) throw new ParseError("log requires positive argument");
        return Math.log10(lx);
      }
      case "ln":
      case "loge": {
        var nx = one();
        if (nx <= 0) throw new ParseError("ln requires positive argument");
        return Math.log(nx);
      }
      case "sqrt": {
        var sx = one();
        if (sx < 0) throw new ParseError("Square root of negative number");
        return Math.sqrt(sx);
      }
      case "abs":
        return Math.abs(one());
      case "floor":
        return Math.floor(one());
      case "ceil":
        return Math.ceil(one());
      case "round":
        return Math.round(one());
      case "fact":
      case "factorial":
        return factorial(one());
      case "pow": {
        var p = two();
        var pr = Math.pow(p[0], p[1]);
        if (!Number.isFinite(pr)) throw new ParseError("Power overflow");
        return pr;
      }
      case "exp":
        return Math.exp(one());
      default:
        throw new ParseError("Unknown function: " + name);
    }
  }

  var result = parseExpression();
  if (peek().type !== TokenType.EOF) throw new ParseError("Unexpected input after expression");
  if (!Number.isFinite(result)) throw new ParseError("Result is not a finite number");
  return result;
}

function formatNumber(n) {
  if (!Number.isFinite(n)) return String(n);
  if (Object.is(n, -0)) return "0";

  var abs = Math.abs(n);
  if (abs !== 0 && (abs >= 1e12 || abs < 1e-9)) {
    return n.toExponential(10).replace(/\.?0+e/, "e").replace(/e\+/, "e");
  }

  var rounded = Math.round(n * 1e12) / 1e12;
  var s = String(rounded);
  if (s.indexOf("e") !== -1 || s.indexOf("E") !== -1) {
    return rounded.toPrecision(12).replace(/\.?0+e/, "e");
  }
  if (s.indexOf(".") !== -1) s = s.replace(/\.?0+$/, "");
  return s === "-0" ? "0" : s;
}

function Calculator(opts) {
  this.onChange = opts.onChange;
  this.onHistory = opts.onHistory || function () {};
  this.expression = "";
  this.result = null;
  this.lastExpression = "";
  this.error = null;
  this.justEvaluated = false;
  this.mode = "basic";
  this.angleMode = "deg";
}

Calculator.prototype.getState = function () {
  return {
    expression: this.expression,
    result: this.result,
    lastExpression: this.lastExpression,
    error: this.error,
    justEvaluated: this.justEvaluated,
    mode: this.mode,
    angleMode: this.angleMode,
  };
};

Calculator.prototype.notify = function () {
  this.onChange(this.getState());
};

Calculator.prototype.setMode = function (mode) {
  this.mode = mode === "scientific" ? "scientific" : "basic";
  this.notify();
};

Calculator.prototype.toggleAngleMode = function () {
  this.angleMode = this.angleMode === "deg" ? "rad" : "deg";
  this.notify();
};

Calculator.prototype.clear = function () {
  this.expression = "";
  this.result = null;
  this.lastExpression = "";
  this.error = null;
  this.justEvaluated = false;
  this.notify();
};

Calculator.prototype.backspace = function () {
  if (this.error) {
    this.error = null;
    this.notify();
    return;
  }
  if (this.justEvaluated) {
    this.expression = this.result || "";
    this.result = null;
    this.justEvaluated = false;
  }
  this.expression = this.expression.slice(0, -1);
  this.error = null;
  this.notify();
};

Calculator.prototype.insert = function (text) {
  if (this.error) {
    this.error = null;
    this.expression = "";
  }

  if (this.justEvaluated) {
    var ops = "+-*/^%";
    if (text.length === 1 && ops.indexOf(text) !== -1) {
      this.expression = (this.result || "0") + text;
    } else if (text === "!" || text === "%") {
      this.expression = (this.result || "0") + text;
    } else {
      this.expression = text;
    }
    this.result = null;
    this.justEvaluated = false;
    this.notify();
    return;
  }

  this.expression += text;
  this.notify();
};

Calculator.prototype.square = function () {
  if (this.justEvaluated && this.result != null) {
    this.expression = "(" + this.result + ")^2";
    this.result = null;
    this.justEvaluated = false;
    this.error = null;
    this.notify();
    return;
  }
  if (this.expression === "") return;
  this.expression = "(" + this.expression + ")^2";
  this.notify();
};

Calculator.prototype.factorial = function () {
  if (this.justEvaluated && this.result != null) {
    this.expression = "(" + this.result + ")!";
    this.result = null;
    this.justEvaluated = false;
    this.error = null;
    this.notify();
    return;
  }
  this.insert("!");
};

Calculator.prototype.equals = function () {
  var expr = this.expression.trim();
  if (expr === "" && this.result != null) {
    this.notify();
    return true;
  }
  if (expr === "") return false;

  try {
    var value = evaluate(expr, { angleMode: this.angleMode });
    var formatted = formatNumber(value);
    addHistory(expr, formatted);
    this.result = formatted;
    this.lastExpression = expr;
    this.expression = "";
    this.error = null;
    this.justEvaluated = true;
    this.onHistory();
    this.notify();
    return true;
  } catch (e) {
    this.error = e.message || "Error";
    this.justEvaluated = false;
    this.notify();
    return false;
  }
};

Calculator.prototype.loadFromHistory = function (expression) {
  this.expression = expression;
  this.result = null;
  this.error = null;
  this.justEvaluated = false;
  this.notify();
};

Calculator.prototype.useResult = function (result) {
  this.expression = result;
  this.result = null;
  this.error = null;
  this.justEvaluated = false;
  this.notify();
};

initTheme();

function $(sel, root) {
  return (root || document).querySelector(sel);
}

function $$(sel, root) {
  return Array.prototype.slice.call((root || document).querySelectorAll(sel));
}

var displayEl = $("#display");
var displayExpr = $("#display-expression");
var displayValue = $("#display-value");
var displayError = $("#display-error");
var sciKeys = $("#sci-keys");
var angleToggle = $("#angle-toggle");
var historyPanel = $("#history-panel");
var historyToggle = $("#history-toggle");
var historyList = $("#history-list");
var historyEmpty = $("#history-empty");
var historyClear = $("#history-clear");

var calc = new Calculator({
  onChange: renderDisplay,
  onHistory: renderHistory,
});

function renderDisplay(state) {
  if (state.error) {
    displayEl.classList.add("has-error");
    displayExpr.textContent = state.expression || "";
    displayValue.textContent = "Error";
    displayError.hidden = false;
    displayError.textContent = state.error;
  } else {
    displayEl.classList.remove("has-error");
    displayError.hidden = true;
    displayError.textContent = "";

    if (state.justEvaluated && state.result != null) {
      displayExpr.textContent = state.lastExpression ? state.lastExpression + " =" : "";
      displayValue.textContent = state.result;
    } else if (state.expression) {
      displayExpr.textContent = "";
      displayValue.textContent = state.expression;
    } else {
      displayExpr.textContent = "";
      displayValue.textContent = state.result != null ? state.result : "0";
    }
  }

  $$(".mode").forEach(function (tab) {
    tab.classList.toggle("active", tab.getAttribute("data-mode") === state.mode);
  });
  sciKeys.hidden = state.mode !== "scientific";
  angleToggle.textContent = state.angleMode === "deg" ? "DEG" : "RAD";
}

function renderHistory() {
  var items = getHistory();
  historyList.innerHTML = "";
  historyEmpty.hidden = items.length > 0;
  historyClear.disabled = items.length === 0;

  items.forEach(function (item) {
    var li = document.createElement("li");
    li.className = "history-item";

    var exprBtn = document.createElement("button");
    exprBtn.type = "button";
    exprBtn.className = "history-expr";
    exprBtn.textContent = item.expression;
    exprBtn.addEventListener("click", function () {
      calc.loadFromHistory(item.expression);
    });

    var resBtn = document.createElement("button");
    resBtn.type = "button";
    resBtn.className = "history-result";
    resBtn.textContent = "= " + item.result;
    resBtn.addEventListener("click", function () {
      calc.useResult(item.result);
    });

    var del = document.createElement("button");
    del.type = "button";
    del.className = "history-delete";
    del.setAttribute("aria-label", "Delete");
    del.textContent = "×";
    del.addEventListener("click", function () {
      removeHistory(item.id);
      renderHistory();
    });

    li.appendChild(exprBtn);
    li.appendChild(resBtn);
    li.appendChild(del);
    historyList.appendChild(li);
  });
}

$$(".mode").forEach(function (tab) {
  tab.addEventListener("click", function () {
    calc.setMode(tab.getAttribute("data-mode"));
  });
});

angleToggle.addEventListener("click", function () {
  calc.toggleAngleMode();
});

$("#keypad").addEventListener("click", function (e) {
  var btn = e.target.closest(".key");
  if (!btn) return;

  var action = btn.getAttribute("data-action");
  var insert = btn.getAttribute("data-insert");

  if (action === "clear") calc.clear();
  else if (action === "backspace") calc.backspace();
  else if (action === "equals") calc.equals();
  else if (action === "square") calc.square();
  else if (action === "factorial") calc.factorial();
  else if (insert != null) calc.insert(insert);
});

historyToggle.addEventListener("click", function () {
  historyPanel.hidden = !historyPanel.hidden;
  if (!historyPanel.hidden) renderHistory();
});

historyClear.addEventListener("click", function () {
  if (confirm("Clear all history?")) {
    clearHistory();
    renderHistory();
  }
});

$("#theme-toggle").addEventListener("click", function () {
  toggleTheme();
});

function isTypingInField(target) {
  if (!target) return false;
  var tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

document.addEventListener("keydown", function (e) {
  if (isTypingInField(e.target)) return;

  var key = e.key;

  if (key >= "0" && key <= "9") {
    e.preventDefault();
    calc.insert(key);
    return;
  }

  if ("+-*/^%().".indexOf(key) !== -1) {
    e.preventDefault();
    calc.insert(key);
    return;
  }

  if (key === "Enter" || key === "=") {
    e.preventDefault();
    calc.equals();
    return;
  }

  if (key === "Escape") {
    e.preventDefault();
    calc.clear();
    return;
  }

  if (key === "Backspace") {
    e.preventDefault();
    calc.backspace();
    return;
  }

  if (key === "!") {
    e.preventDefault();
    calc.insert("!");
  }
});

renderDisplay(calc.getState());
renderHistory();
