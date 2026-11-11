// Chef Wars: Showdown Battle - all the game rules (no networking in this file).
// server.js creates games, passes player input in, and sends snapshot() to the browsers.
// Lecture links: 5.1 (arrays/objects), 5.2 (functions), 7.1 (plain JSON-able data)
//
// Each chef has hearts. A missed order costs the hearts shown on it (½ or 1). Lose your last heart
// and you're knocked out. After regular time the chef with more hearts wins; if they're level,
// a Sudden Death Dish decides it.

const SETTINGS = {
    tickRate: 30,                                      // server updates per second
    gameTime: Number(process.env.GAME_TIME) || 180,    // 3 minutes regular time (GAME_TIME=60 for a short demo)
    overtime: Number(process.env.OVERTIME) || 60,      // Sudden Death Dish: up to 1 minute
    heartsMin: 5, heartsMax: 8, heartsStart: 5,        // starting hearts, picked in the waiting room
    boostTime: 3, boostSpeed: 1.3,                     // serving an order: 1.3x speed for 3 s
    countdown: 3,
    speed: 4.2,                                        // tiles per second
    radius: 0.3,
    chopTime: 2,                                       // hold right click (or O) for about 2 seconds
    burnTime: 10,                                      // a finished pot burns after this long
    stunTime: 2,
    throwSpeed: 11,
    throwRange: 8,
    orderTime: 60,
    orderGap: 15,
    minOrders: 2,
    maxOrders: 4,
    spawnMin: 1.2, spawnMax: 2.2,                      // seconds between ingredient spawns
    lifeMin: 8, lifeMax: 10,                           // spawned ingredients vanish after 8-10 s
    dropLife: 10,                                      // dropped ingredients also vanish (plates stay)
    maxFloor: 10,
    cheatTime: 15, cheatCooldown: 30,                  // C: cheat lasts 15 s, then 30 s before it can be used again
    sprintTime: 5, sprintCooldown: 10, sprintBoost: 1.6  // Space: run 1.6x faster for 5 s, then 10 s to recharge
};

// items = what must be on the plate; pot = what goes in the pot (name, state)
// hearts = what you lose if the order runs out (fewer steps: ½ heart, more steps: 1 heart)
const RECIPES = {
    salad: {
        label: "Garden Salad", hearts: 0.5, icon: "salad",
        items: ["lettuce", "tomato"], steps: ["lettuce", "tomato"],
        how: "Chop lettuce and tomato, put both on a plate"
    },
    tomatoSoup: {
        label: "Tomato Soup", hearts: 0.5, icon: "tomato-soup",
        items: ["tomatoSoup"], steps: ["tomato-whole", "tomato-whole", "pot"],
        pot: [["tomato", "raw"], ["tomato", "raw"]], cookTime: 6,
        how: "Put 2 whole tomatoes in the pot"
    },
    veggieStew: {
        label: "Veggie Stew", hearts: 1, icon: "veggie-stew",
        items: ["veggieStew"], steps: ["carrot", "onion", "pot"],
        pot: [["carrot", "chopped"], ["onion", "chopped"]], cookTime: 8,
        how: "Chop carrot and onion, cook them in the pot"
    }
};
const RECIPE_WEIGHTS = { salad: 3, tomatoSoup: 3, veggieStew: 3 };
const INGREDIENTS = ["lettuce", "tomato", "onion", "carrot"];
const PLATE_READY = { lettuce: "chopped", tomato: "chopped" };

// ---------- The kitchen ----------
// #  wall   K  chopping board   P  pot   W  serving counter   D  plates   X  bin
// C  counter (anyone can use)   .  floor (ingredients pop up here)
// Left side (x < 9.5) belongs to chef 1, right side to chef 2.
const MAP = [
    "##KCPC#######CPCK##",
    "#.................#",
    "D.................D",
    "C.................C",
    "#.......CCC.......#",
    "W.......CCC.......W",
    "W.................W",
    "C.................C",
    "X.................X",
    "#.................#",
    "##CPKC#######CKPC##"
];
const COLS = MAP[0].length;
const ROWS = MAP.length;
const SPAWNS = [{ x: 3.5, y: 6.5 }, { x: COLS - 3.5, y: 6.5 }];
const OWNED = "KPWD";                                   // stations that belong to one side
const STATION_NAMES = { K: "chopping board", P: "pot", W: "serving counter", D: "plates" };

const tileAt = function (x, y) {
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return "#";
    return MAP[y][x];
};
const keyOf = (x, y) => x + "," + y;
const sideOfX = (x) => (x < COLS / 2 ? 0 : 1);
const sortedKey = (list) => list.slice().sort().join("+");
const RECIPE_KEY = {};
Object.keys(RECIPES).forEach((r) => { RECIPE_KEY[r] = sortedKey(RECIPES[r].items); });

