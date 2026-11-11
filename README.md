# Chef Wars: Showdown Battle

A real-time 1v1 cooking survival game for two browsers. Two chefs share one pixel-art kitchen, where ingredients pop up at random places and vanish after 8–10 seconds. Each chef has their own chopping boards, pots, plates and serving counter, and their own list of customer orders. Every order you miss costs you hearts. Lose your last heart and you're knocked out: last chef standing wins.

## Run it

```bash
npm install
node server.js
```

Open http://localhost:8000. **Each player needs their own browser session**, because the sign-in is a cookie:
- a normal window plus an incognito window, or
- two different browsers, or
- another device on the same Wi-Fi at `http://<host-laptop-ip>:8000`.

For a short demo round: `GAME_TIME=60 node server.js` (macOS/Linux) or `set GAME_TIME=60 && node server.js` (Windows cmd). `OVERTIME` sets the Sudden Death Dish length the same way.

## Pages

1. **Home page**
   - Title, game description and a "How to play" box (controls, hearts, how to win).
   - **Register:** username, display name, password, confirm password. Validation:
     - every field is required
     - username is 3–16 letters, numbers or `_`
     - display name is 2–16 characters
     - password is at least 6 characters
     - the two passwords must match
     - no duplicate usernames
     These rules are checked in the browser and again on the server. A taken username is flagged as soon as you leave the field (`/check-username`), and again when the form is sent.
   - **Sign in:** shows an error for an unknown username or a wrong password. The session cookie lasts a day, so refreshing the page keeps you signed in.
   - **Find match:** puts you on a waiting screen. The home page shows everyone who is currently waiting.
   - **Wins dashboard:** every registered chef ranked by number of wins, with a bar per chef, games played, win rate and best score (most dishes served in one game). Your own row is highlighted.
2. **Waiting room.** When a second chef clicks Find match, the two are paired and see each other's names. Either chef can set the **starting hearts (5–8)**; both see the choice, and changing it turns off both players' Ready. Both must press **Ready**, then a 3-2-1 countdown starts the game.
3. **Game page.** The kitchen is drawn on a canvas in the middle. Each chef's hearts and order cards are on either side, and the clock and skill buttons are above it. The whole page fits a 1280×720 window without scrolling.
4. **Game over page.**
   - "You win!", "You lose!" or "It's a draw!", with a crown next to the winner and a line saying how the round ended.
   - Stats for both chefs: dishes served, ingredients grabbed, orders missed and rivals hit (the better value is highlighted).
   - The wins dashboard.
   - **Play again** (back to pairing) and **Back to home page**.

## Controls

| Key | Action |
|---|---|
| WASD or arrow keys | Move (each browser controls only its own chef) |
| **Left click** (or **P**) | Pick up an ingredient you're standing on, or pick up / put down / serve at the station you face |
| **Right click** (or **O**), hold ~2 s | Chop on your chopping board |
| **T**, then left click | Aim with the mouse, then throw the ingredient you're holding. **T** again (or Esc) cancels |
| **Space** or the Sprint button | Sprint: run 1.6× faster for 5 s, then 10 s to recharge |
| 🔊 button (top bar) | Sound on / off (remembered in `localStorage`) |

## Rules

| Dish | How | Miss it |
|---|---|---|
| Garden Salad | chop lettuce + chop tomato, put both on a plate | −½ heart |
| Tomato Soup | put 2 **whole** tomatoes in your pot (6 s) | −½ heart |
| Veggie Stew | chop carrot + chop onion, cook them in your pot (8 s) | −1 heart |

