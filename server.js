// Chef Wars: Showdown Battle server
// Lecture links: 7.4 (Express static + JSON endpoints), 8.3 (fs + JSON file "database"),
// 9.2 (express-session for sign-in, crypto module), 10.1 (Socket.IO + Express, server relays between browsers),
// 11.1 (receiving posted JSON data with express.json)
// Outside the slides: crypto.scryptSync to hash passwords, io.engine.use() to share the session with Socket.IO

const express = require("express");
const session = require("express-session");
const crypto = require("crypto");
const fs = require("fs");
const { createServer } = require("http");
const { Server } = require("socket.io");
const Game = require("./game");

const app = express();
app.use(express.static("public"));
app.use("/vendor", express.static("node_modules/jquery/dist"));
app.use(express.json());

// Session cookie lasts a day, so refreshing the page keeps you signed in (9.2)
const gameSession = session({
    secret: "chef-rush-secret",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
});
app.use(gameSession);

// ---------- Users stored in data/users.json ----------
const USERS_FILE = "data/users.json";

// Outside the slides: Object.create(null) makes an object with no built-in keys, so usernames
// like "constructor" or "__proto__" are looked up as normal names instead of matching Object's own properties
const readUsers = function () {
    const users = Object.create(null);
    if (!fs.existsSync(USERS_FILE)) return users;
    try { return Object.assign(users, JSON.parse(fs.readFileSync(USERS_FILE))); } catch (e) { return users; }
};
const writeUsers = function (users) {
    fs.mkdirSync("data", { recursive: true });
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, "  "));
};

const hashPassword = function (password, salt) {
    return crypto.scryptSync(password, salt, 64).toString("hex");
};

// bestServed = most dishes served in one game (the "best score" on the dashboard)
const newStats = () => ({ games: 0, wins: 0, losses: 0, draws: 0, bestServed: 0, served: 0, grabbed: 0, missed: 0, hits: 0 });

// The same rules are checked in the browser, but the server is the one that counts
const checkRegistration = function ({ username, name, password, confirm }) {
    if (!username) return { field: "username", error: "Username is required." };
    if (!name) return { field: "name", error: "Display name is required." };
    if (!password) return { field: "password", error: "Password is required." };
    if (!confirm) return { field: "confirm", error: "Please type the password again." };
    if (!/^\w+$/.test(username)) return { field: "username", error: "Username can only use letters, numbers and _." };
    if (username.length < 3 || username.length > 16) return { field: "username", error: "Username must be 3-16 characters." };
    if (name.length < 2 || name.length > 16) return { field: "name", error: "Display name must be 2-16 characters." };
    if (password.length < 6) return { field: "password", error: "Password must be at least 6 characters." };
    if (password !== confirm) return { field: "confirm", error: "The two passwords don't match." };
    return null;
};

app.post("/register", (req, res) => {
    const username = String(req.body.username || "").trim();
    const name = String(req.body.name || "").trim();
    const password = String(req.body.password || "");
    const confirm = String(req.body.confirm || "");

    const problem = checkRegistration({ username, name, password, confirm });
    if (problem) { res.json(Object.assign({ status: "error" }, problem)); return; }

    const users = readUsers();
    if (users[username.toLowerCase()]) {
        res.json({ status: "error", field: "username", error: "That username is already taken." });
        return;
    }
    const salt = crypto.randomBytes(16).toString("hex");
    users[username.toLowerCase()] = { username, name, salt, hash: hashPassword(password, salt), stats: newStats() };
    writeUsers(users);
    res.json({ status: "success" });
});

app.post("/signin", (req, res) => {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");
    if (!username || !password) { res.json({ status: "error", error: "Enter your username and password." }); return; }

    const user = readUsers()[username.toLowerCase()];
    if (!user) { res.json({ status: "error", field: "username", error: "No account with that username." }); return; }
    const attempt = Buffer.from(hashPassword(password, user.salt), "hex");
    if (!crypto.timingSafeEqual(attempt, Buffer.from(user.hash, "hex"))) {
        res.json({ status: "error", field: "password", error: "Wrong password." });
        return;
    }
    req.session.user = { username: user.username, name: user.name };
    res.json({ status: "success", user: req.session.user });
});

// Lets the register form warn about a taken username before submitting (the POST checks again)
app.get("/check-username", (req, res) => {
    const username = String(req.query.username || "").trim().toLowerCase();
    res.json({ taken: !!(username && readUsers()[username]) });
});

// Round and overtime length for the "How to play" box (GAME_TIME / OVERTIME can change them)
app.get("/rules", (req, res) => {
    res.json({ gameTime: Game.SETTINGS.gameTime, overtime: Game.SETTINGS.overtime });
});

// Called when the page loads: are we still signed in?
app.get("/validate", (req, res) => {
    if (req.session.user) res.json({ status: "success", user: req.session.user });
    else res.json({ status: "error" });
});

app.get("/signout", (req, res) => {
    req.session.destroy(() => res.json({ status: "success" }));
});

// Ranking dashboard: everyone who registered, most wins first
app.get("/ranking", (req, res) => {
    const users = readUsers();
    const list = Object.keys(users).map(function (k) {
        const u = users[k];
        return Object.assign({ username: u.username, name: u.name }, newStats(), u.stats);
    });
    list.sort((a, b) => b.wins - a.wins || (b.wins / (b.games || 1)) - (a.wins / (a.games || 1)) || b.bestServed - a.bestServed);
    res.json(list);
});

// A broken request (e.g. invalid JSON) gets a short JSON error instead of Express's error page with file paths.
// Outside the slides: an Express error handler is the middleware with 4 parameters (err, req, res, next).
app.use(function (err, req, res, next) {
    res.status(err.status || 500).json({ status: "error", error: "Bad request." });
});