const FLOOR_TILES = [];
const POT_TILES = [];
for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
        if (MAP[y][x] === ".") FLOOR_TILES.push({ x, y });
        if (MAP[y][x] === "P") POT_TILES.push(keyOf(x, y));
    }
}

const rand = (a, b) => a + Math.random() * (b - a);
const newIngredient = (name) => ({ name, state: "raw", chop: 0 });
const newPlate = () => ({ name: "plate", items: [] });
const newPot = () => ({ name: "pot", items: [], state: "filling", dish: null, cook: 0, burn: 0 });

// ---------- Creating / resetting ----------
const resetPlayer = function (p, hearts) {
    const s = SPAWNS[p.index];
    Object.assign(p, {
        x: s.x, y: s.y, fx: p.index === 0 ? 1 : -1, fy: 0,
        held: null,
        input: { up: false, down: false, left: false, right: false, chop: false },
        stunUntil: 0, hearts, knockedOut: false, orders: [], nextOrder: 0, orderTimer: 0,
        served: 0, grabbed: 0, missed: 0, hits: 0,
        cheat: false, chopping: false, moving: false, chopPressed: false,
        cheatUntil: 0, cheatReadyAt: 0,                 // game.clock times for the cheat skill
        sprintUntil: 0, sprintReadyAt: 0,               // ... for the sprint skill
        boostUntil: 0                                   // ... and the speed boost after serving
    });
};

// users = [{ username, name }, { username, name }]
const createGame = function (room, users) {
    const game = {
        room, phase: "lobby", ready: [false, false], winner: null, endReason: null,
        hearts: SETTINGS.heartsStart, overtime: false, suddenDish: null, suddenWinner: null,
        clock: 0, timeLeft: SETTINGS.gameTime, countdown: 0,
        tiles: {}, floor: [], projectiles: [], events: [], nextId: 1, sequence: [], spawnTimer: 0
    };
    game.players = users.map(function (u, i) {
        const p = { index: i, username: u.username, name: u.name };
        resetPlayer(p, game.hearts);
        return p;
    });
    resetKitchen(game);
    return game;
};

const resetKitchen = function (game) {
    game.tiles = {};
    POT_TILES.forEach((k) => { game.tiles[k] = newPot(); });
    game.floor = [];
    game.projectiles = [];
    game.events = [];
    game.spawnTimer = 0.5;
};

const makeSequence = function (count) {
    const list = ["salad", "tomatoSoup"];
    const pool = [];
    Object.keys(RECIPE_WEIGHTS).forEach((r) => {
        for (let i = 0; i < RECIPE_WEIGHTS[r]; i++) pool.push(r);
    });
    while (list.length < count) list.push(pool[Math.floor(Math.random() * pool.length)]);
    return list;
};

const startRound = function (game) {
    resetKitchen(game);
    game.clock = 0;
    game.timeLeft = SETTINGS.gameTime;
    game.countdown = SETTINGS.countdown;
    game.phase = "countdown";
    game.winner = null;
    game.endReason = null;
    game.overtime = false;
    game.suddenDish = null;
    game.suddenWinner = null;
    game.sequence = makeSequence(100);
    game.players.forEach((p) => resetPlayer(p, game.hearts));
    for (let i = 0; i < 4; i++) spawnIngredient(game);
};

// Waiting room: both chefs must press Ready
const setReady = function (game, index, ready) {
    if (game.phase !== "lobby") return false;
    game.ready[index] = !!ready;
    if (game.ready[0] && game.ready[1]) {
        startRound(game);
        return true;
    }
    return false;
};

// Waiting room: either chef can pick the starting hearts (5-8). Changing it un-readies both chefs.
const setHearts = function (game, index, hearts) {
    const n = Number(hearts);
    if (game.phase !== "lobby" || !game.players[index] || !Number.isInteger(n)) return false;
    if (n < SETTINGS.heartsMin || n > SETTINGS.heartsMax || n === game.hearts) return false;
    game.hearts = n;
    game.ready = [false, false];
    game.players.forEach((p) => { p.hearts = n; });
    return true;
};

// "½♥", "1♥", "1½♥" for popups
const heartText = function (n) {
    const whole = Math.floor(n), half = n % 1 ? "½" : "";
    return (whole || !half ? whole : "") + half + "♥";
};

// ---------- Helpers ----------
const event = (game, e) => game.events.push(e);
const say = (game, p, text) => event(game, { kind: "msg", to: p.index, text, x: p.x, y: p.y - 1 });
const isStunned = (game, p) => game.clock < p.stunUntil;

