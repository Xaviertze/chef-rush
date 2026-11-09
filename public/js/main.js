// Main script: connects all the modules.
// Lecture links: 3.3 (jQuery ready + events), 7.5 (form submit), 8.2 (AJAX), 10.1 (WebSocket events)

$(function () {
    let me = null;              // my chef index in the current game (0 or 1)
    let state = null;
    let prevPhase = null;
    let renderer = null;
    let imagesReady = false;

    const mine = () => (state && me !== null ? state.players[me] : null);

    Input.init("#kitchen");
    UI.loadRules();

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

    $("#cheat-btn").on("click", function () {
        Socket.cheat();
        $(this).blur();
    });

    Socket.on("queue", (names) => UI.setQueue(names));

    Socket.on("match error", function (message) {
        UI.show("home");
        $("#match-error").text(message);
    });

    Socket.on("connect error", function (message) {
        $("#match-error").text(message);
    });

    Socket.on("paired", function (data) {
        me = data.index;
        state = null;
        prevPhase = null;
        const myName = Auth.getUser().name;
        const names = me === 0 ? [myName, data.opponent] : [data.opponent, myName];
        UI.showRoom(myName, data.opponent);
        HUD.init(data.config, me, names);
        if (renderer) renderer.stop();
        renderer = Renderer($("#kitchen").get(0), data.config, me);

        Input.attach({
            input: (s) => Socket.input(s),
            pick: () => Socket.pick(),
            cheat: () => Socket.cheat(),
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
    const COLORS = { score: "#7dff6b", expire: "#ff6b5b", hit: "#ffd23f", cheat: "#ff7bf0", burnt: "#ff6b5b" };

    const handleEvent = function (e) {
        if (e.kind === "msg") { if (e.to === me) HUD.toast(e.text); return; }
        renderer.addPopup(e.x, e.y, e.text, COLORS[e.kind] || "#fff");
        if (e.kind === "score") HUD.markOrder(e.to, e.order, "served");
        if (e.kind === "expire") HUD.markOrder(e.to, e.order, "expired");
        if (e.kind === "hit" && e.to === me) {
            HUD.shake("#kitchen");
            HUD.toast("BONK! You dropped everything and you're stunned");
        }
        if (e.kind === "cheat" && e.to === me) {
            HUD.toast(e.on ? "Cheat ON: instant chopping & cooking, double points" : "Cheat OFF");
        }
    };

    Socket.on("state", function (s) {
        if (me === null || !renderer) return;
        state = s;
        (s.events || []).forEach(handleEvent);
        renderer.setState(s);

        if (s.phase === "lobby") UI.updateRoom(s, me);
        if (s.phase !== "lobby" && prevPhase === "lobby") UI.show("game");
        if (s.phase !== "lobby") HUD.update(s);
        if (s.phase === "countdown") HUD.showCount(String(s.countdown));
        if (s.phase === "playing" && prevPhase === "countdown") HUD.showCount("COOK!");
        if (s.phase === "over" && prevPhase !== "over") setTimeout(() => UI.showOver(s, me), 900);

        Input.setEnabled(s.phase === "playing");
        if (Input.isAiming()) {
            const p = mine();
            if (!p || !p.held || p.held.name === "plate") Input.cancelAim();
        }
        prevPhase = s.phase;
    });

    Socket.on("disconnect", function () {
        if (me !== null) {
            stopGame();
            UI.show("home");
            $("#match-error").text("Lost connection to the server.");
        }
    });
});
