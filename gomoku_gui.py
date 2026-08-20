# -*- coding: utf-8 -*-
import tkinter as tk
from tkinter import messagebox

# --- 게임 설정 (Constants) ---
BOARD_SIZE = 19
WIN_CONDITION = 6

# [수정됨] 창 크기를 줄이기 위해 셀 크기와 여백을 조절했습니다.
CELL_SIZE = 30         # 기존 35 -> 30으로 축소
BOARD_PADDING = 20     # 기존 30 -> 20으로 축소

BOARD_PIXEL_SIZE = BOARD_SIZE * CELL_SIZE + (BOARD_PADDING * 2)
TIMER_SECONDS = 30

# --- 색상 테마 ---
COLOR_BG = "#E3C588"   # 나무 질감 색상
COLOR_LINE = "#5B4025" # 진한 갈색 라인
COLOR_BLACK = "black"
COLOR_WHITE = "white"

# UI 색상
COLOR_ACTIVE_BG = "#d4edda"   # 활성화된 턴 배경 (연한 초록)
COLOR_INACTIVE_BG = "#f0f0f0" # 비활성 배경 (회색)
COLOR_TEXT_ACTIVE = "#155724" 
COLOR_TEXT_INACTIVE = "#888888"

# --- 플레이어 정의 ---
EMPTY_SLOT = 0
PLAYER_BLACK = 1
PLAYER_WHITE = 2