const usable = (ch) => ch !== "." && ch !== "#";
const tileInFront = (p, dx, dy) => ({ x: Math.floor(p.x + dx * 0.8), y: Math.floor(p.y + dy * 0.8) });

// The tile the chef is working on. Normally the tile straight ahead; when the chef faces
// diagonally (e.g. holding up+left against a counter) and that tile is floor or wall,
// the tile in the other direction is used instead, so stations never ignore you.
const targetTile = function (p) {
    const horizontal = Math.abs(p.fx) >= Math.abs(p.fy);
    const sx = Math.sign(p.fx), sy = Math.sign(p.fy);
    const first = horizontal ? tileInFront(p, sx, 0) : tileInFront(p, 0, sy);
    if (usable(tileAt(first.x, first.y))) return first;
    const minor = horizontal ? p.fy : p.fx;
    if (Math.abs(minor) > 0.3) {
        const second = horizontal ? tileInFront(p, 0, sy) : tileInFront(p, sx, 0);
        if (usable(tileAt(second.x, second.y))) return second;
    }
    return first;
};
const handPoint = (p) => ({ x: p.x + p.fx * 0.55, y: p.y + p.fy * 0.55 });

const blocked = function (x, y) {
    const r = SETTINGS.radius;
    return tileAt(Math.floor(x - r), Math.floor(y - r)) !== "." ||
        tileAt(Math.floor(x + r), Math.floor(y - r)) !== "." ||
        tileAt(Math.floor(x - r), Math.floor(y + r)) !== "." ||
        tileAt(Math.floor(x + r), Math.floor(y + r)) !== ".";
};
// Chefs can walk through each other, so nobody can stand in front of the rival's stations and lock them out.

// Dropped ingredients vanish like spawned ones; plates (empty or with a dish) stay until picked up (life = null)
const dropOnFloor = function (game, item, x, y) {
    const life = item.name === "plate" ? null : SETTINGS.dropLife;
    game.floor.push({ id: game.nextId++, x, y, item, born: game.clock, life, spawned: false });
};

// The ingredient you are standing on (or reaching for)
const nearestFloorItem = function (game, p) {
    const h = handPoint(p);
    let best = null, bestDist = 0.85;
    game.floor.forEach(function (f) {
        const d = Math.min(Math.hypot(f.x - p.x, f.y - p.y), Math.hypot(f.x - h.x, f.y - h.y));
        if (d < bestDist) { best = f; bestDist = d; }
    });
    return best;
};

// ---------- Random ingredient spawns ----------
// Ingredients that the current orders need are more likely to appear
const pickIngredient = function (game) {
    const weights = { lettuce: 1, tomato: 1, onion: 1, carrot: 1 };
    game.players.forEach(function (p) {
        p.orders.forEach(function (o) {
            const r = RECIPES[o.recipe];
            if (r.pot) r.pot.forEach((pair) => { weights[pair[0]] += 1; });
            else r.items.forEach((name) => { weights[name] += 1; });
        });
    });
    const pool = [];
    INGREDIENTS.forEach((name) => { for (let i = 0; i < weights[name]; i++) pool.push(name); });
    return pool[Math.floor(Math.random() * pool.length)];
};

const spawnIngredient = function (game) {
    const spawned = game.floor.filter((f) => f.spawned).length;
    if (spawned >= SETTINGS.maxFloor) return;
    const free = FLOOR_TILES.filter(function (t) {
        const cx = t.x + 0.5, cy = t.y + 0.5;
        if (game.floor.some((f) => Math.hypot(f.x - cx, f.y - cy) < 1)) return false;
        if (game.players.some((p) => Math.hypot(p.x - cx, p.y - cy) < 1.3)) return false;
        return true;
    });
    if (free.length === 0) return;
    const t = free[Math.floor(Math.random() * free.length)];
    game.floor.push({
        id: game.nextId++, x: t.x + 0.5, y: t.y + 0.5, item: newIngredient(pickIngredient(game)),
        born: game.clock, life: rand(SETTINGS.lifeMin, SETTINGS.lifeMax), spawned: true
    });
};

// ---------- Pot rules ----------
// Can these (name, state) pairs still become a pot recipe?
const potRecipeFor = function (items) {
    let exact = null, possible = false;
    Object.keys(RECIPES).forEach(function (key) {
        const r = RECIPES[key];
        if (!r.pot) return;
        const need = r.pot.map((pair) => pair[0] + ":" + pair[1]);
        const have = items.map((it) => it.name + ":" + it.state);
        const left = need.slice();
        const fits = have.every(function (h) {
            const i = left.indexOf(h);
            if (i < 0) return false;
            left.splice(i, 1);
            return true;
        });
        if (fits) {
            possible = true;
            if (left.length === 0) exact = key;
        }
    });
    return { possible, exact };
};

