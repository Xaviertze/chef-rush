# Chef Rush

A real-time 1v1 cooking game for two browsers. Two chefs share one kitchen, where ingredients pop up at random places and vanish after 8–10 seconds. Each chef has their own chopping boards, pots, plates and serving counter, and their own list of customer orders. Serve more than your rival before time runs out.

## Run it

```bash
npm install
node server.js
```

Open http://localhost:8000. **Each player needs their own browser session**, because the sign-in is a cookie:
- a normal window plus an incognito window, or
- two different browsers, or
- another device on the same Wi-Fi at `http://<host-laptop-ip>:8000`.

For a short demo round: `GAME_TIME=60 node server.js` (macOS/Linux) or `set GAME_TIME=60 && node server.js` (Windows cmd).

## Pages

1. **Home page**
   - Game description and a "How to play" box (controls, scoring, how a round ends).
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
   - **Wins dashboard:** every registered chef ranked by number of wins, with a bar per chef, games played, win rate and best score. Your own row is highlighted.
2. **Waiting room.** When a second chef clicks Find match, the two are paired and see each other's names. Both must press **Ready**, then a 3-2-1 countdown starts the game.
3. **Game page.** The kitchen is drawn on a canvas in the middle, with each chef's score and order cards on either side and the clock above it. The whole page fits a 1280×720 window without scrolling.
4. **Game over page.**
   - Stats for both chefs: dishes served, ingredients grabbed, orders missed, rivals bonked and final score.
   - The wins dashboard.
   - **Play again** (back to pairing) and **Back to home page**.

## Controls

| Key | Action |
|---|---|
| WASD or arrow keys | Move (each browser controls only its own chef) |
| **P** | Pick up an ingredient you're standing on, or pick up / put down / serve at the station you face |
| **O** (hold ~2 s) | Chop on your chopping board |
| **T**, then **T** again | Aim with the mouse, then throw the ingredient you're holding |
| **C** or the on-screen button | Cheat mode on / off |
| Esc | Cancel aiming |

## Rules

| Dish | How | Points |
|---|---|---|
| Garden Salad | chop lettuce + chop tomato, put both on a plate | 20 |
| Tomato Soup | put 2 **whole** tomatoes in your pot (6 s) | 25 |
| Veggie Stew | chop carrot + chop onion, cook them in your pot (8 s) | 35 |

- **Ingredients:** they spawn at random on the floor, more often the ones current orders need. They show a ring timer, blink, then vanish after 8–10 seconds. Both chefs race for them.
- **Your stations:** boards, pots, plates and serving counters are framed in your colour, and you can only use your own. The blue counters (including the middle island) are shared. The tile you are working on is outlined (red if it's your rival's). If you face a station diagonally, it still counts, and O keeps chopping even while you hold a direction key against the board.
- **Mistakes are explained:** pressing P or O when nothing can happen shows a short message ("The board is empty", "Face your chopping board to chop", ...).
- **Pots:** a finished pot burns if you leave it for 10 seconds. Empty a burnt pot with empty hands (P).
- **Scoring:** serving a matching order scores its points plus a speed tip of up to +5. Late orders vanish and score nothing.
- **Throwing:** a thrown ingredient that hits your rival stuns them for 2 seconds and makes them drop whatever they carry. Throws fly over counters; walls and stations stop them.
- **Round end:** a round lasts 2½ minutes. More points wins, and a tie is broken by dishes served. The result goes into `data/users.json` and the dashboard.

## Cheat mode

Press **C** (or click the cheat button) during a game to turn it on, and press it again to turn it off. While it's on, **chopping and cooking are instant and your dishes score double points**. Both players can see a CHEAT badge next to whoever is cheating.

## Files

