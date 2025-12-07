document.addEventListener('DOMContentLoaded', function() {
    // Game variables
    let grid = [];
    let score = 0;
    let gameOver = false;
    let won = false;
    const gridSize = 4;
    
    // Initialize the game
    function initGame() {
        // Reset variables
        grid = [];
        score = 0;
        gameOver = false;
        won = false;
        
        // Create empty grid
        for (let i = 0; i < gridSize; i++) {
            grid[i] = [];
            for (let j = 0; j < gridSize; j++) {
                grid[i][j] = 0;
            }
        }
        
        // Add two initial tiles
        addRandomTile();
        addRandomTile();
        
        // Update the display
        updateGrid();
        updateScore();
        
        // Listen for keydown events
        document.addEventListener('keydown', handleKeyPress);
    }
    
    // Create a new random tile (2 or 4)
    function addRandomTile() {
        if (isBoardFull()) return;
        
        let added = false;
        while (!added) {
            // Generate random position
            let row = Math.floor(Math.random() * gridSize);
            let col = Math.floor(Math.random() * gridSize);
            
            // If position is empty, add a tile
            if (grid[row][col] === 0) {
                // 90% chance of 2, 10% chance of 4
                grid[row][col] = Math.random() < 0.9 ? 2 : 4;
                added = true;
            }
        }
    }
    
    // Check if the board is completely full
    function isBoardFull() {
        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                if (grid[i][j] === 0) {
                    return false;
                }
            }
        }
        return true;
    }
    
    // Check if any moves are possible
    function isGameOver() {
        // Check if there are any empty cells
        if (!isBoardFull()) return false;
        
        // Check if any adjacent cells have the same value
        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                // Check right neighbor
                if (j < gridSize - 1 && grid[i][j] === grid[i][j + 1]) {
                    return false;
                }
                // Check bottom neighbor
                if (i < gridSize - 1 && grid[i][j] === grid[i + 1][j]) {
                    return false;
                }
            }
        }
        
        // No moves possible
        return true;
    }
    
    // Update the grid display
    function updateGrid() {
        const gridElement = document.getElementById('grid');
        gridElement.innerHTML = '';
        
        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                const tileValue = grid[i][j];
                const tile = document.createElement('div');
                
                tile.classList.add('tile');
                if (tileValue !== 0) {
                    tile.textContent = tileValue;
                    tile.classList.add(`tile-${tileValue}`);
                }
                
                gridElement.appendChild(tile);
            }
        }
    }
    
    // Update the score display
    function updateScore() {
        document.getElementById('score-value').textContent = score;
    }
    
    // Handle keyboard input
    function handleKeyPress(e) {
        if (gameOver || won) return;
        
        let moved = false;
        
        switch(e.key) {
            case 'ArrowUp':
                moved = moveUp();
                break;
            case 'ArrowDown':
                moved = moveDown();
                break;
            case 'ArrowLeft':
                moved = moveLeft();
                break;
            case 'ArrowRight':
                moved = moveRight();
                break;
            default:
                return; // Ignore other keys
        }
        
        if (moved) {
            addRandomTile();
            updateGrid();
            updateScore();
            
            // Check for win or game over
            checkGameEnd();
        }
    }
    
    // Move tiles up
    function moveUp() {
        let moved = false;
        
        for (let j = 0; j < gridSize; j++) {
            for (let i = 1; i < gridSize; i++) {
                if (grid[i][j] !== 0) {
                    let row = i;
                    while (row > 0) {
                        // Move to empty space
                        if (grid[row - 1][j] === 0) {
                            grid[row - 1][j] = grid[row][j];
                            grid[row][j] = 0;
                            row--;
                            moved = true;
                        }
                        // Merge with same value
                        else if (grid[row - 1][j] === grid[row][j]) {
                            grid[row - 1][j] *= 2;
                            score += grid[row - 1][j];
                            if (grid[row - 1][j] === 2048 && !won) {
                                won = true;
                            }
                            grid[row][j] = 0;
                            moved = true;
                            break;
                        }
                        else {
                            break;
                        }
                    }
                }
            }
        }
        
        return moved;
    }
    
    // Move tiles down
    function moveDown() {
        let moved = false;
        
        for (let j = 0; j < gridSize; j++) {
            for (let i = gridSize - 2; i >= 0; i--) {
                if (grid[i][j] !== 0) {
                    let row = i;
                    while (row < gridSize - 1) {
                        // Move to empty space
                        if (grid[row + 1][j] === 0) {
                            grid[row + 1][j] = grid[row][j];
                            grid[row][j] = 0;
                            row++;
                            moved = true;
                        }
                        // Merge with same value
                        else if (grid[row + 1][j] === grid[row][j]) {
                            grid[row + 1][j] *= 2;
                            score += grid[row + 1][j];
                            if (grid[row + 1][j] === 2048 && !won) {
                                won = true;
                            }
                            grid[row][j] = 0;
                            moved = true;
                            break;
                        }
                        else {
                            break;
                        }
                    }
                }
            }
        }
        
        return moved;
    }
    
    // Move tiles left
    function moveLeft() {
        let moved = false;
        
        for (let i = 0; i < gridSize; i++) {
            for (let j = 1; j < gridSize; j++) {
                if (grid[i][j] !== 0) {
                    let col = j;
                    while (col > 0) {
                        // Move to empty space
                        if (grid[i][col - 1] === 0) {
                            grid[i][col - 1] = grid[i][col];
                            grid[i][col] = 0;
                            col--;
                            moved = true;
                        }
                        // Merge with same value
                        else if (grid[i][col - 1] === grid[i][col]) {
                            grid[i][col - 1] *= 2;
                            score += grid[i][col - 1];
                            if (grid[i][col - 1] === 2048 && !won) {
                                won = true;
                            }
                            grid[i][col] = 0;
                            moved = true;
                            break;
                        }
                        else {
                            break;
                        }
                    }
                }
            }
        }
        
        return moved;
    }
    
    // Move tiles right
    function moveRight() {
        let moved = false;
        
        for (let i = 0; i < gridSize; i++) {
            for (let j = gridSize - 2; j >= 0; j--) {
                if (grid[i][j] !== 0) {
                    let col = j;
                    while (col < gridSize - 1) {
                        // Move to empty space
                        if (grid[i][col + 1] === 0) {
                            grid[i][col + 1] = grid[i][col];
                            grid[i][col] = 0;
                            col++;
                            moved = true;
                        }
                        // Merge with same value
                        else if (grid[i][col + 1] === grid[i][col]) {
                            grid[i][col + 1] *= 2;
                            score += grid[i][col + 1];
                            if (grid[i][col + 1] === 2048 && !won) {
                                won = true;
                            }
                            grid[i][col] = 0;
                            moved = true;
                            break;
                        }
                        else {
                            break;
                        }
                    }
                }
            }
        }
        
        return moved;
    }
    
    // Check for game over or win
    function checkGameEnd() {
        if (won) {
            alert("You won! Continue playing?");
        } else if (isGameOver()) {
            gameOver = true;
            alert("Game over!");
        }
    }
    
    // New Game button
    document.getElementById('new-game').addEventListener('click', function() {
        initGame();
    });
    
    // Start the game
    initGame();
});