- **Hearts:** both chefs start with the same number of hearts (5–8, picked in the waiting room). They're shown above each chef's order list.
- **Orders:** each has a countdown bar. Serve it in time to clear it and get a **speed boost (1.3× for 3 s)**. If the bar runs out, the order vanishes and you **lose the hearts shown on it**. Both chefs get the same order sequence.
- **Ingredients:** they spawn at random on the floor, more often the ones current orders need. They show a ring timer, blink, then vanish after 8–10 seconds. Both chefs race for them. Ingredients you drop also vanish after 10 seconds, but a dropped plate stays until someone picks it up.
- **Your stations:** boards, pots, plates and serving counters are framed in your colour, and you can only use your own. The blue counters (including the middle island) are shared. The tile you are working on is outlined (red if it's your rival's). The chefs can walk through each other, so neither can block the other's stations.
- **Mistakes are explained:** pressing P or O when nothing can happen shows a short message ("The board is empty", "Face your chopping board to chop", ...).
- **Pots:** a finished pot burns if you leave it for 10 seconds. Empty a burnt pot with empty hands.
- **Sabotage:** a thrown ingredient that hits your rival stuns them for 2 seconds and makes them drop whatever they carry. Throws fly over counters; walls and stations stop them.

### How to win
- **Last chef standing:** a chef who loses their last heart is knocked out and the other chef wins straight away.
- **Time up:** regular time is **3 minutes**. Then the chef with more hearts wins (half hearts count, so 4½ beats 4).
- **Sudden Death Dish (overtime, up to 1 minute):** if hearts are level when regular time ends, regular orders stop and both chefs get the same dish, picked at random. The first chef to serve it wins and the other is knocked out. If nobody serves it within the minute, it's a draw.
- If both chefs lose their last heart at the same moment, it's a draw.
- A normal game therefore lasts at most 4 minutes. Results go into `data/users.json` and the dashboard.

## Cheat mode

- **Turn it on:** type the secret combination **W S W S A D A D** (up down up down left right left right; the arrow keys work too) within a second or so between keys, or click the **Cheat** button above the kitchen.
- **Turn it off:** press **C** (or click the button again). Otherwise it turns off by itself after **15 seconds**.
- **Recharge:** after it ends it needs **30 seconds** before it can be used again. Using the combination during that time shows how many seconds are left.
- **While it's on:** chopping and cooking are instant, and every dish you serve takes that dish's hearts (½ or 1) off your rival, so you can knock them out quickly.
- Both players see a CHEAT badge counting down beside the cheating chef, and the Cheat button shows the seconds left or the recharge time.
- The server keeps track of who is cheating and for how long; the browser only sends "cheat on" (combination), "cheat off" (C) or the button press.

## Sound

Every sound is a small `.wav` file in `public/sounds/`, played with HTML `<audio>` elements: picking up, putting down, chopping, serving, losing a heart, throwing, getting hit, a burnt pot, cheat on, sprint, the speed boost, the countdown beeps, the Sudden Death alarm, a knockout, win / lose jingles and background music during a round. The files are generated by `node tools/make-sounds.js`.

## Files

```
server.js                 Express, accounts + sessions, matchmaking, waiting room (hearts), ranking, 30 Hz game loop
game.js                   All game rules (kitchen map, spawns, pots, orders, hearts, overtime, throwing, skills, cheat)
data/users.json           Created automatically: accounts (hashed passwords) + stats
public/index.html         Home, waiting, waiting room, game and game over pages, <audio> elements
public/style.css          Layout + keyframe animations
public/img/sprites.png    Sprite sheet: ingredients (raw/chopped), plate, effects, chef animations
public/img/icons/*.svg    Dish, ingredient, pot, heart and trophy icons
public/sounds/*.wav       Sound effects and background music
public/js/auth.js         Register / sign in / validate / sign out (fetch)
public/js/ui.js           Page switching, form validation, waiting list, waiting room, wins dashboard, game over
public/js/hud.js          Hearts, orders, clock + overtime, skill buttons, cheat badges, countdown, toasts
public/js/renderer.js     Canvas kitchen
public/js/sprites.js      Loads the sprite sheet + SVGs and draws them with drawImage
public/js/sound.js        Plays the sound effects and music, mute button
public/js/input.js        Keyboard + mouse, cheat combination
public/js/socket.js       All WebSocket messages
public/js/main.js         Connects everything
tools/make-sprites.html   Open in a browser to redraw / re-download sprites.png
tools/make-icons.js       node tools/make-icons.js regenerates the SVG icons
tools/make-sounds.js      node tools/make-sounds.js regenerates the sound files
```

## How the network part works