const potMessage = function (ing) {
    if (ing.name === "lettuce") return "Lettuce goes in a salad, not the pot";
    if (ing.name === "tomato" && ing.state === "chopped") return "Soup needs WHOLE tomatoes";
    if ((ing.name === "onion" || ing.name === "carrot") && ing.state === "raw") return "Chop it first";
    return "That doesn't go with what's in the pot";
};

const addToPot = function (game, p, pot, ing) {
    if (pot.state !== "filling") { say(game, p, pot.state === "cooking" ? "The pot is cooking" : "Empty the pot first"); return false; }
    const items = pot.items.concat([{ name: ing.name, state: ing.state }]);
    const check = potRecipeFor(items);
    if (!check.possible) { say(game, p, potMessage(ing)); return false; }
    pot.items = items;
    if (check.exact) {
        pot.state = "cooking";
        pot.dish = check.exact;
        pot.cook = 0;
        pot.burn = 0;
    }
    return true;
};

// ---------- Plates ----------
const addToPlate = function (game, p, plate, ing) {
    if (PLATE_READY[ing.name] === undefined) { say(game, p, "That goes in the pot"); return false; }
    if (PLATE_READY[ing.name] !== ing.state) { say(game, p, "Chop it first"); return false; }
    if (plate.items.some((n) => RECIPES[n] || n === "tomatoSoup" || n === "veggieStew")) { say(game, p, "This plate already has food"); return false; }
    if (plate.items.indexOf(ing.name) >= 0) { say(game, p, "Already on the plate"); return false; }
    plate.items.push(ing.name);
    return true;
};

const potToPlate = function (game, p, pot, plate) {
    if (pot.state === "done") {
        if (plate.items.length) { say(game, p, "Use an empty plate"); return; }
        plate.items = [pot.dish];
        Object.assign(pot, newPot());
        return;
    }
    if (pot.state === "burnt") say(game, p, "It's burnt! Empty it with your hands free");
    else if (pot.state === "cooking") say(game, p, "Still cooking...");
    else say(game, p, "Nothing to serve yet");
};

// ---------- P: pick up / put down / serve ----------
const notYours = function (game, p, ch, x) {
    if (OWNED.indexOf(ch) < 0 || sideOfX(x) === p.index) return false;
    const owner = game.players[1 - p.index];
    say(game, p, "That's " + owner.name + "'s " + STATION_NAMES[ch]);
    return true;
};

const pickUp = function (game, p, t, ch, k) {
    // Ingredients on the floor come first: walk over one and press P
    const f = nearestFloorItem(game, p);
    if (f) {
        p.held = f.item;
        if (f.spawned) p.grabbed++;
        game.floor.splice(game.floor.indexOf(f), 1);
        return;
    }
    if (notYours(game, p, ch, t.x)) return;
    if (ch === "D") { p.held = newPlate(); return; }
    if (ch === "C" || ch === "K") {
        if (!game.tiles[k]) { say(game, p, ch === "K" ? "The board is empty" : "Nothing on this counter"); return; }
        p.held = game.tiles[k];
        delete game.tiles[k];
        return;
    }
    if (ch === "P") {
        const pot = game.tiles[k];
        if (pot.state === "burnt") { Object.assign(pot, newPot()); say(game, p, "Burnt food thrown away"); return; }
        if (pot.state === "done") { say(game, p, "Grab a plate to serve it"); return; }
        if (pot.state === "cooking") { say(game, p, "Still cooking..."); return; }
        if (!pot.items.length) { say(game, p, "The pot is empty"); return; }
        const last = pot.items.pop();
        p.held = newIngredient(last.name);
        p.held.state = last.state;
        if (last.state === "chopped") p.held.chop = 1;
        return;
    }
    if (ch === "W") { say(game, p, "Bring a plated dish here to serve"); return; }
    if (ch === "X") { say(game, p, "That's the bin"); return; }
    say(game, p, "Nothing here to pick up");
};

const serve = function (game, p, t) {
    const plate = p.held;
    if (plate.items.length === 0) { say(game, p, "That plate is empty"); return; }
    const dish = sortedKey(plate.items);
    const idx = p.orders.findIndex((o) => RECIPE_KEY[o.recipe] === dish);
    const x = t.x + 0.5, y = t.y + 0.3;
    if (idx < 0) { say(game, p, "No order wants that dish"); return; }
    p.held = null;
    const order = p.orders.splice(idx, 1)[0];
    p.served++;
    p.boostUntil = game.clock + SETTINGS.boostTime;               // reward: a short speed boost
    event(game, { kind: "serve", to: p.index, x, y, text: "SERVED!", order: order.id });

    if (game.overtime) {                                          // Sudden Death Dish: first to serve wins
        if (game.suddenWinner === null) game.suddenWinner = p.index;
        return;
    }
    if (p.cheat) {                                                // cheat: the dish hurts your rival
        const rival = game.players[1 - p.index];
        const damage = RECIPES[order.recipe].hearts;
        rival.hearts = Math.max(0, rival.hearts - damage);
        event(game, { kind: "cheathit", to: rival.index, x: rival.x, y: rival.y - 1, text: "-" + heartText(damage) });
    }
};

