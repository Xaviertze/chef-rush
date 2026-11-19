// Input module: keyboard + mouse controls (each browser controls only its own chef).
// Lecture links: 5.3 (IIFE module), 3.3 (jQuery events), 6.2 (mouse events and the mouse position inside the canvas)
// Outside the slides: event.button (0 = left, 2 = right) and the "contextmenu" event, prevented so
// right-click chops instead of opening the browser menu.
//
//   WASD or arrow keys   move
//   Left click, P or E   pick up / put down / serve (while aiming, left click throws)
//   Right click, R or O  hold to chop (about 2 seconds)
//   T or Q               start aiming at the mouse pointer; left click throws, T / Q again (or Esc) cancels
//   Space                sprint skill: run faster for 5 s, then 5 s to recharge
//   1 2 3 4              emotes (a bubble above your chef)
//   W S W S A D A D      secret cheat combination (up down up down left right left right, arrows work too)
//                        (the Cheat button above the kitchen also turns cheat on and off)

const Input = (function () {
    const MOVE = {
        ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
        KeyW: "up", KeyS: "down", KeyA: "left", KeyD: "right"
    };
    const PICK_KEYS = ["KeyP", "KeyE"];
    const CHOP_KEYS = ["KeyR", "KeyO"];
    const AIM_KEYS = ["KeyT", "KeyQ"];
    const EMOTE_KEYS = ["Digit1", "Digit2", "Digit3", "Digit4"];
    const ACTIONS = PICK_KEYS.concat(CHOP_KEYS, AIM_KEYS, EMOTE_KEYS, ["Space", "Escape"]);
    const state = { up: false, down: false, left: false, right: false, chop: false };
    const chopKeys = {};            // chop keys (R / O) held right now
    let chopMouse = false;          // right mouse button held
    let enabled = false;
    let aiming = false;
    let mouse = null;
    let cb = null;

    // Secret cheat combination: the last direction keys pressed, as U/D/L/R
    const COMBO = "UDUDLRLR";
    const LETTER = { up: "U", down: "D", left: "L", right: "R" };
    let typed = "";
    let lastTyped = 0;
    const comboKey = function (dir) {
        const now = Date.now();
        if (now - lastTyped > 1500) typed = "";            // too slow: start again
        lastTyped = now;
        typed = (typed + LETTER[dir]).slice(-COMBO.length);
        if (typed === COMBO) { typed = ""; cb.cheatOn(); }
    };

    const send = () => cb.input(Object.assign({}, state));

    // Chopping continues while any chop key (R / O) or the right mouse button is held
    const setChop = function () {
        const on = Object.keys(chopKeys).length > 0 || chopMouse;
        if (state.chop !== on) { state.chop = on; send(); }
    };

    const releaseAll = function () {
        Object.keys(chopKeys).forEach((k) => { delete chopKeys[k]; });
        chopMouse = false;
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

    // T / Q: start aiming, or cancel if already aiming
    const toggleAim = function () {
        if (aiming) { cancelAim(); return; }
        if (!cb.canThrow()) return;
        aiming = true;
        cb.aim(mouse);
    };

    // Left click while aiming
    const throwNow = function () {
        if (mouse) cb.throwAt(mouse);
        cancelAim();
    };

    const onKeyDown = function (e) {
        if (!enabled || !cb || $(e.target).is("input")) return;
        const code = e.originalEvent.code;
        if (MOVE[code]) {
            e.preventDefault();
            if (!state[MOVE[code]]) { state[MOVE[code]] = true; send(); }
            if (!e.originalEvent.repeat) comboKey(MOVE[code]);
            return;
        }
        if (ACTIONS.indexOf(code) < 0) return;
        e.preventDefault();
        if (e.originalEvent.repeat) return;
        if (PICK_KEYS.indexOf(code) >= 0) cb.pick();
        if (CHOP_KEYS.indexOf(code) >= 0) { chopKeys[code] = true; setChop(); }
        if (AIM_KEYS.indexOf(code) >= 0) toggleAim();
        if (code === "Space") cb.sprint();       // preventDefault above stops Space scrolling or pressing buttons
        if (code === "Escape") cancelAim();
        if (EMOTE_KEYS.indexOf(code) >= 0) cb.emote(EMOTE_KEYS.indexOf(code) + 1);
    };

    const onKeyUp = function (e) {
        if (!cb) return;
        const code = e.originalEvent.code;
        if (MOVE[code] && state[MOVE[code]]) { state[MOVE[code]] = false; send(); }
        if (chopKeys[code]) { delete chopKeys[code]; setChop(); }
    };

    // Mouse buttons work anywhere on the game page except on buttons (e.g. the cheat button)
    const onMouseDown = function (e) {
        if (!enabled || !cb || $(e.target).closest("button, input, a").length) return;
        if (e.button === 0) {
            e.preventDefault();                     // no text selection, keeps keyboard focus
            if (aiming) throwNow();                 // aiming: left click throws
            else cb.pick();
        }
        if (e.button === 2) {
            e.preventDefault();
            chopMouse = true;
            setChop();
        }
    };

    const onMouseUp = function (e) {
        if (!cb || e.button !== 2) return;
        chopMouse = false;
        setChop();
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
        $(document).on("mousedown", onMouseDown);
        $(document).on("mouseup", onMouseUp);
        $(document).on("contextmenu", function (e) { if (enabled) e.preventDefault(); });
        $(window).on("blur", function () { if (cb) { releaseAll(); cancelAim(); } });
    };

    // Called for every new game with that game's callbacks
    const attach = function (callbacks) {
        cb = callbacks;
        aiming = false;
        Object.keys(chopKeys).forEach((k) => { delete chopKeys[k]; });
        chopMouse = false;
        Object.keys(state).forEach((k) => { state[k] = false; });
    };

    const setEnabled = function (on) {
        if (enabled && !on && cb) { releaseAll(); cancelAim(); }
        enabled = on;
    };

    return { init, attach, setEnabled, cancelAim, isAiming: () => aiming };
})();
