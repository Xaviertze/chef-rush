// Renderer module: draws the kitchen on the canvas about 60 times a second.
// Lecture links: 5.3 (module pattern with private state), 6.1/6.2 (canvas rect/arc/paths/text,
// mouse position inside the canvas with offset()), 6.3/6.4 (sprites + requestAnimationFrame,
// timestamps to time the walk/chop animations).
// Outside the slides: ctx.save/translate/rotate/restore and setLineDash.

const Renderer = function (canvas, config, me) {
    const ctx = canvas.getContext("2d");
    const TS = 48;
    const { map, cols, rows, settings, recipes } = config;
    canvas.width = cols * TS;
    canvas.height = rows * TS;

    const SIDE_COLORS = ["#e8463a", "#3a6cf0"];
    let state = null;
    let aimPoint = null;
    const shown = [null, null];
    const popups = [];
    let last = performance.now();

    const RECIPE_BY_ITEMS = {};
    Object.keys(recipes).forEach((r) => {
        RECIPE_BY_ITEMS[recipes[r].items.slice().sort().join("+")] = recipes[r].icon;
    });
    const sideOf = (x) => (x < cols / 2 ? 0 : 1);

    // ---------- Background (drawn once on an off-screen canvas) ----------
    const background = document.createElement("canvas");
    background.width = canvas.width;
    background.height = canvas.height;
    const bg = background.getContext("2d");
    const fill = (c, x, y, w, h, color) => { c.fillStyle = color; c.fillRect(x, y, w, h); };

    const drawFloor = function (px, py) {
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) fill(bg, px + i * 12, py + j * 12, 12, 12, (i + j) % 2 ? "#cfa35c" : "#df6b2e");
        }
    };

    const drawCounter = function (px, py, band, top) {
        fill(bg, px, py, TS, TS, "#111");
        fill(bg, px + 2, py + 2, TS - 4, TS - 4, top || "#3f5ff0");
        fill(bg, px + 2, py + TS - 13, TS - 4, 11, "#2c40b8");
        fill(bg, px + 2, py + TS - 8, TS - 4, 4, band || "#e0662c");
        fill(bg, px + TS / 2 - 4, py + TS - 8, 8, 3, "#ffd23f");
    };
    // Owned stations get a thick frame in their chef's colour
    const frame = function (px, py, color) {
        bg.lineWidth = 4;
        bg.strokeStyle = color;
        bg.strokeRect(px + 4, py + 4, TS - 8, TS - 8);
    };

    const drawTile = function (ch, x, y) {
        const px = x * TS, py = y * TS;
        const band = SIDE_COLORS[sideOf(x)];             // owned stations show their chef's colour
        if (ch === ".") { drawFloor(px, py); return; }
        if (ch === "#") {
            fill(bg, px, py, TS, TS, "#111");
            fill(bg, px + 3, py + 3, TS - 6, TS - 6, "#6b3a0b");
            return;
        }
        if (ch === "W") {
            fill(bg, px, py, TS, TS, "#111");
            fill(bg, px + 2, py + 2, TS - 4, TS - 4, "#a2a2a2");
            fill(bg, x === 0 ? px + 2 : px + TS - 8, py + 2, 6, TS - 4, band);
            bg.fillStyle = "#6c6c6c";
            const out = x === 0;
            for (let i = 0; i < 3; i++) {
                const ax = px + 10 + i * 10;
                bg.beginPath();
                if (out) { bg.moveTo(ax + 8, py + 14); bg.lineTo(ax, py + 24); bg.lineTo(ax + 8, py + 34); }
                else { bg.moveTo(ax, py + 14); bg.lineTo(ax + 8, py + 24); bg.lineTo(ax, py + 34); }
                bg.fill();
            }
            return;
        }
        if (ch === "X") {
            drawCounter(px, py, "#555", "#8a8a8a");
            fill(bg, px + 10, py + 8, 28, 24, "#111");
            fill(bg, px + 13, py + 11, 22, 18, "#2b2b2b");
            return;
        }
        if (ch === "C") { drawCounter(px, py); return; }
        drawCounter(px, py, band);
        frame(px, py, band);
        if (ch === "K") {                                // big light wooden board with a knife
            fill(bg, px + 5, py + 7, 38, 30, "#1b1209");
            fill(bg, px + 7, py + 9, 34, 26, "#f0c98e");
            fill(bg, px + 7, py + 31, 34, 4, "#c4935a");
            fill(bg, px + 10, py + 16, 18, 2, "#d9a96a");    // wood grain
            fill(bg, px + 14, py + 24, 20, 2, "#d9a96a");
            fill(bg, px + 9, py + 11, 3, 3, "#1b1209");      // hanging hole
            fill(bg, px + 18, py + 37, 26, 7, "#1b1209");    // knife lying in front of the board
            fill(bg, px + 19, py + 38, 15, 5, "#e3e8ec");    // blade
            fill(bg, px + 34, py + 38, 9, 5, "#6b4423");     // handle
        }
        if (ch === "P") {
            bg.beginPath(); bg.arc(px + 24, py + 22, 19, 0, 2 * Math.PI);
            bg.fillStyle = "#333"; bg.fill();
            Sprites.drawIcon(bg, "pot", px + 1, py - 1, 46);
        }
        if (ch === "D") {
            for (let i = 0; i < 4; i++) Sprites.draw(bg, "plate", px + 3, py + 6 - i * 4, 42);
        }
    };

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) drawTile(map[y][x], x, y);
    }

    // ---------- Helpers ----------
    const drawPlate = function (item, cx, cy, size) {
        const key = item.items.slice().sort().join("+");
        if (RECIPE_BY_ITEMS[key]) {
            Sprites.drawIcon(ctx, RECIPE_BY_ITEMS[key], cx - size / 2, cy - size / 2, size);
            return;
        }
        Sprites.draw(ctx, "plate", cx - size / 2, cy - size / 2, size);
        const s = size * 0.55;
        item.items.forEach(function (name, i) {
            const ox = item.items.length === 1 ? 0 : (i ? 0.16 : -0.16) * size;
            Sprites.draw(ctx, name + "_chopped", cx + ox - s / 2, cy - s / 2 - 2, s);
        });
    };

    const drawItem = function (item, cx, cy, size) {
        if (item.name === "plate") drawPlate(item, cx, cy, size);
        else Sprites.draw(ctx, Sprites.itemSprite(item), cx - size / 2, cy - size / 2, size);
    };

    const bar = function (cx, y, frac, color) {
        const w = 42;
        fill(ctx, cx - w / 2 - 2, y - 2, w + 4, 12, "#111");
        fill(ctx, cx - w / 2, y, w, 8, "#444");
        fill(ctx, cx - w / 2, y, w * Math.max(0, Math.min(1, frac)), 8, color);
    };

    const shadow = function (x, y, rx) {
        ctx.beginPath();
        ctx.ellipse(x, y, rx, rx * 0.35, 0, 0, 2 * Math.PI);
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.fill();
    };

    const text = function (str, x, y, color, size) {
        ctx.font = (size || 10) + "px 'Press Start 2P', monospace";
        ctx.textAlign = "center";
        ctx.lineWidth = 4;
        ctx.strokeStyle = "#111";
        ctx.strokeText(str, x, y);
        ctx.fillStyle = color;
        ctx.fillText(str, x, y);
    };

    // ---------- Parts of a frame ----------
    const drawPot = function (pot, x, y, now) {
        const cx = (x + 0.5) * TS;
        const top = y === 0 ? y * TS + 44 : y * TS - 10;  // bars go towards the floor side
        // ingredients waiting in the pot
        pot.items.forEach(function (it, i) {
            Sprites.draw(ctx, it.name + "_" + it.state, cx - 26 + i * 24, y * TS + 4, 28);
        });
        if (pot.state === "cooking") {
            const need = recipes[pot.dish].cookTime;
            bar(cx, top, pot.cook / need, "#4cd964");
        }
        if (pot.state === "done") {
            const lift = (now / 500) % 1;
            ctx.globalAlpha = 1 - lift;
            Sprites.draw(ctx, "steam", cx - 14, y * TS - 4 - lift * 10, 28);
            ctx.globalAlpha = 1;
            Sprites.drawIcon(ctx, recipes[pot.dish].icon, cx - 17, y * TS + 4, 34);
            const burn = pot.burn / settings.burnTime;
            if (burn > 0.4) {
                bar(cx, top, burn, "#ff4b2b");
                if (Math.floor(now / 200) % 2) text("!", cx + 20, y * TS + 30, "#ff4b2b", 16);
            }
        }
        if (pot.state === "burnt") {
            const puff = (now / 600) % 1;
            ctx.globalAlpha = 1 - puff;
            Sprites.draw(ctx, "smoke", cx - 16, y * TS - 8 - puff * 14, 32);
            ctx.globalAlpha = 1;
        }
    };

    const drawTileItems = function (now) {
        Object.keys(state.tiles).forEach(function (k) {
            const [x, y] = k.split(",").map(Number);
            const it = state.tiles[k];
            if (it.name === "pot") { drawPot(it, x, y, now); return; }
            const cx = (x + 0.5) * TS, cy = (y + 0.5) * TS;
            drawItem(it, cx, cy - 2, it.name === "plate" ? 46 : 44);
            if (map[y][x] === "K" && it.state === "raw" && it.chop > 0) {
                bar(cx, y === 0 ? y * TS + 44 : y * TS - 10, it.chop, "#4cd964");
            }
        });
    };

    // Ingredients pop in, show a ring timer, and blink before they vanish.
    // Dropped plates never vanish (left = null), so they get no ring.
    const drawFloorItems = function (now) {
        state.floor.forEach(function (f) {
            const pop = Math.min(1, f.age / 0.3);
            const scale = pop < 1 ? 0.4 + pop * 0.75 : 1;
            const x = f.x * TS, y = f.y * TS;
            if (f.left === null) {
                shadow(x, y + 15, 16);
                drawItem(f.item, x, y, 46 * scale);
                return;
            }
            if (f.left < 3 && Math.floor(now / 120) % 2) return;     // blinking
            ctx.globalAlpha = Math.min(1, f.left / 1.5 + 0.3);
            shadow(x, y + 15, 16);
            ctx.lineWidth = 4;
            ctx.strokeStyle = f.left < 3 ? "#ff3b30" : "rgba(255,255,255,0.9)";
            ctx.beginPath();
            ctx.arc(x, y, 24, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * (f.left / f.life));
            ctx.stroke();
            drawItem(f.item, x, y, 42 * scale);
            ctx.globalAlpha = 1;
        });
    };

    // The server sends the tile each chef is working on, so the highlight always matches what P / O will do
    const drawHighlight = function (now) {
        const p = state.players[me];
        if (!p || !p.target || state.phase !== "playing") return;
        const t = p.target;
        const ch = map[t.y] && map[t.y][t.x];
        if (!ch || ".#".indexOf(ch) >= 0) return;
        const mine = "KPWD".indexOf(ch) < 0 || sideOf(t.x) === me;
        ctx.globalAlpha = 0.55 + 0.35 * Math.sin(now / 150);
        ctx.lineWidth = 4;
        ctx.strokeStyle = mine ? "#fff" : "#ff3b30";
        ctx.strokeRect(t.x * TS + 2, t.y * TS + 2, TS - 4, TS - 4);
        ctx.globalAlpha = 1;
    };

    const drawPlayers = function (now, dt) {
        state.players.forEach(function (p, i) {
            if (!shown[i] || Math.hypot(shown[i].x - p.x, shown[i].y - p.y) > 1.5) shown[i] = { x: p.x, y: p.y };
            const k = Math.min(1, dt * 18);
            shown[i].x += (p.x - shown[i].x) * k;
            shown[i].y += (p.y - shown[i].y) * k;

            const px = shown[i].x * TS, py = shown[i].y * TS;
            const facingUp = p.fy < -0.5 && Math.abs(p.fy) > Math.abs(p.fx);
            const handX = px + p.fx * 20, handY = py - 6 + p.fy * 12;

            if (p.cheat) {                                         // cheat aura
                ctx.beginPath();
                ctx.ellipse(px, py + 14, 24, 9, 0, 0, 2 * Math.PI);
                ctx.fillStyle = "hsla(" + ((now / 5) % 360) + ", 90%, 60%, 0.7)";
                ctx.fill();
            }
            shadow(px, py + 16, 16);

            if ((p.sprinting || p.boosting) && p.moving) {         // sprint (blue) or serving boost (gold): speed lines
                ctx.strokeStyle = p.sprinting ? "rgba(94, 224, 255, 0.85)" : "rgba(255, 210, 63, 0.9)";
                ctx.lineWidth = 3;
                [-12, 0, 12].forEach(function (off, n) {
                    const len = 14 + ((Math.floor(now / 60) + n) % 3) * 6;
                    const sx = px - p.fx * 22 - p.fy * off, sy = py - p.fy * 22 + p.fx * off;
                    ctx.beginPath();
                    ctx.moveTo(sx, sy);
                    ctx.lineTo(sx - p.fx * len, sy - p.fy * len);
                    ctx.stroke();
                });
            }

            let sequence = "walk", index = 0;
            if (p.stun > 0 || p.knockedOut) sequence = "dizzy";
            else if (p.chopping) { sequence = "chop"; index = Math.floor(now / 120); }
            else if (p.moving) index = Math.floor(now / 110);
            Sprites.drawChef(ctx, i, sequence, index, px - 26, py - 38, 52, p.fx < -0.1);

            // Facing away from the camera the hands are hidden, so the item is held up above the head
            if (p.held) {
                if (facingUp) drawItem(p.held, px, py - 30, 32);
                else drawItem(p.held, handX, handY, 36);
            }
            if (p.stun > 0) {
                for (let s = 0; s < 3; s++) {
                    const a = now / 180 + s * 2.1;
                    Sprites.draw(ctx, "star", px + Math.cos(a) * 18 - 7, py - 40 + Math.sin(a) * 5 - 7, 14);
                }
            }
            text(i === me ? "YOU" : p.name, px, py - (p.held && facingUp ? 50 : 44), i === 0 ? "#ff8a7a" : "#8fb0ff", 8);
        });
    };

    const drawProjectiles = function (now) {
        state.projectiles.forEach(function (pr) {
            const x = pr.x * TS, y = pr.y * TS;
            shadow(x, y + 18, 10);
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(now / 70);
            drawItem(pr.item, 0, 0, 36);
            ctx.restore();
        });
    };

    const drawAim = function (now) {
        if (!aimPoint || !shown[me]) return;
        const sx = shown[me].x, sy = shown[me].y;
        const dx = aimPoint.x - sx, dy = aimPoint.y - sy;
        const len = Math.hypot(dx, dy) || 1;
        const reach = Math.min(len, settings.throwRange);
        const ex = sx + dx / len * reach, ey = sy + dy / len * reach;

        ctx.save();
        ctx.setLineDash([10, 8]);
        ctx.lineDashOffset = -now / 30;
        ctx.lineWidth = 6; ctx.strokeStyle = "rgba(0,0,0,0.5)";
        ctx.beginPath(); ctx.moveTo(sx * TS, sy * TS); ctx.lineTo(ex * TS, ey * TS); ctx.stroke();
        ctx.lineWidth = 3; ctx.strokeStyle = "#fff"; ctx.stroke();
        ctx.restore();

        ctx.lineWidth = 3; ctx.strokeStyle = "#ff3b30";
        ctx.beginPath(); ctx.arc(ex * TS, ey * TS, 12, 0, 2 * Math.PI); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ex * TS - 18, ey * TS); ctx.lineTo(ex * TS + 18, ey * TS);
        ctx.moveTo(ex * TS, ey * TS - 18); ctx.lineTo(ex * TS, ey * TS + 18);
        ctx.stroke();
    };

    const drawPopups = function (now) {
        for (let i = popups.length - 1; i >= 0; i--) {
            const pop = popups[i];
            const age = (now - pop.start) / 1300;
            if (age >= 1) { popups.splice(i, 1); continue; }
            ctx.globalAlpha = 1 - age * age;
            text(pop.text, pop.x * TS, pop.y * TS - age * 36, pop.color, 14);
            ctx.globalAlpha = 1;
        }
    };

    // ---------- Animation loop ----------
    let running = true;
    const doFrame = function (now) {
        if (!running) return;
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(background, 0, 0);
        if (state) {
            drawTileItems(now);
            drawHighlight(now);
            drawFloorItems(now);
            drawPlayers(now, dt);
            drawProjectiles(now);
            drawAim(now);
        }
        drawPopups(now);
        requestAnimationFrame(doFrame);
    };
    requestAnimationFrame(doFrame);

    // ---------- Public ----------
    const setState = function (s) { state = s; };
    const setAim = function (point) { aimPoint = point; };
    const addPopup = function (x, y, str, color) { popups.push({ x, y, text: str, color, start: performance.now() }); };
    const stop = function () { running = false; };
    const toWorld = function (pageX, pageY) {
        const offset = $(canvas).offset();
        const scale = canvas.width / $(canvas).width();
        return { x: (pageX - offset.left) * scale / TS, y: (pageY - offset.top) * scale / TS };
    };

    return { setState, setAim, addPopup, toWorld, stop };
};
