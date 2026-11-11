// Main script: connects all the modules.
// Lecture links: 3.3 (jQuery ready + events), 7.5 (form submit), 8.2 (AJAX), 10.1 (WebSocket events)

$(function () {
    let me = null;              // my chef index in the current game (0 or 1)
    let state = null;
    let prevPhase = null;
    let lastCount = null;           // last countdown number shown (for the beep)
    let recipeNames = {};           // recipe key -> "Garden Salad"
    let renderer = null;
    let imagesReady = false;

    const mine = () => (state && me !== null ? state.players[me] : null);

    Input.init("#kitchen");
    UI.loadRules();
    Sound.init(() => !!state && (state.phase === "countdown" || state.phase === "playing"));

    $("#find-btn").prop("disabled", true).text("Loading...");
    Sprites.load(function () {
        imagesReady = true;
        $("#find-btn").prop("disabled", false).text("Find match");
    });

    // ---------- Signing in / out ----------
    const signedIn = function (user) {
        UI.setUser(user);
        Socket.connect();
        UI.loadDashboard("#dashboard-home");        // reload so my own row is highlighted
        UI.show("home");
    };

    // A refresh keeps the session, so check it first
    Auth.validate().then(function (user) {
        if (user) signedIn(user);
        else { UI.setUser(null); UI.loadDashboard("#dashboard-home"); }
    }).catch(() => UI.loadDashboard("#dashboard-home"));

    $("#register-form").on("submit", function (e) {
        e.preventDefault();
        const form = this;
        UI.clearErrors(form);
        const data = {
            username: $(form).find("[name=username]").val().trim(),
            name: $(form).find("[name=name]").val().trim(),
            password: $(form).find("[name=password]").val(),
            confirm: $(form).find("[name=confirm]").val()
        };
        const errors = UI.validateRegister(data);
        if (errors.length) { errors.forEach((er) => UI.fieldError(form, er[0], er[1])); return; }

        Auth.register(data).then(function (json) {
            if (json.status !== "success") { UI.fieldError(form, json.field, json.error); return; }
            // Registered: sign straight in
            return Auth.signin(data.username, data.password).then(function (res) {
                if (res.status === "success") { form.reset(); signedIn(res.user); }
            });
        });
    });

    // Warn about a taken username as soon as the player leaves the field
    $("#register-form [name=username]").on("change", function () {
        const input = $(this), username = input.val().trim();
        const form = input.closest("form").get(0);
        if (UI.validateRegister({ username, name: "xx", password: "xxxxxx", confirm: "xxxxxx" }).length) return;
        Auth.usernameTaken(username).then(function (taken) {
            if (taken && input.val().trim() === username) UI.fieldError(form, "username", "That username is already taken");
            else if (!taken) input.removeClass("bad").siblings(".field-error").text("");
        }).catch(() => { /* the server checks again on submit */ });
    });

    $("#signin-form").on("submit", function (e) {
        e.preventDefault();
        const form = this;
        UI.clearErrors(form);
        const username = $(form).find("[name=username]").val().trim();
        const password = $(form).find("[name=password]").val();
        if (!username) { UI.fieldError(form, "username", "Username is required"); return; }
        if (!password) { UI.fieldError(form, "password", "Password is required"); return; }
        Auth.signin(username, password).then(function (json) {
            if (json.status !== "success") { UI.fieldError(form, json.field, json.error); return; }
            form.reset();
            signedIn(json.user);
        });
    });

    $("#signout-btn").on("click", function () {
        Socket.disconnect();
        Auth.signout().then(function () {
            UI.setUser(null);
            UI.setQueue([]);
            UI.loadDashboard("#dashboard-home");
            UI.show("home");
        });
    });

    // ---------- Pairing ----------
    $("#find-btn, #again-btn").on("click", function () {
        if (!Auth.getUser() || !imagesReady) return;
        stopGame();
        $("#match-error").text("");
        UI.show("queue");
        Socket.findMatch();
    });

    $("#cancel-btn").on("click", function () {
        Socket.cancelMatch();
        UI.show("home");
    });

    $("#home-btn").on("click", function () {
        stopGame();
        Socket.leaveGame();
        UI.loadDashboard("#dashboard-home");
        UI.show("home");
    });

    $("#leave-room-btn").on("click", function () {
        stopGame();
        Socket.leaveGame();
        UI.show("home");
    });

    $("#ready-btn").on("click", function () {
        if (!state) return;
        Socket.ready(!state.ready[me]);
    });

    // Waiting room: pick the starting hearts (the server checks 5-8 and un-readies both chefs)
    $("#hearts-options").on("click", "button", function () {
        if (!state || state.phase !== "lobby") return;
        Socket.setHearts(Number($(this).attr("data-hearts")));
    });

    $("#cheat-btn").on("click", function () {
        Socket.cheat();
        $(this).blur();
    });

    $("#sprint-btn").on("click", function () {
        Socket.sprint();
        $(this).blur();
    });

    Socket.on("queue", (names) => UI.setQueue(names));

    Socket.on("match error", function (message) {
        UI.show("home");
        $("#match-error").text(message);
    });

    // Connected (again): clear an old "Lost connection" message
    Socket.on("connect", function () {
        if (/^Lost connection/.test($("#match-error").text())) $("#match-error").text("");
    });

    // Sessions live in the server's memory, so after a server restart the socket is refused.
    // Show the sign-in forms again instead of a page that looks signed in but can't play.
    Socket.on("connect error", function (message) {
        if (message !== "Please sign in first") {                // server down: socket.io keeps retrying by itself
            $("#match-error").text("Lost connection to the server. Trying to reconnect...");
            return;
        }
        Socket.disconnect();
        stopGame();
        Auth.validate().catch(() => null).then(function (user) {
            UI.show("home");
            if (user) { $("#match-error").text("Could not connect to the game server. Please refresh the page."); return; }
            UI.setUser(null);
            UI.setQueue([]);
            UI.loadDashboard("#dashboard-home");
            $("#signin-form .form-error").text("Your session ended (the server was restarted). Please sign in again.");
        });
    });

    Socket.on("paired", function (data) {
        me = data.index;
        state = null;
        prevPhase = null;
        const myName = Auth.getUser().name;
        const names = me === 0 ? [myName, data.opponent] : [data.opponent, myName];
        UI.showRoom(myName, data.opponent);
        HUD.init(data.config, me, names);
        recipeNames = {};
        Object.keys(data.config.recipes).forEach((k) => { recipeNames[k] = data.config.recipes[k].label; });
        if (renderer) renderer.stop();
        renderer = Renderer($("#kitchen").get(0), data.config, me);

        Input.attach({
            input: (s) => Socket.input(s),
            pick: () => Socket.pick(),
            cheatOn: () => Socket.cheatOn(),
            cheatOff: () => Socket.cheatOff(),
            sprint: () => Socket.sprint(),
            toWorld: (x, y) => renderer.toWorld(x, y),
            aim: (point) => renderer.setAim(point),
            canThrow: function () {
                const p = mine();
                if (!p || !p.held) { HUD.toast("Pick up an ingredient to throw it"); return false; }
                if (p.held.name === "plate") { HUD.toast("Plates can't be thrown"); return false; }
                if (p.stun > 0) { HUD.toast("You're stunned!"); return false; }
                return true;
            },
            throwAt: function (point) {
                const p = mine();
                if (p) Socket.throwAt(Math.atan2(point.y - p.y, point.x - p.x));
            }
        });
    });

    const stopGame = function () {
        Sound.stopMusic();
        Input.setEnabled(false);
        me = null;
        state = null;
    };

    Socket.on("opponent left", function (name) {
        stopGame();
        Socket.leaveGame();
        UI.show("home");
        $("#match-error").text(name + " left the game.");
    });

    // ---------- Game events ----------
    const COLORS = {
        serve: "#7dff6b", expire: "#ff6b5b", cheathit: "#ff7bf0", hit: "#ffd23f", cheat: "#ff7bf0",
        burnt: "#ff6b5b", sprint: "#5ee0ff", overtime: "#ffd23f", ko: "#ff3b30"
    };

    const handleEvent = function (e) {
        if (e.kind === "msg") { if (e.to === me) HUD.toast(e.text); return; }
        const mineEvent = e.to === me;
        if (e.text) renderer.addPopup(e.x, e.y, e.text, COLORS[e.kind] || "#fff");
        if (e.kind === "serve") {
            HUD.markOrder(e.to, e.order, "served");
            if (mineEvent) { Sound.play("serve"); Sound.play("boost", 0.5); }
        }
        if (e.kind === "expire") {
            HUD.markOrder(e.to, e.order, "expired");
            if (mineEvent) { Sound.play("heart"); HUD.toast("Order missed: " + e.text); }
        }
        if (e.kind === "cheathit" && mineEvent) {
            Sound.play("heart");
            HUD.shake("#hearts-" + me);
            HUD.toast("Your rival is cheating: their dish took " + e.text.slice(1) + "!");
        }
        if (e.kind === "throw") Sound.play("throw", mineEvent ? 0.7 : 0.4);
        if (e.kind === "hit") {
            Sound.play("bonk");
            if (mineEvent) {
                HUD.shake("#kitchen");
                HUD.toast("BONK! You dropped everything and you're stunned");
            }
        }
        if (e.kind === "burnt" && mineEvent) Sound.play("burnt");
        if (e.kind === "sprint" && mineEvent) Sound.play("sprint");
        if (e.kind === "cheat") {
            if (e.on) Sound.play("cheat", mineEvent ? 0.7 : 0.4);
            if (mineEvent) HUD.toast(e.on ? "Cheat ON for " + e.time + " s: instant chopping & cooking, your dishes hurt your rival"
                : "Cheat OFF. Ready again in " + e.cooldown + " s");
        }
        if (e.kind === "overtime") {
            Sound.play("overtime");
            HUD.toast("Hearts are level! Sudden Death Dish: " + state.suddenDishLabel + ". First to serve it wins!");
        }
        if (e.kind === "ko") Sound.play("ko");
    };

    // Sounds for my own chef that come from the state, not from events
    let lastChopSound = 0;
    const ownSounds = function (before, after) {
        if (!before || !after) return;
        if (!before.held && after.held) Sound.play("pickup", 0.5);
        else if (before.held && !after.held && !after.stun) Sound.play("drop", 0.4);
        const now = performance.now();
        if (after.chopping && now - lastChopSound > 260) { Sound.play("chop", 0.6); lastChopSound = now; }
    };

    Socket.on("state", function (s) {
        if (me === null || !renderer) return;
        const before = state && state.players ? state.players[me] : null;
        state = s;
        if (s.suddenDish) s.suddenDishLabel = recipeNames[s.suddenDish];
        (s.events || []).forEach(handleEvent);
        renderer.setState(s);
        if (s.phase === "playing") ownSounds(before, s.players[me]);

        if (s.phase === "lobby") UI.updateRoom(s, me);
        if (s.phase !== "lobby" && prevPhase === "lobby") UI.show("game");
        if (s.phase !== "lobby") HUD.update(s);
        if (s.phase === "countdown") {
            if (prevPhase !== "countdown" || String(s.countdown) !== lastCount) Sound.play("count", 0.5);
            lastCount = String(s.countdown);
            HUD.showCount(lastCount);
        }
        if (s.phase === "playing" && prevPhase === "countdown") {
            HUD.showCount("COOK!");
            Sound.play("go", 0.6);
            Sound.startMusic();
        }
        if (s.phase === "over" && prevPhase !== "over") {
            Sound.stopMusic();
            Sound.play(s.winner === me ? "win" : "lose");
            setTimeout(() => UI.showOver(s, me), 900);
        }

        Input.setEnabled(s.phase === "playing");
        if (Input.isAiming()) {
            const p = mine();
            if (!p || !p.held || p.held.name === "plate") Input.cancelAim();
        }
        prevPhase = s.phase;
    });

    // The server forgets the waiting list and the game when the connection drops
    Socket.on("disconnect", function (reason) {
        if (reason === "io client disconnect") return;           // we closed it ourselves (signing out)
        if (me !== null || $("body").attr("data-page") === "queue") {
            stopGame();
            UI.show("home");
            $("#match-error").text("Lost connection to the server.");
        }
    });
});
