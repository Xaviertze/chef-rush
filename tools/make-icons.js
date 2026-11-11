// Writes the SVG icons used by the order cards, HUD and dashboard into public/img/icons/
// Run with:  node tools/make-icons.js
// Lecture links: 4.1 (SVG shapes and paths), 4.4 (<g> groups, <defs>, linear and radial gradients)

const fs = require("fs");
const path = require("path");
const OUT_DIR = path.join(__dirname, "..", "public", "img", "icons");
fs.mkdirSync(OUT_DIR, { recursive: true });

const DEFS = `
    <defs>
        <linearGradient id="lettuce-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0" stop-color="#8ee05f" />
            <stop offset="1" stop-color="#3f9f2a" />
        </linearGradient>
        <radialGradient id="tomato-grad" fx="35%" fy="35%">
            <stop offset="0.1" stop-color="#ff9b7d" />
            <stop offset="1" stop-color="#d8331f" />
        </radialGradient>
        <radialGradient id="onion-grad" fx="35%" fy="35%">
            <stop offset="0.1" stop-color="#f6e2fa" />
            <stop offset="1" stop-color="#b678c4" />
        </radialGradient>
        <linearGradient id="carrot-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0" stop-color="#ffb259" />
            <stop offset="1" stop-color="#e2720f" />
        </linearGradient>
        <radialGradient id="bowl-grad" fx="50%" fy="30%">
            <stop offset="0.4" stop-color="#ffffff" />
            <stop offset="1" stop-color="#c9ced6" />
        </radialGradient>
        <radialGradient id="soup-grad" fx="40%" fy="40%">
            <stop offset="0" stop-color="#ff7a52" />
            <stop offset="1" stop-color="#c8321c" />
        </radialGradient>
        <radialGradient id="stew-grad" fx="40%" fy="40%">
            <stop offset="0" stop-color="#c98a4a" />
            <stop offset="1" stop-color="#7a4a1f" />
        </radialGradient>
        <linearGradient id="pot-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0" stop-color="#5b6470" />
            <stop offset="0.45" stop-color="#9aa4b0" />
            <stop offset="1" stop-color="#3d444d" />
        </linearGradient>
        <radialGradient id="coin-grad" fx="35%" fy="30%">
            <stop offset="0.1" stop-color="#fff2a8" />
            <stop offset="1" stop-color="#e3a514" />
        </radialGradient>
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

// A bowl with something in it, each part in its own <g> group
const bowl = (filling, extras) => `
    <g id="bowl">
        <ellipse cx="32" cy="30" rx="27" ry="8" fill="${filling}" ${STROKE}/>
        <path d="M5 30 a27 24 0 0 0 54 0" fill="url(#bowl-grad)" ${STROKE}/>
        <rect x="22" y="52" width="20" height="5" rx="2" fill="#c9ced6" ${STROKE}/>
    </g>
    <g id="toppings">${extras}</g>`;

const icons = {
    "salad": svg(bowl("url(#lettuce-grad)", `
        <g fill="url(#lettuce-grad)" ${STROKE}><ellipse cx="18" cy="25" rx="10" ry="6"/><ellipse cx="44" cy="24" rx="11" ry="6"/><ellipse cx="31" cy="20" rx="10" ry="6"/></g>
        <g fill="url(#tomato-grad)" ${STROKE}><circle cx="25" cy="26" r="6"/><circle cx="40" cy="27" r="6"/></g>`)),
    "tomato-soup": svg(bowl("url(#soup-grad)", `
        <g fill="#fff3c4"><circle cx="22" cy="29" r="2"/><circle cx="38" cy="31" r="1.5"/><circle cx="44" cy="28" r="2"/></g>
        <g fill="#3a9a2a"><ellipse cx="30" cy="28" rx="4" ry="2"/><ellipse cx="34" cy="27" rx="3" ry="1.5"/></g>
        <g fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" opacity="0.8">
            <path d="M24 18 q-3 -5 0 -10"/><path d="M33 17 q-3 -5 0 -10"/><path d="M42 18 q-3 -5 0 -10"/></g>`)),
    "veggie-stew": svg(bowl("url(#stew-grad)", `
        <g fill="url(#carrot-grad)" ${STROKE}><ellipse cx="21" cy="29" rx="4" ry="3"/><ellipse cx="41" cy="30" rx="4" ry="3"/></g>
        <g fill="url(#onion-grad)" ${STROKE}><circle cx="31" cy="29" r="3.5"/><circle cx="47" cy="27" r="3"/></g>
        <g fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" opacity="0.8">
            <path d="M24 18 q-3 -5 0 -10"/><path d="M33 17 q-3 -5 0 -10"/><path d="M42 18 q-3 -5 0 -10"/></g>`)),
    "lettuce": svg(`<g fill="url(#lettuce-grad)" ${STROKE}>
        <ellipse cx="20" cy="38" rx="13" ry="7"/><ellipse cx="42" cy="28" rx="13" ry="7"/><ellipse cx="38" cy="45" rx="12" ry="7"/></g>`),
    "tomato": svg(`<g fill="url(#tomato-grad)" ${STROKE}><circle cx="22" cy="38" r="14"/><circle cx="43" cy="28" r="14"/></g>
        <g fill="#fff3c4"><circle cx="20" cy="36" r="2"/><circle cx="25" cy="41" r="2"/><circle cx="41" cy="26" r="2"/><circle cx="46" cy="31" r="2"/></g>`),
    "tomato-whole": svg(`<g id="tomato"><circle cx="32" cy="36" r="21" fill="url(#tomato-grad)" ${STROKE}/>
        <path d="M22 17 l10 6 l10 -6 l-4 9 l-6 -3 l-6 3 z" fill="#4bb032" ${STROKE}/></g>`),
    "onion": svg(`<g fill="url(#onion-grad)" ${STROKE}>
        <circle cx="22" cy="38" r="12"/><circle cx="43" cy="27" r="12"/><circle cx="40" cy="48" r="9"/></g>
        <g fill="none" stroke="#8e4fa0" stroke-width="2"><circle cx="22" cy="38" r="6"/><circle cx="43" cy="27" r="6"/><circle cx="40" cy="48" r="4"/></g>`),
    "carrot": svg(`<g fill="url(#carrot-grad)" ${STROKE}>
        <ellipse cx="20" cy="38" rx="12" ry="9"/><ellipse cx="43" cy="27" rx="12" ry="9"/><ellipse cx="40" cy="48" rx="9" ry="7"/></g>
        <g fill="#ffd9a8"><circle cx="20" cy="38" r="3"/><circle cx="43" cy="27" r="3"/><circle cx="40" cy="48" r="2"/></g>`),
    "pot": svg(`<g id="pot">
        <rect x="4" y="26" width="10" height="6" rx="2" fill="#3d444d" ${STROKE}/>
        <rect x="50" y="26" width="10" height="6" rx="2" fill="#3d444d" ${STROKE}/>
        <rect x="10" y="22" width="44" height="32" rx="6" fill="url(#pot-grad)" ${STROKE}/>
        <rect x="8" y="18" width="48" height="7" rx="3" fill="#6b7480" ${STROKE}/></g>`),
    "coin": svg(`<g id="coin"><circle cx="32" cy="32" r="27" fill="url(#coin-grad)" stroke="#1b1209" stroke-width="3"/>
        <circle cx="32" cy="32" r="19" fill="none" stroke="#c98a0a" stroke-width="3"/>
        <rect x="28" y="20" width="8" height="24" rx="2" fill="#c98a0a"/></g>`),
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
