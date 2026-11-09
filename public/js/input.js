// Input module: keyboard + mouse controls (each browser controls only its own chef).
// Lecture links: 5.3 (IIFE module), 3.3 (jQuery events), 6.2 (mouse position inside the canvas)
//
//   WASD or arrow keys   move
//   P                    pick up / put down / serve
//   O (hold)             chop (about 2 seconds)
//   T                    start aiming, T again throws at the mouse pointer (Esc cancels)
//   C                    cheat mode on / off

const Input = (function () {
    const MOVE = {
        ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
        KeyW: "up", KeyS: "down", KeyA: "left", KeyD: "right"
    };
    const ACTIONS = ["KeyP", "KeyO", "KeyT", "KeyC", "Escape"];
    const state = { up: false, down: false, left: false, right: false, chop: false };
    let enabled = false;
    let aiming = false;
    let mouse = null;
    let cb = null;

    const send = () => cb.input(Object.assign({}, state));

    const releaseAll = function () {
        let changed = false;
        Object.keys(state).forEach(function (k) {
            if (state[k]) { state[k] = false; changed = true; }
        });
        if (changed) send();
    };

    const cancelAim = function () {
        if (!aiming) return;
        aiming = false;
        cb.aim(null);
    };

    const toggleAim = function () {
        if (aiming) {
            if (mouse) cb.throwAt(mouse);
            cancelAim();
            return;
        }
        if (!cb.canThrow()) return;
        aiming = true;
        cb.aim(mouse);
    };

    const onKeyDown = function (e) {
        if (!enabled || !cb || $(e.target).is("input")) return;
        const code = e.originalEvent.code;
        if (MOVE[code]) {
            e.preventDefault();
            if (!state[MOVE[code]]) { state[MOVE[code]] = true; send(); }
            return;
        }
        if (ACTIONS.indexOf(code) < 0) return;
        e.preventDefault();
        if (e.originalEvent.repeat) return;
        if (code === "KeyP") cb.pick();
        if (code === "KeyO") { state.chop = true; send(); }
        if (code === "KeyT") toggleAim();
        if (code === "KeyC") cb.cheat();
        if (code === "Escape") cancelAim();
    };

    const onKeyUp = function (e) {
        if (!cb) return;
        const code = e.originalEvent.code;
        if (MOVE[code] && state[MOVE[code]]) { state[MOVE[code]] = false; send(); }
        if (code === "KeyO" && state.chop) { state.chop = false; send(); }
    };

    // Called once when the page loads
    const init = function (canvasSelector) {
        $(canvasSelector).on("mousemove", function (e) {
            if (!cb) return;
            mouse = cb.toWorld(e.pageX, e.pageY);
            if (aiming) cb.aim(mouse);
        });
        $(document).on("keydown", onKeyDown);
        $(document).on("keyup", onKeyUp);
        $(window).on("blur", function () { if (cb) { releaseAll(); cancelAim(); } });
    };

    // Called for every new game with that game's callbacks
    const attach = function (callbacks) {
        cb = callbacks;
        aiming = false;
        Object.keys(state).forEach((k) => { state[k] = false; });
    };

    const setEnabled = function (on) {
        if (enabled && !on && cb) { releaseAll(); cancelAim(); }
        enabled = on;
    };

    return { init, attach, setEnabled, cancelAim, isAiming: () => aiming };
})();
