// HUD module: order cards, scores, clock, cheat badges, countdown and toast during a game.
// Lecture links: 5.3 (IIFE module), 3.1/3.3 (jQuery DOM + fadeIn/fadeOut), 4.1 (SVG icons in <img>),
// 4.3 (animationend + restarting a CSS animation by resetting animation-name)

const HUD = (function () {
    let recipes = {};
    let me = 0;
    let cards = [{}, {}];
    let lastScores = [null, null];

    const init = function (config, myIndex, names) {
        recipes = config.recipes;
        me = myIndex;
        cards = [{}, {}];
        lastScores = [null, null];
        $("#orders-0, #orders-1").empty();
        $(".hud-player").removeClass("me");
        $("#hud-" + me).addClass("me");
        names.forEach((n, i) => $("#name-" + i).text(n + (i === me ? " (you)" : "")));
        $("#score-0, #score-1").text("0");
        const t = config.settings.gameTime;
        $("#clock").text(Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0")).removeClass("low");
        $("#cheat-btn").removeClass("on");
        hideCount();
    };

    const restartAnimation = function (el, name) {
        el.css("animation-name", "none");
        el.get(0).offsetWidth;
        el.css("animation-name", name);
    };

    const makeCard = function (order) {
        const r = recipes[order.recipe];
        const card = $("<div class='order'></div>").attr("title", r.label + ": " + r.how + " (" + r.points + " pts)");
        card.append($("<div class='order-bar'><i></i></div>"));
        const body = $("<div class='order-body'></div>");
        body.append($("<img class='order-dish'>").attr("src", Sprites.iconPath(r.icon)).attr("alt", r.label));
        const info = $("<div class='order-info'></div>");
        info.append($("<div class='order-name'></div>").text(r.label).append($("<b></b>").text(r.points)));
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

    const update = function (state) {
        const t = Math.ceil(state.timeLeft);
        $("#clock").text(Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0"))
            .toggleClass("low", state.phase === "playing" && t <= 30);

        state.players.forEach(function (p, i) {
            const el = $("#score-" + i);
            el.text(p.score);
            if (lastScores[i] !== null && p.score > lastScores[i]) restartAnimation(el, "bump");
            lastScores[i] = p.score;
            $("#cheat-" + i).toggleClass("hidden", !p.cheat);
            updateOrders(i, p.orders);
        });
        $("#cheat-btn").toggleClass("on", !!state.players[me].cheat)
            .text(state.players[me].cheat ? "Cheat: ON (C)" : "Cheat: OFF (C)");
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