class GomokuGUI:
    def __init__(self, root):
        self.root = root
        self.root.title(f"Connect {WIN_CONDITION} (6-Mok) - 2 Player")
        self.root.resizable(False, False)

        # 게임 상태 변수
        self.black_score = 0
        self.white_score = 0
        self.timer_id = None
        self.last_moves = []
        
        self.create_widgets()
        self.reset_game()
        
        # [추가됨] 창을 화면 중앙에 배치
        self.center_window()

    def center_window(self):
        """창을 화면 정중앙에 배치하는 함수"""
        self.root.update_idletasks() # 창 크기 계산을 위해 대기
        width = self.root.winfo_width()
        height = self.root.winfo_height()
        x = (self.root.winfo_screenwidth() // 2) - (width // 2)
        y = (self.root.winfo_screenheight() // 2) - (height // 2)
        # 상단바 등을 고려해 조금 더 위로 올림 (y - 50)
        self.root.geometry(f'{width}x{height}+{x}+{max(0, y-50)}')

    def create_widgets(self):
        """UI 컴포넌트 생성"""
        # 상단 전체 프레임
        self.top_frame = tk.Frame(self.root, bg="#cccccc", pady=2)
        self.top_frame.pack(fill=tk.X)

        # === 흑(Black) 플레이어 패널 ===
        self.frame_black = tk.Frame(self.top_frame, bg=COLOR_INACTIVE_BG, pady=5, padx=10, relief="flat", bd=2)
        self.frame_black.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 1))
        
        self.lbl_black_name = tk.Label(self.frame_black, text="● BLACK", font=("Arial", 12, "bold"), bg=COLOR_INACTIVE_BG)
        self.lbl_black_name.pack()
        self.lbl_black_score = tk.Label(self.frame_black, text="Score: 0", font=("Arial", 9), bg=COLOR_INACTIVE_BG)
        self.lbl_black_score.pack()
        self.lbl_black_stones = tk.Label(self.frame_black, text="Ready", font=("Arial", 10, "bold"), bg=COLOR_INACTIVE_BG, fg="blue")
        self.lbl_black_stones.pack(pady=2)
        
        # 흑 타이머바
        self.cv_black_timer = tk.Canvas(self.frame_black, width=120, height=8, bg="white", highlightthickness=0)
        self.cv_black_timer.pack(pady=2)
        self.bar_black = self.cv_black_timer.create_rectangle(0, 0, 120, 8, fill="#4CAF50", width=0)
        self.lbl_black_time = tk.Label(self.frame_black, text=f"{TIMER_SECONDS}s", font=("Arial", 9), bg=COLOR_INACTIVE_BG)
        self.lbl_black_time.pack()

        # === 백(White) 플레이어 패널 ===
        self.frame_white = tk.Frame(self.top_frame, bg=COLOR_INACTIVE_BG, pady=5, padx=10, relief="flat", bd=2)
        self.frame_white.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=(1, 0))
        
        self.lbl_white_name = tk.Label(self.frame_white, text="○ WHITE", font=("Arial", 12, "bold"), bg=COLOR_INACTIVE_BG)
        self.lbl_white_name.pack()
        self.lbl_white_score = tk.Label(self.frame_white, text="Score: 0", font=("Arial", 9), bg=COLOR_INACTIVE_BG)
        self.lbl_white_score.pack()
        self.lbl_white_stones = tk.Label(self.frame_white, text="Waiting", font=("Arial", 10, "bold"), bg=COLOR_INACTIVE_BG, fg="#888888")
        self.lbl_white_stones.pack(pady=2)

        # 백 타이머바
        self.cv_white_timer = tk.Canvas(self.frame_white, width=120, height=8, bg="white", highlightthickness=0)
        self.cv_white_timer.pack(pady=2)
        self.bar_white = self.cv_white_timer.create_rectangle(0, 0, 120, 8, fill="#4CAF50", width=0)
        self.lbl_white_time = tk.Label(self.frame_white, text=f"{TIMER_SECONDS}s", font=("Arial", 9), bg=COLOR_INACTIVE_BG)
        self.lbl_white_time.pack()

        # === 게임 보드 ===
        self.canvas = tk.Canvas(self.root, width=BOARD_PIXEL_SIZE, height=BOARD_PIXEL_SIZE, bg=COLOR_BG, highlightthickness=0)
        self.canvas.pack()
        self.canvas.bind("<Button-1>", self.handle_click)
        self.canvas.bind("<Motion>", self.handle_hover)

        # === 컨트롤 프레임 ===
        self.control_frame = tk.Frame(self.root, pady=5)
        self.control_frame.pack()
        self.reset_button = tk.Button(self.control_frame, text="New Game", font=("Arial", 10), command=self.reset_game, padx=15)
        self.reset_button.pack()

    def draw_board(self):
        self.canvas.delete("all")
        # 격자
        for i in range(BOARD_SIZE):
            start = BOARD_PADDING + (CELL_SIZE // 2)
            pos = start + (i * CELL_SIZE)
            end = start + ((BOARD_SIZE - 1) * CELL_SIZE)
            self.canvas.create_line(pos, start, pos, end, fill=COLOR_LINE)
            self.canvas.create_line(start, pos, end, pos, fill=COLOR_LINE)
        # 화점
        if BOARD_SIZE == 19:
            for r in [3, 9, 15]:
                for c in [3, 9, 15]:
                    x = BOARD_PADDING + c * CELL_SIZE + (CELL_SIZE // 2)
                    y = BOARD_PADDING + r * CELL_SIZE + (CELL_SIZE // 2)
                    self.canvas.create_oval(x-3, y-3, x+3, y+3, fill=COLOR_LINE)

    def reset_game(self):
        self.stop_timer()
        self.board = [[EMPTY_SLOT for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        self.current_player = PLAYER_BLACK
        self.stones_to_place = 1
        self.last_moves = []
        self.game_over = False
        
        self.draw_board()
        self.update_ui_state()
        self.start_timer()

    def update_ui_state(self):
        if self.current_player == PLAYER_BLACK:
            self.frame_black.config(bg=COLOR_ACTIVE_BG, relief="solid")
            self.lbl_black_name.config(bg=COLOR_ACTIVE_BG, fg="black")
            self.lbl_black_score.config(bg=COLOR_ACTIVE_BG)
            self.lbl_black_stones.config(text=f"Place {self.stones_to_place}", bg=COLOR_ACTIVE_BG, fg="blue")
            self.lbl_black_time.config(bg=COLOR_ACTIVE_BG, fg="black")
            
            self.frame_white.config(bg=COLOR_INACTIVE_BG, relief="flat")
            self.lbl_white_name.config(bg=COLOR_INACTIVE_BG, fg=COLOR_TEXT_INACTIVE)
            self.lbl_white_score.config(bg=COLOR_INACTIVE_BG)
            self.lbl_white_stones.config(text="Waiting...", bg=COLOR_INACTIVE_BG, fg=COLOR_TEXT_INACTIVE)
            self.lbl_white_time.config(bg=COLOR_INACTIVE_BG, fg=COLOR_TEXT_INACTIVE)
        else:
            self.frame_white.config(bg=COLOR_ACTIVE_BG, relief="solid")
            self.lbl_white_name.config(bg=COLOR_ACTIVE_BG, fg="black")
            self.lbl_white_score.config(bg=COLOR_ACTIVE_BG)
            self.lbl_white_stones.config(text=f"Place {self.stones_to_place}", bg=COLOR_ACTIVE_BG, fg="blue")
            self.lbl_white_time.config(bg=COLOR_ACTIVE_BG, fg="black")

            self.frame_black.config(bg=COLOR_INACTIVE_BG, relief="flat")
            self.lbl_black_name.config(bg=COLOR_INACTIVE_BG, fg=COLOR_TEXT_INACTIVE)
            self.lbl_black_score.config(bg=COLOR_INACTIVE_BG)
            self.lbl_black_stones.config(text="Waiting...", bg=COLOR_INACTIVE_BG, fg=COLOR_TEXT_INACTIVE)
            self.lbl_black_time.config(bg=COLOR_INACTIVE_BG, fg=COLOR_TEXT_INACTIVE)

    def get_grid_coords(self, event_x, event_y):
        x = event_x - BOARD_PADDING
        y = event_y - BOARD_PADDING
        col = x // CELL_SIZE
        row = y // CELL_SIZE
        if 0 <= row < BOARD_SIZE and 0 <= col < BOARD_SIZE:
            return row, col
        return None, None

    def handle_hover(self, event):
        if self.game_over: return
        row, col = self.get_grid_coords(event.x, event.y)
        self.canvas.delete("ghost")
        if row is not None and self.board[row][col] == EMPTY_SLOT:
            x = BOARD_PADDING + col * CELL_SIZE + (CELL_SIZE // 2)
            y = BOARD_PADDING + row * CELL_SIZE + (CELL_SIZE // 2)
            r = (CELL_SIZE // 2) - 4
            color = "black" if self.current_player == PLAYER_BLACK else "white"
            self.canvas.create_oval(x-r, y-r, x+r, y+r, outline=color, width=2, dash=(4, 4), tags="ghost")

    def handle_click(self, event):
        if self.game_over: return
        row, col = self.get_grid_coords(event.x, event.y)
        if row is not None and self.board[row][col] == EMPTY_SLOT:
            self.place_stone(row, col)
            self.handle_hover(event)

    def place_stone(self, row, col):
        self.board[row][col] = self.current_player
        self.stones_to_place -= 1
        
        x = BOARD_PADDING + col * CELL_SIZE + (CELL_SIZE // 2)
        y = BOARD_PADDING + row * CELL_SIZE + (CELL_SIZE // 2)
        r = (CELL_SIZE // 2) - 3
        color = "black" if self.current_player == PLAYER_BLACK else "white"
        self.canvas.create_oval(x-r, y-r, x+r, y+r, fill=color, outline=color)
        
        self.last_moves.append((row, col))
        self.highlight_last_move()

        if self.check_win((row, col)):
            self.game_over = True
            self.stop_timer()
            winner = "Black" if self.current_player == PLAYER_BLACK else "White"
            if self.current_player == PLAYER_BLACK: self.black_score += 1
            else: self.white_score += 1
            self.update_score_labels()
            messagebox.showinfo("Game Over", f"{winner} wins!")
            return

        if self.is_board_full():
            self.game_over = True
            self.stop_timer()
            messagebox.showinfo("Draw", "It's a draw!")
            return

        if self.stones_to_place == 0:
            self.switch_player()
        else:
            self.update_ui_state()

    def highlight_last_move(self):
        self.canvas.delete("last_marker")
        if self.last_moves:
            r, c = self.last_moves[-1]
            x = BOARD_PADDING + c * CELL_SIZE + (CELL_SIZE // 2)
            y = BOARD_PADDING + r * CELL_SIZE + (CELL_SIZE // 2)
            self.canvas.create_oval(x-3, y-3, x+3, y+3, fill="red", outline="", tags="last_marker")

    def switch_player(self):
        self.current_player = PLAYER_WHITE if self.current_player == PLAYER_BLACK else PLAYER_BLACK
        self.stones_to_place = 2
        self.start_timer()
        self.update_ui_state()

    def update_score_labels(self):
        self.lbl_black_score.config(text=f"Score: {self.black_score}")
        self.lbl_white_score.config(text=f"Score: {self.white_score}")

    def check_win(self, last_move):
        row, col = last_move
        stone = self.board[row][col]
        directions = [(0, 1), (1, 0), (1, 1), (1, -1)]
        for dr, dc in directions:
            count = 1
            for i in range(1, WIN_CONDITION):
                r, c = row + dr*i, col + dc*i
                if 0<=r<BOARD_SIZE and 0<=c<BOARD_SIZE and self.board[r][c] == stone: count += 1
                else: break
            for i in range(1, WIN_CONDITION):
                r, c = row - dr*i, col - dc*i
                if 0<=r<BOARD_SIZE and 0<=c<BOARD_SIZE and self.board[r][c] == stone: count += 1
                else: break
            if count >= WIN_CONDITION: return True
        return False

    def is_board_full(self):
        return all(self.board[r][c] != EMPTY_SLOT for r in range(BOARD_SIZE) for c in range(BOARD_SIZE))

    def start_timer(self):
        self.stop_timer()
        self.remaining_time = TIMER_SECONDS
        self.update_timer_display()
        self.countdown()

    def stop_timer(self):
        if self.timer_id:
            self.root.after_cancel(self.timer_id)
            self.timer_id = None

    def countdown(self):
        if self.game_over: return
        if self.remaining_time > 0:
            self.remaining_time -= 1
            self.update_timer_display()
            self.timer_id = self.root.after(1000, self.countdown)
        else:
            self.switch_player()

    def update_timer_display(self):
        ratio = self.remaining_time / TIMER_SECONDS
        width = ratio * 120
        color = "#4CAF50"
        if ratio <= 0.3: color = "#f44336"

        if self.current_player == PLAYER_BLACK:
            self.lbl_black_time.config(text=f"{self.remaining_time}s")
            self.cv_black_timer.coords(self.bar_black, 0, 0, width, 8)
            self.cv_black_timer.itemconfig(self.bar_black, fill=color)
            
            self.lbl_white_time.config(text=f"{TIMER_SECONDS}s")
            self.cv_white_timer.coords(self.bar_white, 0, 0, 120, 8)
            self.cv_white_timer.itemconfig(self.bar_white, fill="#ccc")
        else:
            self.lbl_white_time.config(text=f"{self.remaining_time}s")
            self.cv_white_timer.coords(self.bar_white, 0, 0, width, 8)
            self.cv_white_timer.itemconfig(self.bar_white, fill=color)
            
            self.lbl_black_time.config(text=f"{TIMER_SECONDS}s")
            self.cv_black_timer.coords(self.bar_black, 0, 0, 120, 8)
            self.cv_black_timer.itemconfig(self.bar_black, fill="#ccc")

if __name__ == "__main__":
    root = tk.Tk()
    app = GomokuGUI(root)
    root.mainloop()