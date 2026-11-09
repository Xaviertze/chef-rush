// Socket module: every WebSocket message between this browser and the server.
// Lecture links: 10.1 (Socket.IO on the browser: io(), emit(), on(), disconnect()), 7.1 (JSON messages)

const Socket = (function () {
    let socket = null;
    const handlers = {};

    const on = function (event, fn) { handlers[event] = fn; };
    const call = function (event, data) { if (handlers[event]) handlers[event](data); };

    // Only connect after signing in: the server reads the session cookie
    const connect = function () {
        if (socket) return;
        socket = io();
        socket.on("queue", (data) => call("queue", JSON.parse(data)));
        socket.on("match error", (message) => call("match error", message));
        socket.on("paired", (data) => call("paired", JSON.parse(data)));
        socket.on("state", (data) => call("state", JSON.parse(data)));
        socket.on("opponent left", (name) => call("opponent left", name));
        socket.on("connect_error", (err) => call("connect error", err.message));
        socket.on("disconnect", () => call("disconnect"));
    };

    const disconnect = function () {
        if (socket) socket.disconnect();
        socket = null;
    };

    const emit = function (event, data) { if (socket) socket.emit(event, data); };

    return {
        connect, disconnect, on,
        findMatch: () => emit("find match"),
        cancelMatch: () => emit("cancel match"),
        ready: (on) => emit("ready", on),
        leaveGame: () => emit("leave game"),
        input: (state) => emit("input", JSON.stringify(state)),
        pick: () => emit("pick"),
        throwAt: (angle) => emit("throw", JSON.stringify({ angle })),
        cheat: () => emit("cheat")
    };
})();
