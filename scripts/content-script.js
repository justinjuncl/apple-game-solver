// ----- CONSTANTS -----

var WORKER_COUNT = 16;

var DARK_GREEN = [150, 100, 40];
var LIGHT_GREEN = [107, 70, 88];
var RED = [0, 99, 60];
var PINK = [7, 65, 60];
var BROWN = [21, 70, 51];
var WHITE = [0, 90, 100];
var BLACK = [0, 0, 0];

var COLORS = [DARK_GREEN, LIGHT_GREEN, WHITE, RED, PINK, BROWN];

var TARGET_SUM = 10;

var ROWS = 10;
var COLS = 17;

var LOAD_SLEEP_INTERVAL = 200;
// var DRAW_SLEEP_INTERVAL = 20;
// var CLICK_SLEEP_INTERVAL = 20;
var RESET_SLEEP_INTERVAL = 1000;

var CROP_LEFT = 70;
var CROP_TOP = 71;
var CROP_WIDTH = 559;
var CROP_HEIGHT = 334;

var TILE_WIDTH = Math.round(CROP_WIDTH / COLS);
var TILE_HEIGHT = Math.round(CROP_HEIGHT / ROWS);

// ----- UTIL -----

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ----- IMAGE PROCESSING -----

function getDist(source, target) {
    return (
        300 * Math.pow(source[0] - target[0], 2) +
        Math.pow(source[1] - target[1], 2) +
        Math.pow(source[2] - target[2], 2)
    );
}

function getClosest(data) {
    let minDist = getDist(data, COLORS[0]);
    let minIdx = 0;

    for (let idx = 1; idx < COLORS.length; idx++) {
        let dist = getDist(data, COLORS[idx]);
        if (dist < minDist) {
            minDist = dist;
            minIdx = idx;
        }
    }

    return COLORS[minIdx];
}

function equals(data, a, i) {
    return data[i] === a[0] && data[i + 1] === a[1] && data[i + 2] === a[2];
}

function replaceBy(data, a, b, i) {
    if (equals(data, a, i)) {
        fill(data, b, i);
    }
}

function fill(data, target, i) {
    data[i] = target[0];
    data[i + 1] = target[1];
    data[i + 2] = target[2];
}

function flip(data, i) {
    data[i] = 255 - data[i];
    data[i + 1] = 255 - data[i + 1];
    data[i + 2] = 255 - data[i + 2];
}

function RGBtoHSL([r, g, b]) {
    r /= 255;
    g /= 255;
    b /= 255;
    const l = Math.max(r, g, b);
    const s = l - Math.min(r, g, b);
    const h = s
        ? l === r
            ? (g - b) / s
            : l === g
                ? 2 + (b - r) / s
                : 4 + (r - g) / s
        : 0;

    return [
        60 * h < 0 ? 60 * h + 360 : 60 * h,
        100 * (s ? (l <= 0.5 ? s / (2 * l - s) : s / (2 - (2 * l - s))) : 0),
        (100 * (2 * l - s)) / 2,
    ];
};

function HSLtoRGB([h, s, l]) {
    s /= 100;
    l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n =>
        l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [255 * f(0), 255 * f(8), 255 * f(4)].map(Math.round);
};

function postProcess(ctx) {
    const pixel = ctx.getImageData(CROP_LEFT, CROP_TOP, CROP_WIDTH, CROP_HEIGHT);
    const data = pixel.data;

    for (let x = 0; x < CROP_WIDTH; x++) {
        for (let y = 0; y < CROP_HEIGHT; y++) {
            const i = y * (CROP_WIDTH * 4) + x * 4;

            let source = RGBtoHSL([data[i], data[i + 1], data[i + 2]]);
            let target = getClosest(source);

            fill(data, HSLtoRGB(target), i);

            replaceBy(data, HSLtoRGB(LIGHT_GREEN), HSLtoRGB(BLACK), i);
            replaceBy(data, HSLtoRGB(RED), HSLtoRGB(BLACK), i);
            replaceBy(data, HSLtoRGB(PINK), HSLtoRGB(BLACK), i);
            replaceBy(data, HSLtoRGB(BROWN), HSLtoRGB(BLACK), i);

            flip(data, i);
        }
    }

    const newCanvas = document.createElement("canvas");
    newCanvas.width = CROP_WIDTH;
    newCanvas.height = CROP_HEIGHT;

    newCanvas.getContext("2d").putImageData(pixel, 0, 0);

    // downloadImage(newCanvas, "post-process.png");

    return newCanvas;
}

