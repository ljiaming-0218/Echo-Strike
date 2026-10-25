import "./style.css";
import { createGame } from "./game/createGame";

const parent = document.querySelector<HTMLElement>("#game");
if (!parent) throw new Error("Game container is missing");
const game = createGame(parent);

if (import.meta.hot) import.meta.hot.dispose(() => game.destroy(true));
