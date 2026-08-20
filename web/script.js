(() => {
  "use strict";

  // --- 게임 설정 ---
  const BOARD_SIZE = 19;
  const WIN_CONDITION = 6;
  const TIMER_SECONDS = 30;
  const PADDING_RATIO = 0.03; // 캔버스 너비 대비 여백 비율

  const EMPTY = 0;
  const BLACK = 1;
  const WHITE = 2;

  // --- DOM ---
  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const boardWrap = document.getElementById("board-wrap");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayRestart = document.getElementById("overlay-restart");
  const resetBtn = document.getElementById("reset-btn");

  const panels = {
    [BLACK]: document.getElementById("panel-black"),
    [WHITE]: document.getElementById("panel-white"),
  };
  const statusEls = {
    [BLACK]: document.getElementById("status-black"),
    [WHITE]: document.getElementById("status-white"),
  };
  const scoreEls = {
    [BLACK]: document.getElementById("score-black"),
    [WHITE]: document.getElementById("score-white"),
  };
  const timerFillEls = {
    [BLACK]: document.getElementById("timer-fill-black"),
    [WHITE]: document.getElementById("timer-fill-white"),
  };
  const timerTextEls = {
    [BLACK]: document.getElementById("timer-text-black"),
    [WHITE]: document.getElementById("timer-text-white"),
  };

  // --- 상태 ---
  let cssSize = 0;
  let padding = 0;
  let cellSize = 0;

  let board = [];
  let currentPlayer = BLACK;
  let stonesToPlace = 1;
  let lastMoves = [];
  let gameOver = false;
  let scores = { [BLACK]: 0, [WHITE]: 0 };
  let remainingTime = TIMER_SECONDS;
  let timerId = null;
  let hoverCell = null;

  function initBoardArray() {
    board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(EMPTY));
  }

  // --- 캔버스 크기 계산 ---
  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    cssSize = boardWrap.clientWidth;
    canvas.width = Math.round(cssSize * dpr);
    canvas.height = Math.round(cssSize * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    padding = cssSize * PADDING_RATIO + (cssSize / (BOARD_SIZE - 1)) * 0.5;
    cellSize = (cssSize - padding * 2) / (BOARD_SIZE - 1);
    render();
  }

  function cellCenter(row, col) {
    return {
      x: padding + col * cellSize,
      y: padding + row * cellSize,
    };
  }

  function pointToCell(x, y) {
    const col = Math.round((x - padding) / cellSize);
    const row = Math.round((y - padding) / cellSize);
    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return null;
    const { x: cx, y: cy } = cellCenter(row, col);
    if (Math.hypot(x - cx, y - cy) > cellSize * 0.55) return null;
    return { row, col };
  }

  // --- 렌더링 ---
  function render() {
    ctx.clearRect(0, 0, cssSize, cssSize);
    drawGrid();
    drawStarPoints();
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (board[r][c] !== EMPTY) drawStone(r, c, board[r][c]);
      }
    }
    drawLastMoveMarker();
    drawHoverGhost();
  }

  function drawGrid() {
    ctx.strokeStyle = "rgba(91, 64, 37, 0.55)";
    ctx.lineWidth = 1;
    const start = padding;
    const end = padding + (BOARD_SIZE - 1) * cellSize;
    for (let i = 0; i < BOARD_SIZE; i++) {
      const pos = padding + i * cellSize;
      ctx.beginPath();
      ctx.moveTo(pos, start);
      ctx.lineTo(pos, end);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(start, pos);
      ctx.lineTo(end, pos);
      ctx.stroke();
    }
  }

  function drawStarPoints() {
    if (BOARD_SIZE !== 19) return;
    const pts = [3, 9, 15];
    ctx.fillStyle = "rgba(91, 64, 37, 0.65)";
    for (const r of pts) {
      for (const c of pts) {
        const { x, y } = cellCenter(r, c);
        ctx.beginPath();
        ctx.arc(x, y, Math.max(2, cellSize * 0.08), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawStone(row, col, player, alpha = 1) {
    const { x, y } = cellCenter(row, col);
    const r = cellSize * 0.42;

    ctx.save();
    ctx.globalAlpha = alpha;

    ctx.beginPath();
    ctx.arc(x + r * 0.15, y + r * 0.22, r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fill();

    const grad = ctx.createRadialGradient(
      x - r * 0.35, y - r * 0.4, r * 0.15,
      x, y, r
    );
    if (player === BLACK) {
      grad.addColorStop(0, "#6b6b6b");
      grad.addColorStop(1, "#050505");
    } else {
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(1, "#cfcfcf");
    }
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    if (player === WHITE) {
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawLastMoveMarker() {
    if (!lastMoves.length) return;
    const { row, col } = lastMoves[lastMoves.length - 1];
    const { x, y } = cellCenter(row, col);
    ctx.beginPath();
    ctx.arc(x, y, Math.max(2.5, cellSize * 0.1), 0, Math.PI * 2);
    ctx.fillStyle = "#e63946";
    ctx.fill();
  }

  function drawHoverGhost() {
    if (gameOver || !hoverCell) return;
    const { row, col } = hoverCell;
    if (board[row][col] !== EMPTY) return;
    const { x, y } = cellCenter(row, col);
    const r = cellSize * 0.42;
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = currentPlayer === BLACK ? "rgba(10,10,10,0.65)" : "rgba(120,120,120,0.85)";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // --- 상호작용 ---
  function eventToBoardXY(evt) {
    const rect = canvas.getBoundingClientRect();
    const point = evt.touches ? evt.touches[0] : evt;
    const scale = cssSize / rect.width;
    return {
      x: (point.clientX - rect.left) * scale,
      y: (point.clientY - rect.top) * scale,
    };
  }

  function handleMove(evt) {
    if (gameOver) return;
    const { x, y } = eventToBoardXY(evt);
    hoverCell = pointToCell(x, y);
    render();
  }

  function handleLeave() {
    hoverCell = null;
    render();
  }

  function handleClick(evt) {
    if (gameOver) return;
    const { x, y } = eventToBoardXY(evt);
    const cell = pointToCell(x, y);
    if (!cell) return;
    const { row, col } = cell;
    if (board[row][col] !== EMPTY) return;
    placeStone(row, col);
  }

  // --- 게임 로직 ---
  function placeStone(row, col) {
    board[row][col] = currentPlayer;
    stonesToPlace -= 1;
    lastMoves.push({ row, col });
    render();

    if (checkWin(row, col)) {
      finishGame(`${playerLabel(currentPlayer)} 승리! 🎉`, currentPlayer);
      return;
    }
    if (isBoardFull()) {
      finishGame("무승부입니다", null);
      return;
    }

    if (stonesToPlace === 0) {
      switchPlayer();
    } else {
      updatePanels();
    }
  }

  function playerLabel(p) {
    return p === BLACK ? "흑돌" : "백돌";
  }

  function checkWin(row, col) {
    const stone = board[row][col];
    const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (const [dr, dc] of dirs) {
      let count = 1;
      for (let i = 1; i < WIN_CONDITION; i++) {
        const r = row + dr * i, c = col + dc * i;
        if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === stone) count++;
        else break;
      }
      for (let i = 1; i < WIN_CONDITION; i++) {
        const r = row - dr * i, c = col - dc * i;
        if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === stone) count++;
        else break;
      }
      if (count >= WIN_CONDITION) return true;
    }
    return false;
  }

  function isBoardFull() {
    return board.every((row) => row.every((v) => v !== EMPTY));
  }

  function switchPlayer() {
    currentPlayer = currentPlayer === BLACK ? WHITE : BLACK;
    stonesToPlace = 2;
    updatePanels();
    startTimer();
  }

  function finishGame(message, winner) {
    gameOver = true;
    stopTimer();
    if (winner) scores[winner] += 1;
    updateScores();
    updatePanels();
    showOverlay(message);
  }

  // --- UI 갱신 ---
  function updatePanels() {
    for (const p of [BLACK, WHITE]) {
      const isActive = p === currentPlayer && !gameOver;
      panels[p].classList.toggle("active", isActive);
      statusEls[p].textContent = gameOver
        ? "-"
        : isActive
        ? `놓을 돌 ${stonesToPlace}개`
        : "대기 중";
    }
  }

  function updateScores() {
    scoreEls[BLACK].textContent = `${scores[BLACK]}승`;
    scoreEls[WHITE].textContent = `${scores[WHITE]}승`;
  }

  function showOverlay(message) {
    overlayTitle.textContent = message;
    overlay.classList.add("show");
  }

  function hideOverlay() {
    overlay.classList.remove("show");
  }

  // --- 타이머 ---
  function startTimer() {
    stopTimer();
    remainingTime = TIMER_SECONDS;
    updateTimerDisplay();
    timerId = setInterval(() => {
      remainingTime -= 1;
      if (remainingTime <= 0) {
        switchPlayer();
        return;
      }
      updateTimerDisplay();
    }, 1000);
  }

  function stopTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function updateTimerDisplay() {
    const ratio = remainingTime / TIMER_SECONDS;
    const activeFill = timerFillEls[currentPlayer];
    const idleFill = timerFillEls[currentPlayer === BLACK ? WHITE : BLACK];

    activeFill.style.width = `${Math.max(0, ratio * 100)}%`;
    activeFill.classList.toggle("bad", ratio <= 0.3);
    activeFill.classList.toggle("warn", ratio > 0.3 && ratio <= 0.6);
    timerTextEls[currentPlayer].textContent = `${remainingTime}s`;

    idleFill.style.width = "100%";
    idleFill.classList.remove("warn", "bad");
    timerTextEls[currentPlayer === BLACK ? WHITE : BLACK].textContent = `${TIMER_SECONDS}s`;
  }

  // --- 게임 리셋 ---
  function resetGame() {
    stopTimer();
    initBoardArray();
    currentPlayer = BLACK;
    stonesToPlace = 1;
    lastMoves = [];
    gameOver = false;
    hoverCell = null;
    hideOverlay();
    updatePanels();
    render();
    startTimer();
  }

  // --- 이벤트 바인딩 ---
  canvas.addEventListener("mousemove", handleMove);
  canvas.addEventListener("mouseleave", handleLeave);
  canvas.addEventListener("click", handleClick);
  canvas.addEventListener("touchstart", (e) => { e.preventDefault(); handleMove(e); }, { passive: false });
  canvas.addEventListener("touchend", (e) => { e.preventDefault(); handleClick(e); }, { passive: false });

  resetBtn.addEventListener("click", resetGame);
  overlayRestart.addEventListener("click", resetGame);

  window.addEventListener("resize", resizeCanvas);

  // --- 시작 ---
  initBoardArray();
  resizeCanvas();
  updateScores();
  resetGame();
})();