const putDown = function (game, p, t, ch, k) {
    const held = p.held;
    const isPlate = held.name === "plate";
    if (notYours(game, p, ch, t.x)) return;

    if (ch === "X") {
        if (isPlate) held.items = [];
        else p.held = null;
        return;
    }
    if (ch === "W") {
        if (isPlate) serve(game, p, t);
        else say(game, p, "Put it on a plate first");
        return;
    }
    if (ch === "D") { say(game, p, isPlate ? "You already have a plate" : "Your hands are full"); return; }
    if (ch === "P") {
        const pot = game.tiles[k];
        if (isPlate) potToPlate(game, p, pot, held);
        else if (addToPot(game, p, pot, held)) p.held = null;
        return;
    }
    if (ch === "C" || ch === "K") {
        const on = game.tiles[k];
        if (!on) {
            if (ch === "K" && isPlate) { say(game, p, "The board is for chopping"); return; }
            game.tiles[k] = held;
            p.held = null;
            return;
        }
        if (isPlate && on.name !== "plate") { if (addToPlate(game, p, held, on)) delete game.tiles[k]; return; }
        if (!isPlate && on.name === "plate") { if (addToPlate(game, p, on, held)) p.held = null; return; }
        say(game, p, "No space here");
        return;
    }
    if (ch === ".") {
        const h = handPoint(p);
        const spot = tileAt(Math.floor(h.x), Math.floor(h.y)) === "." ? h : { x: p.x, y: p.y };
        dropOnFloor(game, held, spot.x, spot.y);
        p.held = null;
        return;
    }
    say(game, p, "Face a counter or the floor to put it down");
};

const pick = function (game, index) {
    const p = game.players[index];
    if (!p || game.phase !== "playing" || isStunned(game, p)) return;
    const t = targetTile(p);
    const ch = tileAt(t.x, t.y);
    const k = keyOf(t.x, t.y);
    if (p.held === null) pickUp(game, p, t, ch, k);
    else putDown(game, p, t, ch, k);
};

// ---------- T: throw (a hit stuns the rival and makes them drop what they carry) ----------
const throwItem = function (game, index, angle) {
    const p = game.players[index];
    if (!p || game.phase !== "playing" || isStunned(game, p)) return;
    if (!p.held) { say(game, p, "Nothing to throw"); return; }
    if (p.held.name === "plate") { say(game, p, "Plates can't be thrown"); return; }
    if (typeof angle !== "number" || !isFinite(angle)) return;
    const dx = Math.cos(angle), dy = Math.sin(angle);
    game.projectiles.push({
        id: game.nextId++, owner: index, item: p.held,
        x: p.x + dx * 0.3, y: p.y + dy * 0.3,
        vx: dx * SETTINGS.throwSpeed, vy: dy * SETTINGS.throwSpeed,
        dist: 0, lastFloor: { x: p.x, y: p.y }
    });
    p.held = null;
    p.fx = dx;
    p.fy = dy;
    event(game, { kind: "throw", to: index });
};

// ---------- Cheat skill: 15 s on, then 30 s cooldown ----------
// Turned on by the key combination (W S W S A D A D) or the cheat button; C (or the button) ends it early.
const endCheat = function (game, p) {
    p.cheat = false;
    p.cheatReadyAt = game.clock + SETTINGS.cheatCooldown;
    event(game, { kind: "cheat", to: p.index, x: p.x, y: p.y - 1, text: "CHEAT OFF", on: false, cooldown: SETTINGS.cheatCooldown });
};

const cheatOn = function (game, index) {
    const p = game.players[index];
    if (!p || game.phase !== "playing" || p.cheat) return;
    if (game.clock < p.cheatReadyAt) {
        say(game, p, "Cheat is recharging: " + Math.ceil(p.cheatReadyAt - game.clock) + " s");
        return;
    }
    p.cheat = true;
    p.cheatUntil = game.clock + SETTINGS.cheatTime;
    event(game, { kind: "cheat", to: index, x: p.x, y: p.y - 1, text: "CHEAT ON", on: true, time: SETTINGS.cheatTime });
};

const cheatOff = function (game, index) {
    const p = game.players[index];
    if (!p || game.phase !== "playing" || !p.cheat) return;
    endCheat(game, p);
};

