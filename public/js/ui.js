// UI module: switching pages (home, waiting, waiting room, game, game over) and the wins dashboard.
// Lecture links: 5.3 (IIFE module), 3.1/3.3 (jQuery DOM, show/hide, fadeIn), 7.5 (form validation),
// 8.2 (fetch for the ranking), 4.1 (SVG trophy/coin icons)

const UI = (function () {

    const PAGES = ["home", "queue", "room", "game", "over"];

    const show = function (page) {
        PAGES.forEach((p) => $("#page-" + p).toggleClass("hidden", p !== page));
        $("body").attr("data-page", page);
        window.scrollTo(0, 0);
    };

    // ---------- Signed in / out ----------
    const setUser = function (user) {
        $("#auth").toggleClass("hidden", !!user);
        $("#play-card").toggleClass("hidden", !user);
        $("#user-badge").toggleClass("hidden", !user);
        if (user) {
            $("#user-name, #welcome-name").text(user.name);
            $("#user-handle").text("@" + user.username);
        }
    };

    // ---------- Form errors ----------
    const clearErrors = function (form) {
        $(form).find(".field-error").text("");
        $(form).find("input").removeClass("bad");
        $(form).find(".form-error").text("");
    };

    const fieldError = function (form, field, message) {
        if (!field || field === "all") { $(form).find(".form-error").text(message); return; }
        $(form).find("[name=" + field + "]").addClass("bad")
            .siblings(".field-error").text(message);
    };

    // Same rules as the server, checked here first so the player sees mistakes instantly
    const validateRegister = function (data) {
        const errors = [];
        if (!data.username) errors.push(["username", "Username is required"]);
        else if (!/^\w+$/.test(data.username)) errors.push(["username", "Letters, numbers and _ only"]);
        else if (data.username.length < 3 || data.username.length > 16) errors.push(["username", "Must be 3-16 characters"]);
        if (!data.name) errors.push(["name", "Display name is required"]);
        else if (data.name.length < 2 || data.name.length > 16) errors.push(["name", "Must be 2-16 characters"]);
        if (!data.password) errors.push(["password", "Password is required"]);
        else if (data.password.length < 6) errors.push(["password", "At least 6 characters"]);
        if (!data.confirm) errors.push(["confirm", "Please type the password again"]);
        else if (data.password !== data.confirm) errors.push(["confirm", "Passwords don't match"]);
        return errors;
    };

    // ---------- Who is waiting ----------
    // list = [{ username, name }] (compared by username, since display names can repeat)
    const setQueue = function (list) {
        const me = Auth.getUser();
        const chips = (target) => {
            const box = $(target).empty();
            if (list.length === 0) { box.append($("<span class='muted'>Nobody yet</span>")); return; }
            list.forEach(function (u) {
                const chip = $("<span class='chip'></span>").text(u.name + (me && u.username === me.username ? " (you)" : ""));
                if (me && u.username === me.username) chip.addClass("me");
                box.append(chip);
            });
        };
        chips("#waiting-list-home");
        chips("#waiting-list-queue");
    };

    // ---------- Waiting room ----------
    const showRoom = function (me, opponent) {
        $("#room-me").text(me);
        $("#room-opponent").text(opponent);
        $("#ready-btn").text("I'm ready!").removeClass("on").prop("disabled", false);
        $("#ready-me, #ready-opponent").text("Not ready").removeClass("ready");
        show("room");
    };

    const updateRoom = function (state, myIndex) {
        const mine = state.ready[myIndex], theirs = state.ready[1 - myIndex];
        $("#ready-me").text(mine ? "Ready!" : "Not ready").toggleClass("ready", mine);
        $("#ready-opponent").text(theirs ? "Ready!" : "Not ready").toggleClass("ready", theirs);
        $("#ready-btn").text(mine ? "Cancel ready" : "I'm ready!").toggleClass("on", mine);
        $("#room-hint").text(mine && !theirs ? "Waiting for your opponent to press Ready..." :
            (!mine && theirs ? "Your opponent is ready. Press Ready to start!" : "The game starts when both chefs are ready."));
    };

    // ---------- Wins dashboard ----------
    const loadDashboard = function (selector) {
        const box = $(selector);
        fetch("/ranking")
            .then((res) => res.json())
            .then(function (list) {
                box.empty();
                const me = Auth.getUser();
                const games = list.reduce((sum, u) => sum + u.games, 0) / 2;
                const top = list[0] && list[0].wins > 0 ? list[0] : null;

                const tiles = $("<div class='dash-tiles'></div>");
                const tile = (label, value) => $("<div class='dash-tile'></div>")
                    .append($("<b></b>").text(value)).append($("<span></span>").text(label));
                tiles.append(tile("Chefs registered", list.length));
                tiles.append(tile("Games played", Math.round(games)));
                tiles.append(tile("Top chef", top ? top.name : "-"));
                box.append(tiles);

                if (list.length === 0) { box.append($("<p class='muted'>No chefs yet. Register to be the first!</p>")); return; }

                const maxWins = Math.max(1, list[0].wins);
                const rows = $("<ol class='dash-rows'></ol>");
                list.forEach(function (u, i) {           // every registered chef
                    const rate = u.games ? Math.round(u.wins / u.games * 100) : 0;
                    const row = $("<li class='dash-row'></li>");
                    if (me && u.username === me.username) row.addClass("me");
                    const rank = $("<span class='dash-rank'></span>").text(i + 1);
                    if (i === 0 && u.wins > 0) rank.html("<img src='img/icons/trophy.svg' alt='1'>");
                    row.append(rank);
                    const main = $("<div class='dash-main'></div>");
                    main.append($("<div class='dash-name'></div>").text(u.name).append($("<small></small>").text(" @" + u.username)));
                    const barWrap = $("<div class='dash-bar'></div>");
                    barWrap.append($("<i></i>").css("width", (u.wins / maxWins * 100) + "%"));
                    main.append(barWrap);
                    row.append(main);
                    row.append($("<div class='dash-wins'></div>").append($("<b></b>").text(u.wins)).append($("<span>wins</span>")));
                    row.append($("<div class='dash-extra'></div>").text(
                        u.games + (u.games === 1 ? " game" : " games") + " · " + rate + "% win rate · best score " + u.best));
                    rows.append(row);
                });
                box.append(rows);
                const myRow = rows.find(".dash-row.me").get(0);     // long list: scroll your own row into view
                if (myRow) rows.scrollTop(myRow.offsetTop - rows.get(0).offsetTop - 40);
            })
            .catch(() => box.html("<p class='muted'>Could not load the dashboard.</p>"));
    };

    // ---------- Round length (GAME_TIME can change it) ----------
    const formatLength = function (secs) {
        if (secs % 60 === 0) return (secs / 60) + (secs === 60 ? " minute" : " minutes");
        if (secs > 60 && secs % 30 === 0) return Math.floor(secs / 60) + "½ minutes";
        return secs + " seconds";
    };
    const loadRules = function () {
        fetch("/rules").then((res) => res.json())
            .then((rules) => $(".round-length").text(formatLength(rules.gameTime)))
            .catch(() => { /* keep the default text */ });
    };

    // ---------- Game over page ----------
    const showOver = function (state, myIndex) {
        const w = state.winner;
        $("#over-title").text(w === -1 ? "It's a draw!" : (w === myIndex ? "You win!" : "You lose!"))
            .toggleClass("win", w === myIndex);
        const [a, b] = state.players;
        $("#over-p1").text(a.name + (w === 0 ? " 👑" : ""));
        $("#over-p2").text(b.name + (w === 1 ? " 👑" : ""));
        const rows = [
            ["Dishes served", "served"], ["Ingredients grabbed", "grabbed"],
            ["Orders missed", "missed"], ["Rivals bonked", "hits"], ["Final score", "score"]
        ];
        const body = $("#over-stats").empty();
        rows.forEach(function (r) {
            const tr = $("<tr></tr>");
            tr.append($("<th></th>").text(r[0]));
            [a, b].forEach(function (p, i) {
                const other = i ? a : b;
                const better = r[1] === "missed" ? p[r[1]] < other[r[1]] : p[r[1]] > other[r[1]];
                tr.append($("<td></td>").text(p[r[1]]).toggleClass("best", better));
            });
            body.append(tr);
        });
        $("#over-note").text(a.score === b.score && w !== -1 ? "Tied on points, so dishes served decided it." : "");
        loadDashboard("#dashboard-over");
        show("over");
    };

    return { show, setUser, clearErrors, fieldError, validateRegister, setQueue, showRoom, updateRoom, loadDashboard, loadRules, showOver };
})();
