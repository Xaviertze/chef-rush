// Sprites module: loads the sprite sheet PNG and the SVG icons, then draws them on canvas.
// Lecture links: 5.3 (IIFE module), 6.2 (Image object + onload), 6.3 (sprite sheet +
// 9-parameter drawImage + imageSmoothingEnabled), 6.4 (animation sequences), 4.1/4.4 (SVG files)

const Sprites = (function () {
    const CELL = 32;

    // Where each sprite sits in public/img/sprites.png  [column, row]
    // (made by tools/make-sprites.html - you can swap in your own sheet with the same layout)
    const CELLS = {
        lettuce_raw: [0, 0], lettuce_chopped: [1, 0], tomato_raw: [2, 0], tomato_chopped: [3, 0],
        onion_raw: [4, 0], onion_chopped: [5, 0], carrot_raw: [6, 0], carrot_chopped: [7, 0],
        plate: [8, 0], star: [9, 0], smoke: [10, 0], steam: [11, 0]
    };
    // Chef animation sequences: row 1 = player 1 (red), row 2 = player 2 (blue)
    const CHEF = { walk: [0, 1, 2, 3], chop: [4, 5], dizzy: [6] };

    const ICONS = ["salad", "tomato-soup", "veggie-stew", "lettuce", "tomato", "tomato-whole", "onion", "carrot", "pot", "coin", "trophy"];

    const sheet = new Image();
    const icons = {};
    let loaded = 0;
    const total = 1 + ICONS.length;
    let onReady = null;

    const done = function () {
        loaded++;
        if (loaded === total && onReady) onReady();
    };

    // Start loading everything; call fn when all images are ready
    const load = function (fn) {
        onReady = fn;
        sheet.onload = done;
        sheet.src = "img/sprites.png";
        ICONS.forEach(function (name) {
            const img = new Image();
            img.onload = done;
            img.src = "img/icons/" + name + ".svg";
            icons[name] = img;
        });
    };

    const iconPath = (name) => "img/icons/" + name + ".svg";

    // Draw one cell of the sprite sheet
    const draw = function (ctx, name, x, y, size) {
        const cell = CELLS[name];
        if (!cell) return;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(sheet,
            cell[0] * CELL, cell[1] * CELL, CELL, CELL,   // area in the sprite sheet
            x, y, size, size);                            // area in the canvas
    };

    const itemSprite = (item) => item.name + "_" + item.state;

    // Draw a chef: side 0/1, sequence "walk" | "chop" | "dizzy", index inside the sequence
    const drawChef = function (ctx, side, sequence, index, x, y, size, flip) {
        const frames = CHEF[sequence];
        const col = frames[index % frames.length];
        ctx.imageSmoothingEnabled = false;
        ctx.save();
        if (flip) {
            ctx.translate(x + size, y);
            ctx.scale(-1, 1);
            ctx.drawImage(sheet, col * CELL, (side + 1) * CELL, CELL, CELL, 0, 0, size, size);
        } else {
            ctx.drawImage(sheet, col * CELL, (side + 1) * CELL, CELL, CELL, x, y, size, size);
        }
        ctx.restore();
    };

    // SVG icons can be drawn on canvas too, because they are Image objects
    const drawIcon = function (ctx, name, x, y, size) {
        if (!icons[name]) return;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(icons[name], x, y, size, size);
    };

    return { load, draw, drawChef, drawIcon, itemSprite, iconPath };
})();
