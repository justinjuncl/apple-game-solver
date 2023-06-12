// ----- CONSTANTS -----

var CANVAS_WIDTH = 1440;
var CANVAS_HEIGHT = 940;

var CROP_LEFT = 141;
var CROP_TOP = 143;
var CROP_WIDTH = 1118;
var CROP_HEIGHT = 668;

var SCALE;

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
var DRAW_SLEEP_INTERVAL = 20;
var CLICK_SLEEP_INTERVAL = 10;

var TILE_WIDTH = CROP_WIDTH / COLS;
var TILE_HEIGHT = CROP_HEIGHT / ROWS;

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

    // downloadImage(newCanvas.toDataURL("image/png").replace("image/png", "image/octet-stream"), "post-process.png");

    return newCanvas;
}

async function main() {
    await sleep(LOAD_SLEEP_INTERVAL);
    clickStart();
    await sleep(LOAD_SLEEP_INTERVAL);

    console.log("LOADING CANVAS");
    let canvas = document.getElementById("canvas");
    SCALE = canvas.width / canvas.clientWidth;
    let ctx = canvas.getContext("2d", { willReadFrequently: true });

    // downloadImage(canvas.toDataURL("image/png").replace("image/png", "image/octet-stream"), "original.png");

    console.log("POST-PROCESSING");

    canvas = postProcess(ctx);

    console.log("LOADING TESSERACT");

    const { createWorker } = Tesseract;

    const worker = await createWorker({
        workerPath: chrome.runtime.getURL('scripts/lib/worker.min.js'),
        langPath: chrome.runtime.getURL('traineddata/'),
        corePath: chrome.runtime.getURL('scripts/lib/tesseract-core-simd.wasm.js'),
    });

    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    await worker.setParameters({
        tessedit_char_whitelist: ' 0123456789',
    });

    console.log("RECOGNIZING");

    const { data: { text } } = await worker.recognize(canvas);

    console.log(text);

    tilesData = text.replace(/\s+/g, "").split("");

    const length = tilesData.length;

    console.log(length);

    if (length === ROWS * COLS) {
        initGame(tilesData);
        await solve();
    } else {
        console.log("CAN'T SOLVE");
    }

    await worker.terminate();
};

main();

// ----- OUTPUT -----

async function downloadImage(data, filename = 'untitled.png') {
    const a = document.createElement('a');
    a.href = data;
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
    const coordX = box.left + (box.right - box.left) / 4;
    const coordY = box.top + (box.bottom - box.top) / 1.9;

    dispatchMouseEvent(canvas, "mousedown", coordX, coordY);
    dispatchMouseEvent(canvas, "mouseup", coordX, coordY);
}

async function drawRect(row, col, height, width) {
    const canvas = document.getElementById("canvas");

    const box = canvas.getBoundingClientRect();

    const startX = box.left + CROP_LEFT / SCALE + TILE_WIDTH * col / SCALE;
    const startY = box.top + CROP_TOP / SCALE + TILE_HEIGHT * row / SCALE;
    const endX = startX + TILE_WIDTH * width / SCALE;
    const endY = startY + TILE_HEIGHT * height / SCALE;

    dispatchMouseEvent(canvas, "mousedown", startX, startY);
    await sleep(CLICK_SLEEP_INTERVAL);
    dispatchMouseEvent(canvas, "mousemove", endX, endY);
    await sleep(CLICK_SLEEP_INTERVAL);
    dispatchMouseEvent(canvas, "mouseup", endX, endY);
}

// ----- GAME MECHANICS -----

var tiles;
var score;
var drawCounter;
var loopCounter;

function initGame(tilesData) {
    tiles = [];
    let i = 0
    for (let row = 0; row < ROWS; row++) {
        tiles.push([]);
        for (let col = 0; col < COLS; col++) {
            tiles[row][col] = parseInt(tilesData[i++]);
        }
    }

    score = 0;
    drawCounter = 0;
    loopCounter = 0;

    solve();
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
                drawCounter++;

                await sleep(DRAW_SLEEP_INTERVAL);
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

    console.log(drawCounter, loopCounter);
}