async function main() {
    await sleep(LOAD_SLEEP_INTERVAL);
    clickStart();

    console.log("LOADING TESSERACT");

    const { createWorker, createScheduler, PSM } = Tesseract;

    const scheduler = createScheduler();

    async function createAndAddWorker() {
        const worker = await createWorker({
            workerPath: chrome.runtime.getURL('scripts/lib/worker.min.js'),
            langPath: chrome.runtime.getURL('traineddata/'),
            corePath: chrome.runtime.getURL('scripts/lib/tesseract-core-simd.wasm.js'),
        });

        await worker.loadLanguage('eng');
        await worker.initialize('eng');
        await worker.setParameters({
            tessedit_char_whitelist: '0123456789',
            tessedit_pageseg_mode: PSM.SINGLE_CHAR
        });

        return worker;
    }

    const workers = await Promise.all((new Array(WORKER_COUNT)).fill(0).map((_) => createAndAddWorker()));

    for (const worker of workers)
        scheduler.addWorker(worker);

    console.log("LOADING CANVAS");

    let canvas = document.getElementById("canvas");

    const scale = canvas.width / canvas.clientWidth;

    CROP_LEFT = Math.round(CROP_LEFT * scale);
    CROP_TOP = Math.round(CROP_TOP * scale);
    CROP_WIDTH = Math.round(CROP_WIDTH * scale);
    CROP_HEIGHT = Math.round(CROP_HEIGHT * scale);

    TILE_WIDTH = Math.round(TILE_WIDTH * scale);
    TILE_HEIGHT = Math.round(TILE_HEIGHT * scale);

    let ctx = canvas.getContext("2d", { willReadFrequently: true });

    console.log("POST-PROCESSING");

    canvas = postProcess(ctx);

    console.log("RECOGNIZING");

    const results = await Promise.all((new Array(ROWS * COLS)).fill(0).map((val, i) => {
        const rectangle = {
            left: (i % COLS) * TILE_WIDTH,
            top: (Math.floor(i / COLS)) * TILE_HEIGHT,
            width: TILE_WIDTH,
            height: TILE_HEIGHT,
        };
        return scheduler.addJob('recognize', canvas, { rectangle });
    }));

    const tilesData = results.map(r => parseInt(r.data.text));

    await scheduler.terminate();

    CROP_LEFT = Math.round(CROP_LEFT / scale);
    CROP_TOP = Math.round(CROP_TOP / scale);
    CROP_WIDTH = Math.round(CROP_WIDTH / scale);
    CROP_HEIGHT = Math.round(CROP_HEIGHT / scale);

    TILE_WIDTH = Math.round(TILE_WIDTH / scale);
    TILE_HEIGHT = Math.round(TILE_HEIGHT / scale);

    await initGame(tilesData);

    await solve();

    await sleep(RESET_SLEEP_INTERVAL);

    clickReset();
};

async function start() {
    while (true) {
        await main();
    }
}

start();

// ----- OUTPUT -----

async function downloadImage(canvas, filename = 'untitled.png') {
    const a = document.createElement('a');
    a.href = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    await sleep(10);
    document.body.removeChild(a);
}

// ----- INPUT -----

function dispatchMouseEvent(element, eventName, coordX, coordY) {
    element.dispatchEvent(new MouseEvent(eventName, {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: coordX,
        clientY: coordY,
        button: 0
    }));
};

function clickStart() {
    const canvas = document.getElementById("canvas");

    const box = canvas.getBoundingClientRect();
    const coordX = box.left + (box.right - box.left) * 0.25;
    const coordY = box.top + (box.bottom - box.top) * 0.5;

    dispatchMouseEvent(canvas, "mousedown", coordX, coordY);
    dispatchMouseEvent(canvas, "mouseup", coordX, coordY);
}

function clickReset() {
    const canvas = document.getElementById("canvas");

    const box = canvas.getBoundingClientRect();
    const coordX = box.left + (box.right - box.left) * 0.1;
    const coordY = box.top + (box.bottom - box.top) * 0.95;

    dispatchMouseEvent(canvas, "mousedown", coordX, coordY);
    dispatchMouseEvent(canvas, "mouseup", coordX, coordY);
}

async function drawRect(row, col, height, width) {
    const canvas = document.getElementById("canvas");

    const box = canvas.getBoundingClientRect();

    const startX = box.left + CROP_LEFT + TILE_WIDTH * col;
    const startY = box.top + CROP_TOP + TILE_HEIGHT * row;
    const endX = startX + TILE_WIDTH * width;
    const endY = startY + TILE_HEIGHT * height;

    dispatchMouseEvent(canvas, "mousedown", startX, startY);
    // await sleep(CLICK_SLEEP_INTERVAL);
    dispatchMouseEvent(canvas, "mousemove", endX, endY);
    // await sleep(CLICK_SLEEP_INTERVAL);
    dispatchMouseEvent(canvas, "mouseup", endX, endY);
}

// ----- GAME MECHANICS -----

var tiles;
var score;
var loopCounter;

async function initGame(tilesData) {
    tiles = [];
    let i = 0
    for (let row = 0; row < ROWS; row++) {
        tiles.push([]);
        for (let col = 0; col < COLS; col++) {
            tiles[row][col] = tilesData[i++];
        }
    }

    score = 0;
    loopCounter = 0;
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
                await drawRect(row, col, height, width);

                let count = 0;
                for (let h = 0; h < height; h++) {
                    for (let w = 0; w < width; w++) {
                        if (tiles[row + h][col + w] > 0) count++;
                        tiles[row + h][col + w] = 0;
                    }
                }

                score += count;

                // await sleep(DRAW_SLEEP_INTERVAL);
            }
        }
    }
}

async function loop() {
    for (let height = 1; height < ROWS + 1; height++) {
        for (let width = 1; width < COLS + 1; width++) {
            await scan(height, width);
        }
    }

    loopCounter++;
}

async function solve() {
    let prevScore = -1;
    while (prevScore !== score) {
        prevScore = score;
        await loop();
    }
}
