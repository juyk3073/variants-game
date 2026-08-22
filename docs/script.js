(() => {
  "use strict";

  // --- Firebase 설정 (온라인 대전용) ---
  const firebaseConfig = {
    apiKey: "AIzaSyDw0p2uhVWe-KSdm9vLjp8b6hxtTpZHX_U",
    authDomain: "online-variant-game.firebaseapp.com",
    databaseURL: "https://online-variant-game-default-rtdb.firebaseio.com",
    projectId: "online-variant-game",
    storageBucket: "online-variant-game.firebasestorage.app",
    messagingSenderId: "257827695949",
    appId: "1:257827695949:web:cf1aeeaf481be832c61b04",
    measurementId: "G-2D7FWZDRQJ"
  };
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  const db = firebase.database();

  // --- 게임 설정 ---
  const BOARD_SIZE = 19;
  const WIN_CONDITION = 6;
  const TIMER_SECONDS = 30;

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

  const modeSelect = document.getElementById("mode-select");
  const gameScreen = document.getElementById("game-screen");
  const btnModeOffline = document.getElementById("btn-mode-offline");
  const btnModeOnline = document.getElementById("btn-mode-online");
  const btnBackMenu = document.getElementById("btn-back-menu");

  const offlineControls = document.getElementById("offline-controls");
  const roomControls = document.getElementById("room-controls");
  const roomStatusWrap = document.getElementById("room-status-wrap");
  const roomStatusText = document.getElementById("room-status-text");
  const btnCreateRoom = document.getElementById("btn-create-room");
  const btnJoinRoom = document.getElementById("btn-join-room");
  const roomCodeInput = document.getElementById("room-code-input");

  const labelBlack = document.getElementById("label-black");
  const labelWhite = document.getElementById("label-white");

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

  // --- 공용 상태 ---
  let mode = null; // 'offline' | 'online'
  let cssSize = 0;
  let padding = 0;
  let cellSize = 0;

  let board = [];
  let currentPlayer = BLACK;
  let stonesToPlace = 1;
  let lastMoves = [];
  let gameOver = false;
  let hoverCell = null;

  // 오프라인 전용 상태
  let scores = { [BLACK]: 0, [WHITE]: 0 };
  let remainingTime = TIMER_SECONDS;
  let timerId = null;

  // 온라인 전용 상태
  let currentRoomId = null;
  let myRole = null; // BLACK(방장) 또는 WHITE(참여자)
  let roomRef = null;
  let turnStartedAt = null; // 현재 턴이 시작된 서버 시각(ms) - 양쪽 클라이언트가 동일한 값을 봄
  let roomStatus = null; // 'waiting' | 'playing' - 상대가 들어오기 전에는 착수를 막기 위한 상태

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

    padding = cssSize * 0.03 + (cssSize / (BOARD_SIZE - 1)) * 0.5;
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

  function drawStone(row, col, player) {
    const { x, y } = cellCenter(row, col);
    const r = cellSize * 0.42;

    ctx.save();
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

  function canHover() {
    if (!mode || gameOver || !hoverCell) return false;
    if (board[hoverCell.row][hoverCell.col] !== EMPTY) return false;
    if (mode === "online") return roomStatus === "playing" && currentPlayer === myRole;
    return true;
  }

  function drawHoverGhost() {
    if (!canHover()) return;
    const { row, col } = hoverCell;
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
    if (!mode || gameOver) return;
    const { x, y } = eventToBoardXY(evt);
    hoverCell = pointToCell(x, y);
    render();
  }

  function handleLeave() {
    hoverCell = null;
    render();
  }

  function handleClick(evt) {
    if (!mode || gameOver) return;
    const { x, y } = eventToBoardXY(evt);
    const cell = pointToCell(x, y);
    if (!cell) return;
    const { row, col } = cell;
    if (board[row][col] !== EMPTY) return;

    if (mode === "offline") {
      placeStoneOffline(row, col);
    } else {
      placeStoneOnline(row, col);
    }
  }

  // --- 공용 게임 로직 ---
  function playerLabel(p) {
    return p === BLACK ? "흑돌" : "백돌";
  }

  function checkWin(row, col) {
    // 정확히 6개가 연속될 때만 승리 (7개 이상 이어진 "장목"은 승리로 인정하지 않음)
    const stone = board[row][col];
    const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (const [dr, dc] of dirs) {
      let count = 1;
      for (let i = 1; ; i++) {
        const r = row + dr * i, c = col + dc * i;
        if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === stone) count++;
        else break;
      }
      for (let i = 1; ; i++) {
        const r = row - dr * i, c = col - dc * i;
        if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === stone) count++;
        else break;
      }
      if (count === WIN_CONDITION) return true;
    }
    return false;
  }

  function isBoardFull() {
    return board.every((row) => row.every((v) => v !== EMPTY));
  }

  function updatePanels() {
    for (const p of [BLACK, WHITE]) {
      const isActive = p === currentPlayer && !gameOver && (mode !== "online" || roomStatus === "playing");
      panels[p].classList.toggle("active", isActive);
      statusEls[p].textContent = gameOver
        ? "-"
        : isActive
        ? `놓을 돌 ${stonesToPlace}개`
        : "대기 중";
    }
  }

  // ============ 오프라인 모드 ============
  function placeStoneOffline(row, col) {
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
      switchPlayerOffline();
    } else {
      updatePanels();
    }
  }

  function switchPlayerOffline() {
    currentPlayer = currentPlayer === BLACK ? WHITE : BLACK;
    stonesToPlace = 2;
    updatePanels();
    startTimer(switchPlayerOffline);
  }

  // 오프라인/온라인 공용: 승패 처리 (점수판·타이머 UI가 두 모드에서 항상 동일하게 동작)
  function finishGame(message, winner) {
    gameOver = true;
    stopTimer();
    if (winner) scores[winner] += 1;
    updateScores();
    updatePanels();
    overlayTitle.textContent = message;
    overlay.classList.add("show");
  }

  function updateScores() {
    scoreEls[BLACK].textContent = `${scores[BLACK]}승`;
    scoreEls[WHITE].textContent = `${scores[WHITE]}승`;
  }

  function resetScores() {
    scores = { [BLACK]: 0, [WHITE]: 0 };
    updateScores();
  }

  // onExpire: 시간 초과 시 실행할 콜백. 오프라인은 자동으로 턴을 넘기고,
  // 온라인은 서버(Firebase) 권한이 없어 강제로 턴을 넘기지 않고 0에서 멈춘다.
  function startTimer(onExpire) {
    stopTimer();
    remainingTime = TIMER_SECONDS;
    updateTimerDisplay();
    timerId = setInterval(() => {
      remainingTime -= 1;
      if (remainingTime <= 0) {
        updateTimerDisplay();
        stopTimer();
        if (onExpire) onExpire();
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

  // 온라인 전용: 두 클라이언트가 같은 turnStartedAt(서버 시각) 기준으로 남은 시간을 계산해
  // 타이머가 정확히 동기화되도록 한다 (오프라인의 startTimer처럼 로컬에서 1초씩 깎지 않음).
  function startOnlineTimer() {
    stopTimer();
    updateOnlineTimerTick();
    timerId = setInterval(updateOnlineTimerTick, 1000);
  }

  function updateOnlineTimerTick() {
    if (!turnStartedAt) return;
    const elapsed = Math.floor((Date.now() - turnStartedAt) / 1000);
    remainingTime = Math.max(0, TIMER_SECONDS - elapsed);
    updateTimerDisplay();
    if (remainingTime <= 0) {
      stopTimer();
      maybeSkipTimedOutTurn();
    }
  }

  // 시간 초과된 턴을 넘긴다. 서버 권한 로직이 없으므로, 상대의 턴이 끝나기를
  // "기다리는 쪽" 클라이언트가 대신 턴을 넘긴다 (매 순간 정확히 한쪽만 기다리는
  // 입장이므로 두 클라이언트가 동시에 턴을 넘기는 경합은 생기지 않는다).
  function maybeSkipTimedOutTurn() {
    if (!currentRoomId || gameOver || myRole === currentPlayer) return;
    const timedOutPlayer = currentPlayer;
    const nextPlayer = timedOutPlayer === BLACK ? WHITE : BLACK;
    roomRef.update({
      currentPlayer: nextPlayer,
      stonesToPlace: 2,
      turnStartedAt: firebase.database.ServerValue.TIMESTAMP,
    });
  }

  function resetOfflineGame() {
    stopTimer();
    initBoardArray();
    currentPlayer = BLACK;
    stonesToPlace = 1;
    lastMoves = [];
    gameOver = false;
    hoverCell = null;
    overlay.classList.remove("show");
    labelBlack.textContent = "흑돌";
    labelWhite.textContent = "백돌";
    updatePanels();
    render();
    startTimer(switchPlayerOffline);
  }

  // ============ 온라인 모드 ============
  function detachRoom() {
    if (roomRef) roomRef.off();
    roomRef = null;
    currentRoomId = null;
    myRole = null;
    roomStatus = null;
  }

  function placeStoneOnline(row, col) {
    if (roomStatus !== "playing" || currentPlayer !== myRole) return;

    const nextStones = stonesToPlace - 1;
    let nextPlayer = currentPlayer;
    let newStonesToPlace = nextStones;

    const update = {
      lastMove: { row, col, player: myRole },
    };

    if (nextStones === 0) {
      nextPlayer = currentPlayer === BLACK ? WHITE : BLACK;
      newStonesToPlace = 2;
      update.turnStartedAt = firebase.database.ServerValue.TIMESTAMP; // 턴이 끝날 때만 시계 초기화
    }

    update.currentPlayer = nextPlayer;
    update.stonesToPlace = newStonesToPlace;
    roomRef.update(update);
  }

  function createRoom() {
    detachRoom();
    const roomId = Math.random().toString(36).substring(2, 7).toUpperCase();
    currentRoomId = roomId;
    myRole = BLACK;
    roomStatus = "waiting";

    roomRef = db.ref("rooms/" + roomId);
    roomRef.set({
      createdAt: Date.now(),
      status: "waiting",
      currentPlayer: BLACK,
      stonesToPlace: 1,
      lastMove: null,
      turnStartedAt: firebase.database.ServerValue.TIMESTAMP,
    });

    listenToRoom();
    roomStatusText.textContent = `방 코드: [ ${roomId} ] 상대방에게 코드를 공유하세요!`;
    labelBlack.textContent = "흑돌 (나)";
    labelWhite.textContent = "백돌 (상대)";
    overlayRestart.textContent = "새 방 만들기";
    initOnlineGame();
  }

  function joinRoom() {
    const code = roomCodeInput.value.trim().toUpperCase();
    if (!code) {
      alert("방 코드를 입력하세요.");
      return;
    }

    detachRoom();
    currentRoomId = code;
    myRole = WHITE;
    roomRef = db.ref("rooms/" + code);

    roomRef.once("value", (snapshot) => {
      if (!snapshot.exists()) {
        alert("존재하지 않는 방 번호입니다.");
        detachRoom();
        return;
      }
      roomRef.update({ status: "playing" });
      roomStatus = "playing";
      listenToRoom();
      roomStatusText.textContent = `[ ${code} ] 방에 입장했습니다! 게임을 시작합니다.`;
      labelBlack.textContent = "흑돌 (상대)";
      labelWhite.textContent = "백돌 (나)";
      overlayRestart.textContent = "새 방 만들기";
      initOnlineGame();
    });
  }

  function listenToRoom() {
    roomRef.on("value", (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      const justStarted = roomStatus !== "playing" && data.status === "playing";
      roomStatus = data.status;

      if (justStarted && myRole === BLACK) {
        roomStatusText.textContent = `상대방이 입장했습니다! (방 코드: ${currentRoomId})`;
      }

      if (data.lastMove) {
        const { row, col, player } = data.lastMove;
        if (board[row][col] === EMPTY) {
          board[row][col] = player;
          lastMoves.push({ row, col });
          render();

          if (checkWin(row, col)) {
            finishGame(player === myRole ? "승리하셨습니다! 🎉" : "패배하였습니다 😭", player);
            return;
          }
          if (isBoardFull()) {
            finishGame("무승부입니다", null);
            return;
          }
        }
      }

      currentPlayer = data.currentPlayer;
      stonesToPlace = data.stonesToPlace;
      turnStartedAt = data.turnStartedAt || Date.now();

      if (roomStatus === "playing") {
        startOnlineTimer();
      } else {
        stopTimer();
        remainingTime = TIMER_SECONDS;
        updateTimerDisplay();
      }

      updatePanels();
      render();
    });
  }

  function initOnlineGame() {
    initBoardArray();
    lastMoves = [];
    gameOver = false;
    hoverCell = null;
    currentPlayer = BLACK;
    stonesToPlace = 1;
    turnStartedAt = null;
    stopTimer();
    overlay.classList.remove("show");
    updatePanels();
    render();
  }

  // ============ 모드 전환 ============
  function enterOffline() {
    mode = "offline";
    modeSelect.style.display = "none";
    gameScreen.style.display = "";
    roomControls.style.display = "none";
    roomStatusWrap.style.display = "none";
    offlineControls.style.display = "";
    resetScores();
    overlayRestart.textContent = "다시하기";
    resizeCanvas();
    resetOfflineGame();
  }

  function enterOnline() {
    mode = "online";
    modeSelect.style.display = "none";
    gameScreen.style.display = "";
    roomControls.style.display = "";
    roomStatusWrap.style.display = "";
    offlineControls.style.display = "none";
    resetScores();

    detachRoom();
    labelBlack.textContent = "흑돌";
    labelWhite.textContent = "백돌";
    roomStatusText.textContent = "방을 만들거나 상대방의 코드를 입력하세요.";
    roomCodeInput.value = "";
    overlayRestart.textContent = "새 방 만들기";

    initBoardArray();
    lastMoves = [];
    gameOver = false;
    hoverCell = null;
    currentPlayer = BLACK;
    stonesToPlace = 1;
    turnStartedAt = null;
    stopTimer();
    overlay.classList.remove("show");
    updatePanels();
    resizeCanvas();
  }

  function backToMenu() {
    stopTimer();
    detachRoom();
    mode = null;
    overlay.classList.remove("show");
    gameScreen.style.display = "none";
    modeSelect.style.display = "";
  }

  // --- 이벤트 바인딩 ---
  canvas.addEventListener("mousemove", handleMove);
  canvas.addEventListener("mouseleave", handleLeave);
  canvas.addEventListener("click", handleClick);
  canvas.addEventListener("touchstart", (e) => { e.preventDefault(); handleMove(e); }, { passive: false });
  canvas.addEventListener("touchend", (e) => { e.preventDefault(); handleClick(e); }, { passive: false });

  resetBtn.addEventListener("click", resetOfflineGame);
  overlayRestart.addEventListener("click", () => {
    overlay.classList.remove("show");
    if (mode === "offline") resetOfflineGame();
    else if (mode === "online") createRoom();
  });

  btnModeOffline.addEventListener("click", enterOffline);
  btnModeOnline.addEventListener("click", enterOnline);
  btnBackMenu.addEventListener("click", backToMenu);
  btnCreateRoom.addEventListener("click", createRoom);
  btnJoinRoom.addEventListener("click", joinRoom);

  window.addEventListener("resize", () => { if (mode) resizeCanvas(); });

  // --- 시작 ---
  initBoardArray();
  updateScores();
})();