const toggleCheat = function (game, index) {                       // the on-screen cheat button
    const p = game.players[index];
    if (p && p.cheat) cheatOff(game, index);
    else cheatOn(game, index);
};

// ---------- Space: sprint skill (run faster for 5 s, then 10 s cooldown) ----------
const isSprinting = (game, p) => game.clock < p.sprintUntil;

const sprint = function (game, index) {
    const p = game.players[index];
    if (!p || game.phase !== "playing" || isStunned(game, p)) return;
    if (isSprinting(game, p)) return;
    if (game.clock < p.sprintReadyAt) {
        say(game, p, "Sprint is recharging: " + Math.ceil(p.sprintReadyAt - game.clock) + " s");
        return;
    }
    p.sprintUntil = game.clock + SETTINGS.sprintTime;
    p.sprintReadyAt = p.sprintUntil + SETTINGS.sprintCooldown;
    event(game, { kind: "sprint", to: index, x: p.x, y: p.y - 1, text: "SPRINT!" });
};

const setInput = function (game, index, input) {
    const p = game.players[index];
    if (!p || !input) return;
    if (input.chop && !p.input.chop) p.chopPressed = true;     // explain once if O does nothing
    ["up", "down", "left", "right", "chop"].forEach((k) => { p.input[k] = !!input[k]; });
};

// ---------- Every tick ----------
// Why can't the chef chop right now? (null = they can)
const chopProblem = function (game, p) {
    const t = targetTile(p);
    const ch = tileAt(t.x, t.y);
    if (ch !== "K") return "Face your chopping board to chop";
    if (sideOfX(t.x) !== p.index) return "That's " + game.players[1 - p.index].name + "'s chopping board";
    const item = game.tiles[keyOf(t.x, t.y)];
    if (!item) return "Put an ingredient on the board first";
    if (item.name === "plate") return "Plates don't need chopping";
    if (item.state !== "raw") return "Already chopped";
    return null;
};

const updatePlayer = function (game, p, dt) {
    p.moving = false;
    p.chopping = false;
    if (isStunned(game, p)) { p.chopPressed = false; return; }

    let vx = (p.input.right ? 1 : 0) - (p.input.left ? 1 : 0);
    let vy = (p.input.down ? 1 : 0) - (p.input.up ? 1 : 0);
    if (vx || vy) {
        const len = Math.hypot(vx, vy);
        vx /= len; vy /= len;
        p.fx = vx; p.fy = vy;
        const ox = p.x, oy = p.y;
        const speed = SETTINGS.speed * (isSprinting(game, p) ? SETTINGS.sprintBoost : 1) *
            (game.clock < p.boostUntil ? SETTINGS.boostSpeed : 1);       // sprint and the serving boost stack
        const nx = p.x + vx * speed * dt;
        if (!blocked(nx, p.y)) p.x = nx;
        const ny = p.y + vy * speed * dt;
        if (!blocked(p.x, ny)) p.y = ny;
        p.moving = Math.hypot(p.x - ox, p.y - oy) > 0.001;
    }
    // Chopping works while standing still, even if a direction key is still held against the board
    if (p.moving || !p.input.chop) return;
    const problem = chopProblem(game, p);
    if (p.chopPressed && problem) say(game, p, problem);
    p.chopPressed = false;
    if (problem) return;
    const t = targetTile(p);
    const item = game.tiles[keyOf(t.x, t.y)];
    p.chopping = true;
    item.chop = p.cheat ? 1 : item.chop + dt / SETTINGS.chopTime;       // cheat: instant chop
    if (item.chop >= 1) { item.chop = 1; item.state = "chopped"; }
};

const updatePots = function (game, dt) {
    POT_TILES.forEach(function (k) {
        const pot = game.tiles[k];
        const x = Number(k.split(",")[0]), y = Number(k.split(",")[1]);
        const owner = game.players[sideOfX(x)];
        if (pot.state === "cooking") {
            const need = RECIPES[pot.dish].cookTime;
            pot.cook = owner.cheat ? need : pot.cook + dt;                // cheat: instant cooking
            if (pot.cook >= need) { pot.cook = need; pot.state = "done"; pot.burn = 0; }
        } else if (pot.state === "done") {
            pot.burn += dt;
            if (pot.burn >= SETTINGS.burnTime) {
                pot.state = "burnt";
                event(game, { kind: "burnt", to: owner.index, x: x + 0.5, y: y + 0.6, text: "BURNT!" });
            }
        }
    });
};

