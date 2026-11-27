// Sound module: sound effects and background music with HTML <audio> elements (made by tools/make-sounds.js).
// Lecture links: 5.3 (IIFE module), 1.1 (<audio> element), 3.3 (jQuery events), localStorage (remembers mute)
// Outside the slides: cloneNode() so the same effect can overlap itself (e.g. fast chopping),
// and play() returns a promise that is rejected if the browser blocks sound before the first click.

const Sound = (function () {
    let muted = false;
    try { muted = localStorage.getItem("chefwars-muted") === "1"; } catch (e) { /* storage blocked: sound on */ }

    const element = (name) => document.getElementById("snd-" + name);

    // A sound effect. Each call plays a copy, so quick repeats don't cut each other off.
    const play = function (name, volume) {
        const el = element(name);
        if (muted || !el) return;
        const copy = el.cloneNode();
        copy.volume = volume === undefined ? 0.7 : volume;
        copy.play().catch(() => { /* not allowed yet (no click on the page so far) */ });
    };

    // Background music during a round
    const startMusic = function () {
        const el = element("music");
        if (!el) return;
        el.volume = 0.35;
        el.currentTime = 0;
        el.playbackRate = 1;
        if (!muted) el.play().catch(() => { /* blocked until the player clicks */ });
    };
    const stopMusic = function () {
        const el = element("music");
        if (el) el.pause();
    };

    // The music gets faster as the round heats up (1 = normal speed).
    // Outside the slides: the playbackRate property of an <audio> element.
    const setMusicRate = function (rate) {
        const el = element("music");
        if (el && el.playbackRate !== rate) el.playbackRate = rate;
    };

    // Many sound cards and Bluetooth headphones switch off when nothing plays and need a second or two to wake
    // up, so the first sounds of a page (the countdown beeps) were lost. A silent loop from the waiting room
    // until the round is over keeps the audio output awake.
    let awake = false;
    const keepAwake = function (on) {
        const el = element("wake");
        awake = on;
        if (!el) return;
        if (on && !muted) el.play().catch(() => { /* not allowed yet: tried again on the next click */ });
        else el.pause();
    };

    const setMuted = function (on) {
        muted = on;
        try { localStorage.setItem("chefwars-muted", on ? "1" : "0"); } catch (e) { /* ignore */ }
        const music = element("music");
        if (music && on) music.pause();
        if (on) { const wake = element("wake"); if (wake) wake.pause(); } else if (awake) keepAwake(true);
        $("#mute-btn").text(on ? "🔇" : "🔊").attr("title", on ? "Sound off (click to turn on)" : "Sound on (click to mute)");
    };

    const init = function (playingMusic) {
        setMuted(muted);
        $("#mute-btn").on("click", function () {
            setMuted(!muted);
            if (!muted && playingMusic()) element("music").play().catch(() => { /* ignore */ });
            $(this).blur();
        });
    };

    return { init, play, startMusic, stopMusic, setMusicRate, keepAwake, isMuted: () => muted };
})();
