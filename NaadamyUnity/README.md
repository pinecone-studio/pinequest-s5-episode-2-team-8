# Naadamy — Unity version

The whole of Naadamy as a Unity 6 app for Android and PC: Нутаг, the heritage school, Basar the AI dog, trips to all 21 aimags and Ulaanbaatar, the Mongol script academy, the 3D first-person view, playing together on one Wi-Fi, and everything around them. It uses no packages: the village, characters and animals are drawn pixel by pixel in code (`Px.cs`, `PxMore.cs`), the sounds are made in code (`Sfx.cs`), the UI is IMGUI, and the 3D view uses three small shaders in `Assets/Resources/Shaders`.

## Open and play

1. Unity Hub → **Add project from disk** → choose this `NaadamyUnity` folder. Editor version **6000.6.7f1**.
2. On first open, `Naadamy/Set up project` runs by itself. It creates `Assets/Scenes/Nutag.unity`, adds it to the build, and sets the app name, landscape screen and network permissions.
3. Press **Play**.

Controls: **WASD/arrows** walk · **Shift** run · **Space** jump · **E** use · **B** Basar · **Esc** close.
On a phone: drag anywhere to walk (the joystick appears under your finger), tap a place or a building to go there, and use the big blue button.
In 3D: click the view to look with the mouse, WASD, Space, Shift, E, and in a battle click or F to shoot. On a phone, drag on the left to walk and on the right to look.

## Basar AI and playing together

Both use the web version's server. On a computer on the same Wi-Fi, run `node server.js` in the repo root (put `ANTHROPIC_API_KEY` in `.env` for Basar AI). In the game, open ☰ → **Settings** and write the address the server prints, for example `192.168.1.10:8000`. Without an address, Basar uses his offline knowledge and you play alone. Everyone with the same **room code** (the ● button in Нутаг) shares one village: you see each other walk and ride, say phrases and emotes (with the room's recent chat), see each other's gers go up step by step, and can challenge a friend to a live wrestling match. Two people can also play on one screen: the ● Together button in Нутаг.

## Build

- **Android:** install *Android Build Support* (with OpenJDK and the Android SDK & NDK) for 6000.6.7f1 in Unity Hub → Installs → ⚙ → Add modules. Then use the menu **Naadamy → Build Android APK** (output: `Builds/Android/Naadamy.apk`).
- **Windows:** **Naadamy → Build Windows** (needs *Windows Build Support*).
- **Web (browser):** install *WebGL Build Support*, then **Naadamy → Build WebGL** (output: `Builds/WebGL`, with its own `vercel.json`). Put it online with `npx vercel deploy --prod` from that folder; it is live at https://naadamy-unity.vercel.app. In a browser the game brings its own font (`Resources/Fonts`, a browser has none with Mongolian letters), plays together over the browser's own WebSocket (`Plugins/WebGL`), needs an `https://` server address for Basar AI and playing together, and has no voice recording in the memory book.

## What is where

| Part | Web source | Unity |
|---|---|---|
| Village map, collision, A* paths | `js/village/world.js` | `World.cs`: the same seeded generator, so the grid is identical |
| Pixel art: tiles, buildings, people, animals, icons | `js/village/pixel.js`, `js/icons.js` | `Px.cs`, `PxMore.cs`, `Emo.cs` |
| Walking, joystick, HUD, windows | `village.js` | `Game.cs`, `GameUI.cs` |
| Milking and dairy foods, shop, wardrobe, bag, food | `village.js`, `rules.js` | `GameDairy.cs`, `GameShop.cs`, `Rules.cs`, `Content.cs` |
| Fishing, horses and races, archery, wrestling and the wrestling school, Grandma, townspeople | `village.js` | `GameFish.cs`, `GameHorse.cs`, `GameArchery.cs`, `GameWrestle.cs`, `GameEmee.cs` |
| Hands-on tasks: drag, rhythm, spots, hold, turn, choose | `js/village/tasks.js` | `Tasks.cs` |
| Making the white foods by hand | `js/village/dairywork.js` | `DairyWork.cs`, `GameDairy.cs` |
| Building your own ger by hand: shearing, felt, Grandpa Craftsman, the 9 steps | `js/village/gerwork.js` | `GerWork.cs` |
| Its inside, furniture and colours | `village.js` | `GameHome.cs`, `WalkScene.cs` |
| Two players on one screen | `village.js` | `Together.cs` |
| The historian and defending the homeland | `js/history.js`, `js/battles.js` | `History.cs` |
| Profiles, picture passwords, parent gate | `js/app.js`, `js/store.js` | `Profiles.cs`, `AppState.cs`, `SaveData.cs` |
| Basar (offline knowledge, AI chat, quizzes) | `js/basar/*` | `Basar.cs` |
| Heritage lessons, quiz party, family activities | `js/learn/*` | `Lessons.cs`, `Scenes.cs` |
| Aimag passport and trips, travel pass | `js/passport.js`, `js/travel.js` | `Aimags.cs`, `Travel.cs` |
| 3D first person (voxel worlds) | `js/fp.js`, `js/fpworld.js` | `FirstPerson.cs` |
| Mongol script academy | `js/bichig.js` | `Bichig.cs` |
| Bolormaa's tutorial, the story box, voices | `js/tutorial.js`, `js/dialog.js` | `Tutorial.cs` |
| Achievements, seasons | `js/achievements.js`, `js/seasons.js` | `Achievements.cs`, `Seasons.cs` |
| Menu, parent dashboard, memory book, settings, about | `js/app.js` | `AppPages.cs` |
| Playing together over Wi-Fi (protocol 5: gers built step by step, the room's chat log) | `server.js`, `docs/PROTOCOL.md` | `Net.cs` |
| Background music | `assets/music` | `Music.cs`, `Resources/Music` |

## Content from the web version

The stories, questions and facts are not copied by hand. `Tools/export-web-data.js` runs the web files and writes them to `Assets/Resources/Data/*.json`. It also renders, with the web version's own drawing code, the pictures that are easier to keep in one place: the aimag trip maps, the trip animals, Nomin, the 3D block textures and the 3D worlds themselves (`Resources/World`). `Tools/render-bichig.js` renders the Mongol script letters with Microsoft Edge, because Unity can't shape Mongol script. After changing the web content, run from the repo root:

```
node NaadamyUnity/Tools/export-web-data.js
node NaadamyUnity/Tools/render-bichig.js
```

`Js.cs` copies JavaScript's number rules (`Math.round`, the 32-bit `hash`, the seeded random), so the generated content comes out exactly like on the web.