const stepProjectile = function (game, pr, dt) {
    const steps = 4, sdt = dt / steps;
    for (let i = 0; i < steps; i++) {
        const nx = pr.x + pr.vx * sdt, ny = pr.y + pr.vy * sdt;
        const ch = tileAt(Math.floor(nx), Math.floor(ny));
        if (ch !== "." && ch !== "C") {                         // walls and stations stop it; it flies over counters
            dropOnFloor(game, pr.item, pr.lastFloor.x, pr.lastFloor.y);
            return false;
        }
        pr.x = nx; pr.y = ny;
        pr.dist += SETTINGS.throwSpeed * sdt;
        if (ch === ".") pr.lastFloor = { x: nx, y: ny };

        const target = game.players[1 - pr.owner];
        if (Math.hypot(target.x - pr.x, target.y - pr.y) < 0.5) {
            target.stunUntil = game.clock + SETTINGS.stunTime;
            game.players[pr.owner].hits++;
            if (target.held) {                                  // bump: they drop what they carry
                dropOnFloor(game, target.held, target.x + 0.4, target.y + 0.2);
                target.held = null;
            }
            dropOnFloor(game, pr.item, target.x - 0.3, target.y + 0.2);
            event(game, { kind: "hit", to: target.index, x: target.x, y: target.y - 1, text: "BONK!" });
            return false;
        }
        if (pr.dist >= SETTINGS.throwRange) {
            const k = keyOf(Math.floor(pr.x), Math.floor(pr.y));
            if (ch === "C" && !game.tiles[k]) game.tiles[k] = pr.item;          // lands on the counter
            else dropOnFloor(game, pr.item, pr.lastFloor.x, pr.lastFloor.y);
            return false;
        }
    }
    return true;
};

const addOrder = function (game, p) {
    const recipe = game.sequence[p.nextOrder % game.sequence.length];
    p.nextOrder++;
    p.orders.push({ id: game.nextId++, recipe, timeLeft: SETTINGS.orderTime, total: SETTINGS.orderTime });
    p.orderTimer = 0;
};

const updateOrders = function (game, p, dt) {
    p.orders.forEach((o) => { o.timeLeft -= dt; });
    if (game.overtime) return;                                   // overtime: only the Sudden Death Dish, no new orders
    p.orders.filter((o) => o.timeLeft <= 0).forEach(function (o) {
        const damage = RECIPES[o.recipe].hearts;                 // a missed order costs its hearts
        p.missed++;
        p.hearts = Math.max(0, p.hearts - damage);
        event(game, { kind: "expire", to: p.index, x: p.x, y: p.y - 1, text: "-" + heartText(damage), order: o.id });
    });
    p.orders = p.orders.filter((o) => o.timeLeft > 0);
    p.orderTimer += dt;
    if (p.orders.length < SETTINGS.maxOrders &&
        (p.orderTimer >= SETTINGS.orderGap || p.orders.length < SETTINGS.minOrders)) {
        addOrder(game, p);
    }
};

// Regular time ended level on hearts: both chefs get the same random dish, first to serve it wins
const startOvertime = function (game) {
    const keys = Object.keys(RECIPES);
    const recipe = keys[Math.floor(Math.random() * keys.length)];
    game.overtime = true;
    game.suddenDish = recipe;
    game.suddenWinner = null;
    game.timeLeft = SETTINGS.overtime;
    game.players.forEach(function (p) {
        p.orders = [{ id: game.nextId++, recipe, timeLeft: SETTINGS.overtime, total: SETTINGS.overtime, sudden: true }];
    });
    event(game, { kind: "overtime", to: -1, x: COLS / 2, y: ROWS / 2 - 1, text: "SUDDEN DEATH DISH!", recipe });
};

// reason: "ko" (ran out of hearts), "double-ko", "time" (more hearts), "sudden" (served the Sudden Death Dish), "overtime-draw"
const finish = function (game, winner, reason) {
    game.phase = "over";
    game.winner = winner;
    game.endReason = reason;
    game.players.forEach(function (p) {
        p.knockedOut = p.hearts <= 0 || (reason === "sudden" && p.index !== winner);
    });
    if (reason === "ko" || reason === "double-ko" || reason === "sudden") {
        game.players.filter((p) => p.knockedOut).forEach(function (p) {
            event(game, { kind: "ko", to: p.index, x: p.x, y: p.y - 1, text: "K.O.!" });
        });
    }
};

// Has the round ended? (called at the end of every tick)
const checkEnd = function (game) {
    const [a, b] = game.players;
    if (game.overtime && game.suddenWinner !== null) { finish(game, game.suddenWinner, "sudden"); return true; }
    const outA = a.hearts <= 0, outB = b.hearts <= 0;
    if (outA && outB) { finish(game, -1, "double-ko"); return true; }      // both out at the same moment: draw
    if (outA || outB) { finish(game, outA ? 1 : 0, "ko"); return true; }   // last chef standing
    if (game.timeLeft > 0) return false;
    game.timeLeft = 0;
    if (game.overtime) { finish(game, -1, "overtime-draw"); return true; }
    if (a.hearts !== b.hearts) { finish(game, a.hearts > b.hearts ? 0 : 1, "time"); return true; }   // half hearts count
    startOvertime(game);
    return false;
};