- **Sign-in:** the browser signs in with `fetch` (`/register`, `/signin`, `/validate`, `/signout`, `/check-username`). The home page reads the round and overtime length from `/rules`. The server keeps the user in an `express-session` cookie.
- **Sockets:** after sign-in the browser opens a Socket.IO connection. The server reads the same session, so it knows which user each socket belongs to, and refuses sockets that aren't signed in. Sessions are kept in the server's memory, so restarting `node server.js` signs everyone out; open pages then show the sign-in forms again with a message.
- **Leaving:** if a chef leaves or closes the tab during the waiting room or a game, the other chef goes back to the home page with a message. That game isn't counted in the stats.
- **Matchmaking:** **find match** adds you to a queue, and the server broadcasts the queue to everyone. When two chefs are queued they're moved into a room; either can send **hearts**, and both must send **ready**.
- **During the game:** the browser only sends held keys (right click counts as holding the chop key), "pick" (left click or P), the throw angle, "sprint" and the cheat messages. The server runs the game 30 times a second and sends the whole state to both browsers. Positions, pickups and hearts therefore show up in both browsers almost instantly, and DevTools can't fake a result.

## Course topics used

| Lecture | Where |
|---|---|
| 1.1 HTML, 7.5 Forms | Register / sign-in forms with validation, page structure, `<audio>` elements |
| 1.3 / 3.2 CSS | Grid/flex layouts for home, HUD, dashboard, stats table |
| 2.1 / 4.2 CSS Animations | Order cards, dashboard bars growing, spinner, countdown, hearts shake, screen shake |
| 4.3 Controlling CSS Animations | `animationend` removes finished order cards; animations restarted by resetting `animation-name` |
| 4.1 / 4.4 SVG | Dish/ingredient/pot/heart/trophy icons with `<g>`, `<defs>`, linear + radial gradients |
| 3.1 / 3.3 jQuery | DOM updates, events, `fadeIn`/`fadeOut` toasts |
| 5.1 Arrays and Objects | Map rows, order queues, tiles keyed by `"x,y"` |
| 5.3 Module Pattern | `Renderer(...)` factory; `Sprites`, `Auth`, `UI`, `HUD`, `Input`, `Socket`, `Sound` IIFE modules |
| 6.1 / 6.2 Canvas | Kitchen drawn with rects/arcs/paths/text; mouse position via `offset()` |
| 6.3 Drawing Sprites | `sprites.png` via `new Image()` + `onload`, 9-parameter `drawImage`, `imageSmoothingEnabled = false` |
| 6.4 Animating Sprites | `requestAnimationFrame` loop; walk/chop/dizzy sequences timed with timestamps |
| 7.1 JSON | All socket messages and the users file |
| 7.4 Express | `express.static`, JSON endpoints (`/ranking`, `/validate`, `/rules`, `/check-username`) |
| 8.1 / 8.2 Promises + AJAX | `fetch` for register/sign-in/ranking with `.then()` |
| 8.3 SPA example | Single page app; `fs.readFileSync/writeFileSync` JSON "database" |
| Web Storage | `localStorage` remembers the mute setting |
| 9.2 Web Authentication | `express-session` sign-in, session kept across refresh, `crypto` module |
| 10.1 WebSocket | Socket.IO rooms, queue broadcast, server relays and broadcasts game state |
| 11.1 Posting Form Data | JSON bodies posted to `/register` and `/signin` |

Not from the slides:
- `crypto.scryptSync` to hash passwords
- `io.engine.use(session)` to share the Express session with Socket.IO
- `performance.now()` in the server loop, so the game moves by the real time between ticks
- `event.button` and preventing `contextmenu`, so left click picks up and right click chops
- `Object.create(null)` for the users object, so usernames like `constructor` work
- an Express error handler (`app.use((err, req, res, next) => ...)`) that answers broken requests with JSON
- canvas `save/translate/rotate/restore` and `setLineDash`
- CSS `grid-template-areas` and `display: contents` for the game page layout
- SVG `clipPath` for the half heart icon
- sound files generated with sine/square waves and noise, written as WAV with Node's `Buffer` (`tools/make-sounds.js`)
- `audio.cloneNode()` so the same sound can overlap itself, and the `play()` promise
