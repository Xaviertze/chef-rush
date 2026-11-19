// Writes the ingredient icons (order cards) into public/img/icons/ from cells of public/img/sprites.png,
// so the cards show the same pixel art as the kitchen. Each pixel becomes an SVG <rect>.
// Run with:  node tools/make-ingredient-icons.js   (again after changing sprites.png)
// Lecture links: 4.1 (SVG <rect>), 8.3 (fs)
// Outside the slides: reading a PNG by hand (its chunks, zlib to unpack the pixels, and the per-row filters),
// so no extra npm package is needed.

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const SHEET = path.join(__dirname, "..", "public", "img", "sprites.png");
const OUT_DIR = path.join(__dirname, "..", "public", "img", "icons");
const CELL = 32;
// The bottom pixel row of an ingredient cell touches the chef row below (in an earlier sheet the chef hats
// poked into it) and no ingredient is drawn there, so the icons leave it out.
const ROWS = CELL - 1;

// icon file -> sprite sheet cell [column, row] (same cells as public/js/sprites.js)
const ICONS = {
    lettuce: [1, 0],            // chopped lettuce
    tomato: [3, 0],             // chopped tomato
    "tomato-whole": [2, 0],     // whole tomato (Tomato Soup)
    onion: [5, 0],              // chopped onion
    carrot: [7, 0]              // chopped carrot
};

// ---------- Read an 8-bit RGBA PNG (colour type 6, not interlaced) ----------
const readPng = function (file) {
    const buf = fs.readFileSync(file);
    let pos = 8, width = 0, height = 0;
    const idat = [];
    while (pos < buf.length) {
        const len = buf.readUInt32BE(pos);
        const type = buf.toString("ascii", pos + 4, pos + 8);
        const data = buf.subarray(pos + 8, pos + 8 + len);
        if (type === "IHDR") {
            width = data.readUInt32BE(0);
            height = data.readUInt32BE(4);
            if (data[8] !== 8 || data[9] !== 6 || data[12] !== 0) throw new Error("sprites.png must be 8-bit RGBA, not interlaced");
        }
        if (type === "IDAT") idat.push(data);
        pos += 12 + len;
    }
    const raw = zlib.inflateSync(Buffer.concat(idat));
    const stride = width * 4;
    const px = Buffer.alloc(stride * height);
    const paeth = function (a, b, c) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        return pa <= pb && pa <= pc ? a : (pb <= pc ? b : c);
    };
    for (let y = 0; y < height; y++) {
        const filter = raw[y * (stride + 1)];
        for (let x = 0; x < stride; x++) {
            const v = raw[y * (stride + 1) + 1 + x];
            const a = x >= 4 ? px[y * stride + x - 4] : 0;               // left
            const b = y > 0 ? px[(y - 1) * stride + x] : 0;               // up
            const c = x >= 4 && y > 0 ? px[(y - 1) * stride + x - 4] : 0; // up-left
            const add = [0, a, b, (a + b) >> 1, paeth(a, b, c)][filter];
            px[y * stride + x] = (v + add) & 255;
        }
    }
    return { width, px };
};

// ---------- One cell -> SVG, joining pixels of the same colour in a row into one <rect> ----------
const hex = (n) => n.toString(16).padStart(2, "0");
const cellSvg = function (png, col, row) {
    const rects = [];
    for (let y = 0; y < ROWS; y++) {
        let x = 0;
        while (x < CELL) {
            const i = ((row * CELL + y) * png.width + col * CELL + x) * 4;
            const [r, g, b, a] = png.px.subarray(i, i + 4);
            let run = 1;
            while (x + run < CELL && png.px.compare(png.px, i, i + 4, i + run * 4, i + run * 4 + 4) === 0) run++;
            if (a > 0) {
                const opacity = a < 255 ? ` fill-opacity="${(a / 255).toFixed(2)}"` : "";
                rects.push(`<rect x="${x}" y="${y}" width="${run}" height="1" fill="#${hex(r)}${hex(g)}${hex(b)}"${opacity}/>`);
            }
            x += run;
        }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CELL} ${CELL}" width="64" height="64" shape-rendering="crispEdges">\n` +
        rects.join("\n") + "\n</svg>\n";
};

const png = readPng(SHEET);
Object.keys(ICONS).forEach(function (name) {
    const [col, row] = ICONS[name];
    fs.writeFileSync(path.join(OUT_DIR, name + ".svg"), cellSvg(png, col, row));
    console.log("wrote", name + ".svg");
});
