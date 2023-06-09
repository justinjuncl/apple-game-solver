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

start();