```
server.js                 Express, accounts + sessions, matchmaking, waiting room, ranking, 30 Hz game loop
game.js                   All game rules (kitchen map, spawns, pots, orders, throwing, cheat, scoring)
data/users.json           Created automatically: accounts (hashed passwords) + stats
public/index.html         Home, waiting, waiting room, game and game over pages
public/style.css          Layout + keyframe animations
public/img/sprites.png    Sprite sheet: ingredients (raw/chopped), plate, effects, chef animations
public/img/icons/*.svg    Dish, ingredient, pot, coin and trophy icons
public/js/auth.js         Register / sign in / validate / sign out (fetch)
public/js/ui.js           Page switching, form validation, waiting list, ready room, wins dashboard, game over
public/js/hud.js          Orders, scores, clock, cheat badges, countdown, toasts
public/js/renderer.js     Canvas kitchen
public/js/sprites.js      Loads the sprite sheet + SVGs and draws them with drawImage
public/js/input.js        Keyboard + mouse
public/js/socket.js       All WebSocket messages
public/js/main.js         Connects everything
tools/make-sprites.html   Open in a browser to redraw / re-download sprites.png
tools/make-icons.js       node tools/make-icons.js regenerates the SVG icons
```

## How the network part works

- **Sign-in:** the browser signs in with `fetch` (`/register`, `/signin`, `/validate`, `/signout`, `/check-username`). The home page reads the round length from `/rules`. The server keeps the user in an `express-session` cookie.
- **Sockets:** after sign-in the browser opens a Socket.IO connection. The server reads the same session, so it knows which user each socket belongs to, and refuses sockets that aren't signed in.
- **Matchmaking:** **find match** adds you to a queue, and the server broadcasts the queue to everyone. When two chefs are queued they're moved into a room, and both must send **ready**.
- **During the game:** the browser only sends held keys, "P", the throw angle and "C". The server runs the game 30 times a second and sends the whole state to both browsers. Positions, pickups and scores therefore show up in both browsers almost instantly, and DevTools can't fake a score.

## Course topics used

| Lecture | Where |
|---|---|
| 1.1 HTML, 7.5 Forms | Register / sign-in forms with validation, page structure |
| 1.3 / 3.2 CSS | Grid/flex layouts for home, HUD, dashboard, stats table |
| 2.1 / 4.2 CSS Animations | Order cards, dashboard bars growing, spinner, countdown, score bump, screen shake |
| 4.3 Controlling CSS Animations | `animationend` removes finished order cards; animations restarted by resetting `animation-name` |
| 4.1 / 4.4 SVG | Dish/ingredient/pot/trophy icons with `<g>`, `<defs>`, linear + radial gradients |
| 3.1 / 3.3 jQuery | DOM updates, events, `fadeIn`/`fadeOut` toasts |
| 5.1 Arrays and Objects | Map rows, order queues, tiles keyed by `"x,y"` |
| 5.3 Module Pattern | `Renderer(...)` factory; `Sprites`, `Auth`, `UI`, `HUD`, `Input`, `Socket` IIFE modules |
| 6.1 / 6.2 Canvas | Kitchen drawn with rects/arcs/paths/text; mouse position via `offset()` |
| 6.3 Drawing Sprites | `sprites.png` via `new Image()` + `onload`, 9-parameter `drawImage`, `imageSmoothingEnabled = false` |
| 6.4 Animating Sprites | `requestAnimationFrame` loop; walk/chop/dizzy sequences timed with timestamps |
| 7.1 JSON | All socket messages and the users file |
| 7.4 Express | `express.static`, JSON endpoints (`/ranking`, `/validate`, `/rules`, `/check-username`) |
| 8.1 / 8.2 Promises + AJAX | `fetch` for register/sign-in/ranking with `.then()` |
| 8.3 SPA example | Single page app; `fs.readFileSync/writeFileSync` JSON "database" |
| 9.2 Web Authentication | `express-session` sign-in, session kept across refresh, `crypto` module |
| 10.1 WebSocket | Socket.IO rooms, queue broadcast, server relays and broadcasts game state |
| 11.1 Posting Form Data | JSON bodies posted to `/register` and `/signin` |

Not from the slides:
- `crypto.scryptSync` to hash passwords
- `io.engine.use(session)` to share the Express session with Socket.IO
- canvas `save/translate/rotate/restore` and `setLineDash`
- CSS `grid-template-areas` and `display: contents` for the game page layout
