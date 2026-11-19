// Writes the pot, trophy and heart SVG icons used by the order cards, HUD and dashboard into public/img/icons/
// Run with:  node tools/make-icons.js
// Lecture links: 4.1 (SVG shapes and paths), 4.4 (<g> groups, <defs>, linear and radial gradients)

const fs = require("fs");
const path = require("path");
const OUT_DIR = path.join(__dirname, "..", "public", "img", "icons");
fs.mkdirSync(OUT_DIR, { recursive: true });

const DEFS = `
    <defs>
        <linearGradient id="pot-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0" stop-color="#5b6470" />
            <stop offset="0.45" stop-color="#9aa4b0" />
            <stop offset="1" stop-color="#3d444d" />
        </linearGradient>
        <linearGradient id="gold-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0" stop-color="#fff2a8" />
            <stop offset="0.5" stop-color="#f7c531" />
            <stop offset="1" stop-color="#c98a0a" />
        </linearGradient>
        <radialGradient id="heart-grad" fx="35%" fy="30%">
            <stop offset="0.1" stop-color="#ff9a9a" />
            <stop offset="1" stop-color="#d81e2c" />
        </radialGradient>
        <!-- Outside the slides: clipPath keeps only the left half of a shape (used for the half heart) -->
        <clipPath id="left-half"><rect x="0" y="0" width="32" height="64"/></clipPath>
    </defs>`;

const HEART = "M32 56 C10 40 4 30 4 20 a14 14 0 0 1 28 -6 a14 14 0 0 1 28 6 c0 10 -6 20 -28 36 z";

const svg = (body) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">${DEFS}\n${body}\n</svg>\n`;

const STROKE = `stroke="#1b1209" stroke-width="2"`;

const icons = {
    // salad, tomato-soup and veggie-stew are drawn by hand (public/img/icons); lettuce, tomato, tomato-whole,
    // onion and carrot come from the sprite sheet: see tools/make-ingredient-icons.js
    "pot": svg(`<g id="pot">
        <rect x="4" y="26" width="10" height="6" rx="2" fill="#3d444d" ${STROKE}/>
        <rect x="50" y="26" width="10" height="6" rx="2" fill="#3d444d" ${STROKE}/>
        <rect x="10" y="22" width="44" height="32" rx="6" fill="url(#pot-grad)" ${STROKE}/>
        <rect x="8" y="18" width="48" height="7" rx="3" fill="#6b7480" ${STROKE}/></g>`),
    "trophy": svg(`<g id="trophy">
        <path d="M14 12 h-8 v6 a10 10 0 0 0 12 10" fill="none" stroke="#1b1209" stroke-width="3"/>
        <path d="M50 12 h8 v6 a10 10 0 0 1 -12 10" fill="none" stroke="#1b1209" stroke-width="3"/>
        <path d="M14 8 h36 v12 a18 18 0 0 1 -36 0 z" fill="url(#gold-grad)" ${STROKE}/>
        <rect x="28" y="37" width="8" height="10" fill="url(#gold-grad)" ${STROKE}/>
        <rect x="18" y="47" width="28" height="9" rx="2" fill="#7a4518" ${STROKE}/></g>`),
    // Hearts (lives): full, half and empty
    "heart": svg(`<g id="heart"><path d="${HEART}" fill="url(#heart-grad)" stroke="#1b1209" stroke-width="3"/>
        <ellipse cx="18" cy="20" rx="5" ry="3.5" fill="#ffffff" opacity="0.7"/></g>`),
    "heart-half": svg(`<g id="heart-half"><path d="${HEART}" fill="#5a4a4a"/>
        <path d="${HEART}" fill="url(#heart-grad)" clip-path="url(#left-half)"/>
        <path d="${HEART}" fill="none" stroke="#1b1209" stroke-width="3"/>
        <ellipse cx="18" cy="20" rx="5" ry="3.5" fill="#ffffff" opacity="0.7"/></g>`),
    "heart-empty": svg(`<g id="heart-empty"><path d="${HEART}" fill="#5a4a4a" stroke="#1b1209" stroke-width="3"/></g>`)
};

Object.keys(icons).forEach(function (name) {
    fs.writeFileSync(path.join(OUT_DIR, name + ".svg"), icons[name]);
    console.log("wrote", name + ".svg");
});