// One tick. Returns "over" on the tick the round ends.
const step = function (game, dt) {
    if (game.phase === "countdown") {
        game.countdown -= dt;
        if (game.countdown <= 0) { game.countdown = 0; game.phase = "playing"; }
        return null;
    }
    if (game.phase !== "playing") return null;

    game.clock += dt;
    game.timeLeft -= dt;
    game.players.forEach((p) => { if (p.cheat && game.clock >= p.cheatUntil) endCheat(game, p); });   // 15 s are up
    game.players.forEach((p) => updatePlayer(game, p, dt));
    updatePots(game, dt);
    game.projectiles = game.projectiles.filter((pr) => stepProjectile(game, pr, dt));
    game.players.forEach((p) => updateOrders(game, p, dt));

    game.floor = game.floor.filter((f) => f.life === null || game.clock < f.born + f.life);   // ingredients vanish
    game.spawnTimer -= dt;
    if (game.spawnTimer <= 0) {
        spawnIngredient(game);
        game.spawnTimer = rand(SETTINGS.spawnMin, SETTINGS.spawnMax);
    }

    return checkEnd(game) ? "over" : null;
};

// ---------- What the browsers receive ----------
const round = (n) => Math.round(n * 1000) / 1000;

const snapshot = function (game) {
    return {
        phase: game.phase,
        ready: game.ready,
        countdown: Math.ceil(game.countdown),
        timeLeft: Math.max(0, game.timeLeft),
        winner: game.winner,
        endReason: game.endReason,
        hearts: game.hearts,                                       // starting hearts picked in the waiting room
        overtime: game.overtime,
        suddenDish: game.suddenDish,
        players: game.players.map((p) => ({
            name: p.name, username: p.username,
            x: round(p.x), y: round(p.y), fx: round(p.fx), fy: round(p.fy), target: targetTile(p),
            held: p.held, stun: round(Math.max(0, p.stunUntil - game.clock)),
            hearts: p.hearts, knockedOut: p.knockedOut,
            served: p.served, grabbed: p.grabbed, missed: p.missed, hits: p.hits,
            cheat: p.cheat, chopping: p.chopping, moving: p.moving,
            boosting: game.clock < p.boostUntil,
            // seconds left on each skill, and seconds until it can be used again
            cheatLeft: p.cheat ? round(p.cheatUntil - game.clock) : 0,
            cheatWait: p.cheat ? 0 : round(Math.max(0, p.cheatReadyAt - game.clock)),
            sprinting: isSprinting(game, p),
            sprintLeft: round(Math.max(0, p.sprintUntil - game.clock)),
            sprintWait: isSprinting(game, p) ? 0 : round(Math.max(0, p.sprintReadyAt - game.clock)),
            orders: p.orders.map((o) => ({ id: o.id, recipe: o.recipe, t: round(Math.max(0, o.timeLeft)), total: o.total, sudden: !!o.sudden }))
        })),
        tiles: game.tiles,
        floor: game.floor.map((f) => ({
            id: f.id, x: round(f.x), y: round(f.y), item: f.item,
            left: f.life === null ? null : round(f.born + f.life - game.clock),   // null = never vanishes
            life: f.life === null ? null : round(f.life), age: round(game.clock - f.born)
        })),
        projectiles: game.projectiles.map((pr) => ({ id: pr.id, x: round(pr.x), y: round(pr.y), item: pr.item })),
        events: game.events
    };
};

const config = function () {
    return {
        map: MAP, cols: COLS, rows: ROWS, recipes: RECIPES,
        settings: {
            chopTime: SETTINGS.chopTime, burnTime: SETTINGS.burnTime,
            throwRange: SETTINGS.throwRange, gameTime: SETTINGS.gameTime, overtime: SETTINGS.overtime,
            heartsMin: SETTINGS.heartsMin, heartsMax: SETTINGS.heartsMax,
            boostTime: SETTINGS.boostTime, boostSpeed: SETTINGS.boostSpeed,
            cheatTime: SETTINGS.cheatTime, cheatCooldown: SETTINGS.cheatCooldown,
            sprintTime: SETTINGS.sprintTime, sprintCooldown: SETTINGS.sprintCooldown, sprintBoost: SETTINGS.sprintBoost
        }
    };
};

module.exports = {
    SETTINGS, RECIPES, MAP, createGame, startRound, setReady, setHearts, step, pick, throwItem,
    cheatOn, cheatOff, toggleCheat, sprint, setInput, snapshot, config
};
