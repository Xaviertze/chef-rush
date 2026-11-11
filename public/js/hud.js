// HUD module: hearts, order cards, clock (and overtime), skill buttons, cheat badges, countdown and toast during a game.
// Lecture links: 5.3 (IIFE module), 3.1/3.3 (jQuery DOM + fadeIn/fadeOut), 4.1 (SVG icons in <img>),
// 4.3 (animationend + restarting a CSS animation by resetting animation-name)

const HUD = (function () {
    let recipes = {};
    let settings = {};
    let me = 0;
    let cards = [{}, {}];
    let lastHearts = [null, null];

    const init = function (config, myIndex, names) {
        recipes = config.recipes;
        settings = config.settings;
        me = myIndex;
        cards = [{}, {}];
        lastHearts = [null, null];
        $("#orders-0, #orders-1, #hearts-0, #hearts-1").empty();
        $(".hud-player").removeClass("me");
        $("#hud-" + me).addClass("me");
        names.forEach((n, i) => $("#name-" + i).text(n + (i === me ? " (you)" : "")));
        const t = config.settings.gameTime;
        $("#clock").text(Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0")).removeClass("low overtime");
        $("#overtime-label").addClass("hidden");
        $("#cheat-btn").removeClass("on cooling").text("Cheat").css("--fill", "0%");
        $("#sprint-btn").removeClass("on cooling").text("Sprint (Space)").css("--fill", "0%");
        hideCount();
    };

    const restartAnimation = function (el, name) {
        el.css("animation-name", "none");
        el.get(0).offsetWidth;
        el.css("animation-name", name);
    };

    const makeCard = function (order) {
        const r = recipes[order.recipe];
        const cost = heartsLabel(r.hearts);
        const card = $("<div class='order'></div>").attr("title", r.label + ": " + r.how +
            (order.sudden ? " (Sudden Death Dish: first to serve it wins)" : " (miss it: lose " + cost + ")"));
        if (order.sudden) card.addClass("sudden");
        card.append($("<div class='order-bar'><i></i></div>"));
        const body = $("<div class='order-body'></div>");
        body.append($("<img class='order-dish'>").attr("src", Sprites.iconPath(r.icon)).attr("alt", r.label));
        const info = $("<div class='order-info'></div>");
        const tag = order.sudden ? $("<b class='sudden-tag'></b>").text("WIN!") : $("<b class='cost'></b>").text("-" + cost);
        info.append($("<div class='order-name'></div>").text(r.label).append(tag));
        const steps = $("<div class='order-ings'></div>");
        r.steps.forEach((name) => steps.append($("<img>").attr("src", Sprites.iconPath(name)).attr("alt", name).attr("title", name)));
        body.append(info);
        card.append(body);
        card.append(steps);                     // full-width row so the ingredient icons can be big
        return card;
    };

    const updateOrders = function (i, orders) {
        const box = $("#orders-" + i);
        const seen = {};
        orders.forEach(function (o) {
            seen[o.id] = true;
            let card = cards[i][o.id];
            if (!card) {
                card = makeCard(o);
                cards[i][o.id] = card;
                box.append(card);
            }
            const f = o.t / o.total;
            card.find(".order-bar i").css("width", (f * 100) + "%");
            card.toggleClass("warn", f < 0.4 && f >= 0.2).toggleClass("danger", f < 0.2);
        });
        Object.keys(cards[i]).forEach(function (id) {
            if (seen[id]) return;
            const card = cards[i][id];
            delete cards[i][id];
            card.addClass("leaving").on("animationend", function () { $(this).remove(); });
        });
    };

    const markOrder = function (i, id, cls) {
        if (cards[i] && cards[i][id]) cards[i][id].removeClass("warn danger").addClass(cls);
    };

    // "½♥", "1♥", "1½♥"
    const heartsLabel = (n) => (Math.floor(n) || "") + (n % 1 ? "½" : "") + "♥";

    // Hearts row: full, half and empty heart icons (the starting number of hearts in total)
    const drawHearts = function (i, hearts, start) {
        const box = $("#hearts-" + i);
        const icons = [];
        for (let k = 0; k < start; k++) {
            const left = hearts - k;
            icons.push(left >= 1 ? "heart" : (left >= 0.5 ? "heart-half" : "heart-empty"));
        }
        const key = icons.join(",");
        if (box.data("key") === key) return;                       // only rebuild when it changes
        box.data("key", key).empty();
        icons.forEach((name) => box.append($("<img>").attr("src", Sprites.iconPath(name)).attr("alt", "")));
        box.attr("title", hearts + " of " + start + " hearts left");
    };

    const update = function (state) {
        const t = Math.ceil(state.timeLeft);
        $("#clock").text(Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0"))
            .toggleClass("low", state.phase === "playing" && t <= 30 && !state.overtime)
            .toggleClass("overtime", !!state.overtime);
        $("#overtime-label").toggleClass("hidden", !state.overtime);

        state.players.forEach(function (p, i) {
            drawHearts(i, p.hearts, state.hearts);
            if (lastHearts[i] !== null && p.hearts < lastHearts[i]) restartAnimation($("#hearts-" + i), "shake");
            lastHearts[i] = p.hearts;
            $("#cheat-" + i).toggleClass("hidden", !p.cheat).text("CHEAT " + Math.ceil(p.cheatLeft) + "s");
            updateOrders(i, p.orders);
        });
        const p = state.players[me];
        skill("#cheat-btn", "Cheat", null, p.cheat, p.cheatLeft, settings.cheatTime, p.cheatWait, settings.cheatCooldown);
        skill("#sprint-btn", "Sprint", "Space", p.sprinting, p.sprintLeft, settings.sprintTime, p.sprintWait, settings.sprintCooldown);
    };

    // One skill button: "Cheat ON 12s" while on, "Cheat in 25s" while recharging, "Sprint (Space)" when ready
    const skill = function (selector, label, key, on, left, time, wait, cooldown) {
        let text = key ? label + " (" + key + ")" : label, used = 0;
        if (on) { text = label + " ON " + Math.ceil(left) + "s"; used = 1 - left / time; }
        else if (wait > 0) { text = label + " in " + Math.ceil(wait) + "s"; used = wait / cooldown; }
        $(selector).text(text).toggleClass("on", !!on).toggleClass("cooling", !on && wait > 0)
            .css("--fill", Math.round(used * 100) + "%");
    };

    const showCount = function (label) {
        const box = $("#countdown"), num = $("#count-num");
        if (!box.hasClass("hidden") && num.text() === label) return;
        box.removeClass("hidden");
        num.text(label);
        restartAnimation(num, "count-pop");
        if (label === "COOK!") setTimeout(() => box.addClass("hidden"), 800);
    };
    const hideCount = () => $("#countdown").addClass("hidden");

    const toast = function (message) {
        $("#toast").stop(true, true).text(message).fadeIn(120).delay(1400).fadeOut(300);
    };

    const shake = (selector) => restartAnimation($(selector), "shake");

    return { init, update, markOrder, showCount, hideCount, toast, shake };
})();