// ---------- Socket.IO ----------
const httpServer = createServer(app);
const io = new Server(httpServer);
io.engine.use(gameSession);                     // the socket can read req.session.user

io.use(function (socket, next) {
    if (socket.request.session && socket.request.session.user) next();
    else next(new Error("Please sign in first"));
});

const queue = [];                               // [{ socket, user }]
const games = {};                               // roomId -> game
let nextRoom = 1;
const TICK_MS = 1000 / Game.SETTINGS.tickRate;

const queueList = () => JSON.stringify(queue.map((q) => ({ username: q.user.username, name: q.user.name })));
const broadcastQueue = function () {
    io.emit("queue", queueList());
};

const broadcastState = function (game) {
    io.to(game.room).emit("state", JSON.stringify(Game.snapshot(game)));
    game.events = [];
};

const isBusy = function (username) {
    if (queue.some((q) => q.user.username === username)) return true;
    return Object.values(games).some((g) => g.phase !== "over" && g.players.some((p) => p.username === username));
};

const recordResults = function (game) {
    const users = readUsers();
    game.players.forEach(function (p, i) {
        const u = users[p.username.toLowerCase()];
        if (!u) return;
        const s = Object.assign(newStats(), u.stats);
        s.games++;
        if (game.winner === -1) s.draws++;
        else if (game.winner === i) s.wins++;
        else s.losses++;
        s.bestServed = Math.max(s.bestServed, p.served);
        s.served += p.served;
        s.grabbed += p.grabbed;
        s.missed += p.missed;
        s.hits += p.hits;
        u.stats = s;
    });
    writeUsers(users);
};

// The game moves forward by the real time since the last tick, so a busy computer (late timer ticks)
// doesn't make the clock, cooking and skills run slow. Capped at 0.1 s per tick so a long pause can't
// make chefs or throws jump through walls.
// Outside the slides: performance.now() is a millisecond timer with sub-millisecond precision.
const startLoop = function (game) {
    let last = performance.now();
    game.loop = setInterval(function () {
        const now = performance.now();
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        if (game.phase !== "countdown" && game.phase !== "playing") return;
        const result = Game.step(game, dt);
        broadcastState(game);
        if (result === "over") {
            recordResults(game);
            endGame(game);                      // nothing left to simulate, stop ticking
        }
    }, TICK_MS);
};

const endGame = function (game) {
    clearInterval(game.loop);
    delete games[game.room];
};

const tryPair = function () {
    while (queue.length >= 2) {
        const a = queue.shift(), b = queue.shift();
        const room = "room" + nextRoom++;
        const game = Game.createGame(room, [a.user, b.user]);
        games[room] = game;
        [a, b].forEach(function (entry, index) {
            const other = index === 0 ? b : a;
            entry.socket.join(room);
            entry.socket.data.game = game;
            entry.socket.data.index = index;
            entry.socket.emit("paired", JSON.stringify({ index, opponent: other.user.name, config: Game.config() }));
        });
        startLoop(game);
        broadcastState(game);
    }
    broadcastQueue();
};

const leaveQueue = function (socket) {
    const i = queue.findIndex((q) => q.socket === socket);
    if (i >= 0) { queue.splice(i, 1); broadcastQueue(); }
};

const leaveGame = function (socket) {
    const game = socket.data.game;
    if (!game) return;
    socket.leave(game.room);
    socket.data.game = null;
    if (game.phase !== "over") socket.to(game.room).emit("opponent left", game.players[socket.data.index].name);
    game.left = (game.left || 0) + 1;
    if (game.phase !== "over" || game.left >= 2) endGame(game);
};

io.on("connection", (socket) => {
    const user = socket.request.session.user;
    socket.emit("queue", queueList());

    socket.on("find match", () => {
        if (socket.data.game) leaveGame(socket);
        if (isBusy(user.username)) {
            socket.emit("match error", "You're already waiting or playing in another tab.");
            return;
        }
        queue.push({ socket, user });
        tryPair();
    });

    socket.on("cancel match", () => leaveQueue(socket));

    socket.on("ready", (on) => {
        const game = socket.data.game;
        if (!game) return;
        Game.setReady(game, socket.data.index, on);
        broadcastState(game);
    });

    // Waiting room: either chef picks the starting hearts (5-8); both see it and both have to press Ready again
    socket.on("hearts", (n) => {
        const game = socket.data.game;
        if (game && Game.setHearts(game, socket.data.index, n)) broadcastState(game);
    });

    socket.on("leave game", () => leaveGame(socket));

    const withGame = (fn) => function (data) {
        const game = socket.data.game;
        if (game) fn(game, socket.data.index, data);
    };
    socket.on("input", withGame((g, i, data) => { try { Game.setInput(g, i, JSON.parse(data)); } catch (e) { /* ignore */ } }));
    socket.on("pick", withGame((g, i) => Game.pick(g, i)));
    socket.on("throw", withGame((g, i, data) => { try { Game.throwItem(g, i, Number(JSON.parse(data).angle)); } catch (e) { /* ignore */ } }));
    socket.on("cheat", withGame((g, i) => Game.toggleCheat(g, i)));        // the cheat button
    socket.on("cheat on", withGame((g, i) => Game.cheatOn(g, i)));         // key combination W S W S A D A D
    socket.on("cheat off", withGame((g, i) => Game.cheatOff(g, i)));       // C
    socket.on("sprint", withGame((g, i) => Game.sprint(g, i)));

    socket.on("disconnect", () => {
        leaveQueue(socket);
        leaveGame(socket);
    });
});

const PORT = 8000;
httpServer.listen(PORT, "0.0.0.0", () => {
    console.log("Chef Wars running at http://localhost:" + PORT);
});
