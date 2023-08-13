const TARGET_SUM = 10;

const ROWS = 10;
const COLS = 17;

let tiles;
let score;
let playCounter;
let loopCounter;

class TupleSet {
    constructor() {
        this.set = new Set();
    }

    add(v) {
        this.set.add(JSON.stringify(v));
    }

    has(v) {
        this.set.has(JSON.stringify(v));
    }

    delete(v) {
        this.set.delete(JSON.stringify(v));
    }
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

function prefixSum(arr) {
    for (let j = 0; j < arr[0].length; j++) {
        for (let i = 1; i < arr.length; i++) {
            arr[i][j] += arr[i - 1][j];
        }
    }
    for (let i = 0; i < arr.length; i++) {
        for (let j = 1; j < arr[0].length; j++) {
            arr[i][j] += arr[i][j - 1];
        }
    }
}

function createPrefixSum(arr) {
    let res = arr.map(row => row.slice());
    prefixSum(res);
    return res;
}

function getNextMoves(tiles) {
    let moves = [];
    let prefixSumTiles = createPrefixSum(tiles);

    for (let height = 1; height < ROWS + 1; height++) {
        for (let width = 1; width < COLS + 1; width++) {
            for (let row = 0; row < ROWS - height; row++) {
                for (let col = 0; col < COLS - width; col++) {
                    let sum = prefixSumTiles[row + height][col + width];
                    if (row - 1 > 0) sum -= prefixSumTiles[row - 1][col];
                    if (col - 1 > 0) sum -= prefixSumTiles[row][col - 1];
                    if (row - 1 > 0 && col - 1 > 0) sum += prefixSumTiles[row - 1][col - 1];

                    // for (let h = 0; h < height; h++) {
                    //     for (let w = 0; w < width; w++) {
                    //         sum += tiles[row + h][col + w];
                    //     }
                    // }

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

// 30 - 10 - 12 + 4 = 12

function deepCopy(obj) {
    return JSON.parse(JSON.stringify(obj));
}

let movesSet = new TupleSet();
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

initGame();

backtrack({ tiles: tiles, score: 0, moves: [] });
