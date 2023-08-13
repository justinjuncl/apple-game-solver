const TARGET_SUM = 10;

const ROWS = 10;
const COLS = 17;

const TILE_SIZE = 50;

const FONT_SIZE = 32;
const FONT_FAMILY = "Space Mono";

const LINE_WIDTH = 3;

const SLEEP_INTERVAL = 100;

const CANVAS_WIDTH = TILE_SIZE * (COLS + 1);
const CANVAS_HEIGHT = TILE_SIZE * (ROWS + 1);

let ctx;
let stats;

let tiles;
let score;
let playCounter;
let loopCounter;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function initCanvas() {
    const canvas = document.createElement("canvas");
    document.body.appendChild(canvas);

    const ratio = window.devicePixelRatio;

    canvas.width = CANVAS_WIDTH * ratio;
    canvas.height = CANVAS_HEIGHT * ratio;

    canvas.style.width = CANVAS_WIDTH + "px";
    canvas.style.height = CANVAS_HEIGHT + "px";

    ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function initStats() {
    stats = document.createElement("table");
    document.body.appendChild(stats);
}

function initGame() {
    tiles = [];
    for (let row = 0; row < ROWS; row++) {
        tiles.push([]);
        for (let col = 0; col < COLS; col++) {
            tiles[row][col] = Math.floor(Math.random() * 9 + 1);
        }
    }

    score = 0;
    playCounter = 0;
    loopCounter = 0;
}

function render() {
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            if (tiles[row][col] > 0)
                renderTile(row, col, tiles[row][col]);
        }
    }

    renderStats();
}

function renderTile(row, col, value) {
    ctx.fillStyle = "black";
    ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(value.toString(), TILE_SIZE * (col + 1), TILE_SIZE * (row + 1));
}

function renderStats() {
    stats.innerHTML = '';
    stats.style.fontFamily = FONT_FAMILY;
    stats.style.borderSpacing = "20px 0";

    const data = {
        "SCORE": score,
        "PLAY": playCounter,
        "LOOP": loopCounter
    };

    Object.entries(data).forEach(([label, value]) => {
        let row = stats.insertRow();
        row.insertCell().appendChild(document.createTextNode(label));
        row.insertCell().appendChild(document.createTextNode(value));
    });
}

const randomNumber = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);
const randomByte = () => randomNumber(0, 255)
const randomPercent = () => (randomNumber(50, 100) * 0.01).toFixed(2)
const randomCssRgba = () => `rgba(${[randomByte(), randomByte(), randomByte(), randomPercent()].join(',')})`

function getNextMoves(tiles) {
    let moves = [];

    for (let height = 0; height < ROWS + 1; height++) {
        for (let width = 0; width < COLS + 1; width++) {
            for (let row = 0; row < ROWS - height + 1; row++) {
                for (let col = 0; col < COLS - width + 1; col++) {
                    let sum = 0;
                    for (let h = 0; h < height; h++) {
                        for (let w = 0; w < width; w++) {
                            sum += tiles[row + h][col + w];
                        }
                    }

                    if (sum === TARGET_SUM) {
                        moves.push([row, col, height, width]);
                    }
                }
            }
        }
    }

    return moves;
}

const shuffleArray = array => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
}

// 1 1 1 1 1 1
// 1 . 1 1 1 .
// 1 1 O 1 1 1
// 1 1 1 1 1 1
// 1 . 1 1 1 X
//
//
// 1 2 3 4 5 6
// 2 4 6 8 10 12
// 3 6 9 12 15 18
// 4 8 12 16 20 24
// 5 10 15 20 25 30

30 - 10 - 12 + 4 = 12

function deepCopy(obj) {
    return JSON.parse(JSON.stringify(obj));
}

let tries = 0;
function backtrack(state) {
    if (state.score > ROWS * COLS) return;

    let moves = getNextMoves(state.tiles);
    shuffleArray(moves);

    if (moves.length == 0) {
        tries++;
        console.log(deepCopy(state));
        return;
    }

    if (tries > 1000) return;

    for (const move of moves) {
        const [row, col, height, width] = move;

        const temp = [];
        let score = 0;
        for (let h = 0; h < height; h++) {
            for (let w = 0; w < width; w++) {
                temp.push(state.tiles[row + h][col + w]);

                if (state.tiles[row + h][col + w] > 0) score++;
                state.tiles[row + h][col + w] = 0;
            }
        }
        temp.reverse();

        state.moves.push(move);
        state.score += score;

        backtrack(state);

        state.score -= score;
        state.moves.pop();

        for (let h = 0; h < height; h++) {
            for (let w = 0; w < width; w++) {
                state.tiles[row + h][col + w] = temp.pop();
            }
        }
    }
}

async function scan(height, width) {
    for (let row = 0; row < ROWS - height + 1; row++) {
        for (let col = 0; col < COLS - width + 1; col++) {
            let sum = 0;
            for (let h = 0; h < height; h++) {
                for (let w = 0; w < width; w++) {
                    sum += tiles[row + h][col + w];
                }
            }

            if (sum === TARGET_SUM) {
                render();
                renderScan(randomCssRgba(), row, col, height, width);

                let count = 0;
                for (let h = 0; h < height; h++) {
                    for (let w = 0; w < width; w++) {
                        if (tiles[row + h][col + w] > 0) count++;
                        tiles[row + h][col + w] = 0;
                    }
                }

                score += count;
                playCounter++;

                await sleep(SLEEP_INTERVAL);
            }
        }
    }

    render();
}

function renderScan(color, startRow, startCol, height, width) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.fillRect(TILE_SIZE * (startCol + 0.5), TILE_SIZE * (startRow + 0.5), TILE_SIZE * width, TILE_SIZE * height);
    ctx.strokeStyle = color;
    ctx.lineWidth = LINE_WIDTH;
    ctx.strokeRect(TILE_SIZE * (startCol + 0.5), TILE_SIZE * (startRow + 0.5), TILE_SIZE * width, TILE_SIZE * height);
}

async function loop() {
    for (let height = 0; height < ROWS + 1; height++) {
        for (let width = 0; width < COLS + 1; width++) {
            await scan(height, width);
        }
    }

    loopCounter++;
}

async function start() {
    let prevScore = -1;
    while (prevScore !== score) {
        prevScore = score;
        await loop();
    }
}


initCanvas();
initStats();
initGame();

// start();
backtrack({ tiles: tiles, score: 0, moves: [] });
