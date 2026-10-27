import React, { useState, useEffect, useRef, useMemo } from "react";

// ==========================================================
// 1. HỆ THỐNG ÂM THANH (WEB AUDIO API) - tiếng trống, tên, sóng nước
// ==========================================================
const AudioSys = {
  ctx: null as AudioContext | null,
  masterGain: null as GainNode | null,
  ambientOn: false as boolean,
  muted: false as boolean,
  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.masterGain.gain.value = this.muted ? 0 : 0.5;
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  },
  toggleMute(): boolean {
    this.init();
    this.muted = !this.muted;
    if (this.masterGain) this.masterGain.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  },
  startAmbient() {
    this.init();
    if (!this.ctx || !this.masterGain || this.ambientOn) return;
    const len = this.ctx.sampleRate * 3;
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 520;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.16;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start();
    this.ambientOn = true;
  },
  playDrum(vol = 1) {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.type = "triangle";
    osc.frequency.setValueAtTime(100, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.25);
    gain.gain.setValueAtTime(0.75 * vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);
    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + 0.25);
  },
  playArrow(vol = 1) {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.type = "sine";
    osc.frequency.setValueAtTime(700, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.3 * vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + 0.15);
  },
  noiseBurst(duration: number, freq: number, type: BiquadFilterType, vol: number) {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    const gain = this.ctx.createGain();
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    noise.start(this.ctx.currentTime);
  },
  playCrash() {
    this.noiseBurst(0.45, 600, "lowpass", 0.9);
  },
  playHit() {
    this.noiseBurst(0.25, 320, "lowpass", 0.8);
    this.playDrum(0.6);
  },
  playSplash() {
    this.noiseBurst(0.2, 900, "highpass", 0.18);
  },
  playTone(freq: number, type: OscillatorType, duration: number) {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + duration);
  }
};

// ==========================================================
// 2. KHAI BÁO KIỂU DỮ LIỆU
// ==========================================================
type Lang = "vi" | "en";
type GamePhase = "language" | "menu" | "gameplay" | "victory" | "defeat";
type EnemyShipClass = "scout" | "warship" | "flagship";

interface Stake {
  id: number;
  x: number;
  y: number;
}

interface EnemyShip {
  id: number;
  x: number;
  y: number;
  angle: number;
  shipClass: EnemyShipClass;
  hp: number;
  maxHp: number;
  speed: number;
  impaled: boolean;
  lastDamageTick: number;
  lastShot: number;
  flash: number;
  burning: number;
  burnTick: number;
  dying: number;
}

interface Projectile {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: "arrow" | "firepot" | "enemyArrow";
  dmg: number;
  life: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  decay: number;
  color: string;
  type: "wake" | "fire" | "smoke" | "spark" | "shockwave" | "bubble" | "debris" | "splash" | "ember";
}

interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  size: number;
}

interface QuizOption {
  text_vi: string;
  text_en: string;
  isCorrect: boolean;
}

interface QuizStation {
  id: string;
  x: number;
  y: number;
  title_vi: string;
  title_en: string;
  question_vi: string;
  question_en: string;
  options: QuizOption[];
  explanation_vi: string;
  explanation_en: string;
  cleared: boolean;
}

// ==========================================================
// 3. THÔNG SỐ VÀ DỮ LIỆU LỊCH SỬ NĂM 938
// ==========================================================
const WORLD_WIDTH = 4400;
const STAKE_ZONE_START = 1800;
const STAKE_ZONE_END = 3600;
const TARGET_KILLS = 10; // Tiêu diệt hạm đội Lưu Hoằng Tháo
const QUIZ_TRIGGER_RANGE = 130; // Cách đài bao xa thì tự bật câu hỏi
const QUIZ_WALL_OFFSET = 70; // Tường vô hình nằm sau đài bao nhiêu px
const ARROW_CD = 230;
const RAFT_CD = 2300;

const UI_FONT = "'Be Vietnam Pro', 'Segoe UI', Roboto, sans-serif";
const TITLE_FONT = "'Cormorant Garamond', 'Times New Roman', serif";

const ENEMY_STATS: Record<
  EnemyShipClass,
  { hp: number; speed: number; scale: number; ram: number; shootCd: number; dmg: number; volley: number; turn: number; keep: number; name_vi: string; name_en: string }
> = {
  scout: { hp: 7, speed: 3.3, scale: 0.9, ram: 10, shootCd: 0, dmg: 0, volley: 0, turn: 0.07, keep: 0, name_vi: "THUYỀN TIÊN PHONG", name_en: "VANGUARD SKIFF" },
  warship: { hp: 14, speed: 2.4, scale: 1.2, ram: 14, shootCd: 2300, dmg: 4, volley: 1, turn: 0.045, keep: 300, name_vi: "THUYỀN CHIẾN NAM HÁN", name_en: "SOUTHERN HAN WARSHIP" },
  flagship: { hp: 28, speed: 1.8, scale: 1.65, ram: 20, shootCd: 2900, dmg: 5, volley: 3, turn: 0.028, keep: 360, name_vi: "SOÁI HẠM LƯU HOẰNG THÁO", name_en: "FLAGSHIP OF LUU HOANG THAO" }
};

const INITIAL_STAKES: Stake[] = Array.from({ length: 54 }).map((_, i) => ({
  id: i,
  x: STAKE_ZONE_START + (i % 13) * 135 + (i % 2 === 0 ? 20 : -25),
  y: 120 + Math.floor(i / 13) * 120 + ((i * 37) % 50)
}));

const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const angleDiff = (a: number, b: number) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};
const getZoom = () => clamp(Math.min(window.innerWidth / 960, window.innerHeight / 560), 0.55, 1);
let UI_BOOST = 1; // phóng chữ trên canvas khi màn hình nhỏ (điện thoại)
const tr = (lang: Lang, vi: string, en: string) => (lang === "vi" ? vi : en);
const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Cảnh quan hai bên bờ sông
const TREES = Array.from({ length: 130 })
  .map((_, i) => ({
    x: i * 35 + hash(i) * 28,
    top: i % 2 === 0,
    r: 15 + hash(i + 7) * 15,
    depth: hash(i + 3),
    tone: hash(i + 11),
    phase: hash(i + 5) * 6.28
  }))
  .sort((a, b) => a.depth - b.depth);

const REEDS = Array.from({ length: 190 }).map((_, i) => ({
  x: i * 24 + hash(i + 21) * 20,
  top: hash(i + 2) > 0.5,
  len: 9 + hash(i + 9) * 11,
  phase: hash(i + 17) * 6.28
}));

const CAMPS = [
  { x: 620, top: true },
  { x: 1500, top: false },
  { x: 2060, top: true },
  { x: 2900, top: false },
  { x: 3500, top: true }
];

const PHASES = [
  { vi: "Giai đoạn 1: Chuẩn bị chiến trường", en: "Phase 1: Battlefield Preparation" },
  { vi: "Giai đoạn 2: Trận địa cọc ngầm", en: "Phase 2: Underwater Stake Trap" },
  { vi: "Giai đoạn 3: Tổng phản công", en: "Phase 3: Counter-offensive" },
  { vi: "Giai đoạn 4: Ý nghĩa lịch sử", en: "Phase 4: Historical Legacy" }
];
const opt = (vi: string, en: string, isCorrect = false): QuizOption => ({ text_vi: vi, text_en: en, isCorrect });
const mkQuiz = (n: number, x: number, y: number, phase: number, qvi: string, qen: string, options: QuizOption[], evi: string, een: string): QuizStation => ({
  id: `q${n}`,
  x,
  y,
  title_vi: PHASES[phase].vi,
  title_en: PHASES[phase].en,
  question_vi: qvi,
  question_en: qen,
  options,
  explanation_vi: evi,
  explanation_en: een,
  cleared: false
});

const INITIAL_QUIZZES: QuizStation[] = [
  mkQuiz(1, 650, 300, 0,
    "Năm 931, ai đã đánh đuổi quân Nam Hán, chiếm lại thành Tống Bình và giành quyền tự chủ cho nước ta?",
    "In 931, who drove out the Southern Han army, retook Tong Binh citadel and regained self-rule?",
    [opt("Dương Đình Nghệ", "Duong Dinh Nghe", true), opt("Đinh Bộ Lĩnh", "Dinh Bo Linh"), opt("Lý Bí", "Ly Bi")],
    "Dương Đình Nghệ nổi dậy, đánh bại quân Nam Hán năm 931 và tự xưng Tiết độ sứ. Ngô Quyền vừa là tướng giỏi vừa là con rể của ông.",
    "Duong Dinh Nghe defeated the Southern Han in 931 and declared himself governor. Ngo Quyen was both his top general and son-in-law."),
  mkQuiz(2, 980, 420, 0,
    "Năm 937, ai là kẻ đã sát hại Dương Đình Nghệ và cầu cứu quân Nam Hán, tạo cớ cho Ngô Quyền kéo quân ra Bắc trị tội?",
    "In 937, who assassinated Duong Dinh Nghe and sought help from Southern Han, prompting Ngo Quyen to march north?",
    [opt("Kiều Công Tiễn", "Kieu Cong Tien", true), opt("Lê Hoàn", "Le Hoan"), opt("Trần Hưng Đạo", "Tran Hung Dao")],
    "Kiều Công Tiễn phản bội, sát hại Dương Đình Nghệ để đoạt chức Tiết độ sứ và cầu cứu nhà Nam Hán. Ngô Quyền đã nhanh chóng ra Bắc tiêu diệt hắn trước khi đại quân giặc tới.",
    "Kieu Cong Tien betrayed Duong Dinh Nghe and sought Southern Han aid. Ngo Quyen marched north and eliminated him."),
  mkQuiz(3, 1310, 250, 0,
    "Ngô Quyền sinh ra ở vùng đất nào?",
    "Where was Ngo Quyen born?",
    [opt("Đường Lâm (nay thuộc Sơn Tây, Hà Nội)", "Duong Lam (now Son Tay, Hanoi)", true), opt("Hoa Lư (Ninh Bình)", "Hoa Lu (Ninh Binh)"), opt("Cổ Loa (Đông Anh)", "Co Loa (Dong Anh)")],
    "Ngô Quyền là người Đường Lâm, một vùng đất giàu truyền thống của xứ Đoài, nơi sau này còn sinh ra vua Phùng Hưng.",
    "Ngo Quyen came from Duong Lam, a land rich in tradition west of Hanoi, which also gave rise to the hero Phung Hung."),
  mkQuiz(4, 1680, 400, 1,
    "Loại vũ khí đặc biệt nào được Ngô Quyền cho quân dân bố trí dưới lòng sông Bạch Đằng để tiêu diệt thuyền chiến địch?",
    "What special weapon did Ngo Quyen have his people deploy in the Bach Dang River to destroy enemy warships?",
    [opt("Hàng vạn cọc gỗ nhọn, đầu bịt sắt đóng ngầm dưới sông", "Tens of thousands of iron-tipped wooden stakes embedded covertly", true), opt("Xích sắt giăng ngang cửa sông", "Iron chains blocking the river mouth"), opt("Lưới lửa bằng đạn đá", "Fire nets using stone ammunition")],
    "Ngô Quyền cho quân dân đẽo cọc gỗ nhọn, bịt sắt và đóng ngầm. Khi thủy triều lên, cọc bị che lấp; khi thủy triều xuống, cọc đâm thủng thuyền giặc.",
    "Ngo Quyen had sharp iron-capped wooden stakes hidden under water. At high tide they were hidden; at low tide they impaled enemy ships."),
  mkQuiz(5, 2030, 270, 1,
    "Ngô Quyền chọn thời điểm nào để quyết chiến với thuyền địch trên sông Bạch Đằng?",
    "When did Ngo Quyen choose to fight the decisive battle against the enemy fleet on the Bach Dang River?",
    [opt("Khi thủy triều rút xuống, cọc nhọn lộ ra", "When the tide receded and the stakes were exposed", true), opt("Lúc thủy triều dâng cao nhất", "At the peak of high tide"), opt("Vào ban đêm khi trời mưa bão", "At night during a storm")],
    "Ông tính đúng quy luật thủy triều của sông Bạch Đằng: khi nước rút, thuyền giặc mắc vào bãi cọc, không thể quay đầu.",
    "He read the tides of the Bach Dang precisely: when the water fell, enemy ships were trapped on the stakes and could not turn back."),
  mkQuiz(6, 2380, 430, 1,
    "Ngô Quyền dùng kế gì để nhử thuyền địch vào trận địa cọc ngầm?",
    "What trick did Ngo Quyen use to lure the enemy fleet into the hidden stake field?",
    [opt("Cho thuyền nhẹ ra khiêu chiến rồi giả thua, rút lui qua bãi cọc lúc nước lên", "Light boats provoked the enemy, then feigned retreat across the stakes at high tide", true), opt("Cho toàn bộ chiến thuyền dàn trận đối đầu trực diện ngoài cửa biển", "The whole fleet fought head-on at the sea mouth"), opt("Đốt cháy toàn bộ thuyền địch từ xa bằng hỏa tiễn", "Burning every enemy ship from afar with fire arrows")],
    "Đoàn thuyền nhẹ khiêu chiến rồi giả thua rút lui. Lưu Hoằng Tháo chủ quan thúc quân đuổi theo, vượt qua bãi cọc ngầm khi nước còn đang lên.",
    "Light boats provoked the enemy then pretended to flee. Luu Hoang Thao recklessly pursued, crossing the hidden stakes while the tide was still rising."),
  mkQuiz(7, 2730, 280, 2,
    "Vị tướng chỉ huy đoàn thuyền chiến Nam Hán tiến vào sông Bạch Đằng và đã tử trận trong trận đánh năm 938 là ai?",
    "Who was the commander of the Southern Han fleet who entered the Bach Dang River and perished in 938?",
    [opt("Lưu Hoằng Tháo", "Luu Hoang Thao", true), opt("Ô Mã Nhi", "O Ma Nhi"), opt("Tích Lệ Cơ", "Tich Le Co")],
    "Lưu Hoằng Tháo chủ quan thúc quân đuổi theo thuyền khiêu chiến của ta khi nước lên, để rồi bị mắc kẹt khi thủy triều rút và tử trận dưới làn mưa tên giáo.",
    "Luu Hoang Thao arrogantly pursued our bait boats at high tide, only to get trapped and killed during low tide."),
  mkQuiz(8, 3080, 410, 2,
    "Sau chiến thắng, năm 939 Ngô Quyền đã làm gì để khẳng định nền độc lập?",
    "After the victory, what did Ngo Quyen do in 939 to affirm independence?",
    [opt("Xưng vương, đóng đô ở Cổ Loa", "Proclaimed himself king and set his capital at Co Loa", true), opt("Xưng đế, đóng đô ở Thăng Long", "Proclaimed himself emperor with the capital at Thang Long"), opt("Xin thần phục triều đình Nam Hán", "Submitted to the Southern Han court")],
    "Năm 939 Ngô Quyền xưng vương, đóng đô ở Cổ Loa, dựng nên chính quyền độc lập sau nhiều thế kỷ bị đô hộ.",
    "In 939 Ngo Quyen proclaimed himself king and made Co Loa his capital, founding an independent state after centuries of foreign rule."),
  mkQuiz(9, 3430, 300, 3,
    "Chiến thắng Bạch Đằng năm 938 có ý nghĩa lịch sử to lớn nào?",
    "What was the great historical significance of the 938 Bach Dang victory?",
    [opt("Chấm dứt hơn một nghìn năm Bắc thuộc, mở ra thời kỳ độc lập tự chủ lâu dài", "Ended over a thousand years of Chinese domination and opened an era of lasting independence", true), opt("Mở đầu thời kỳ Bắc thuộc lần thứ nhất", "Began the first period of Chinese domination"), opt("Kết thúc cuộc chiến giữa nước ta và nhà Tống", "Ended the war between Vietnam and the Song dynasty")],
    "Chiến thắng năm 938 đã chấm dứt hơn một nghìn năm Bắc thuộc, mở ra thời kỳ độc lập, tự chủ lâu dài của dân tộc.",
    "The 938 victory ended more than a thousand years of Chinese rule and began a long era of independence."),
  mkQuiz(10, 3780, 420, 3,
    "Năm 1288, vị anh hùng nào đã tiếp tục dùng kế đóng cọc ngầm trên sông Bạch Đằng để đánh tan thủy quân Nguyên - Mông?",
    "In 1288, which hero reused the hidden-stake strategy on the Bach Dang River to crush the Mongol-Yuan navy?",
    [opt("Trần Hưng Đạo", "Tran Hung Dao", true), opt("Lý Thường Kiệt", "Ly Thuong Kiet"), opt("Lê Lợi", "Le Loi")],
    "Trần Hưng Đạo kế thừa nghệ thuật dùng thủy triều và cọc ngầm của Ngô Quyền, đánh tan thủy quân Nguyên - Mông năm 1288.",
    "Tran Hung Dao inherited Ngo Quyen's art of using tides and hidden stakes to destroy the Mongol-Yuan fleet in 1288.")
];

// ==========================================================
// 4. TRẠNG THÁI GAME (lưu trong ref, không gây re-render)
// ==========================================================
function makeState(h: number) {
  return {
    x: 250,
    y: h / 2,
    vx: 0,
    vy: 0,
    facingLeft: false,
    isMoving: false,
    hp: 100,
    invuln: 0,
    flash: 0,
    shake: 0,
    kills: 0,
    tide: 100,
    tideDir: -0.05,
    tint: 0,
    cameraX: 0,
    keys: {} as Record<string, boolean>,
    enemies: [] as EnemyShip[],
    projectiles: [] as Projectile[],
    particles: [] as Particle[],
    floatingTexts: [] as FloatingText[],
    quizzes: INITIAL_QUIZZES.map(q => ({ ...q, cleared: false })) as QuizStation[],
    lastSpawn: 0,
    lastShot: 0,
    lastRaft: -99999,
    lastWallMsg: 0,
    lastBeat: 0,
    lastRipple: 0,
    isPaused: false,
    hud: false,
    zoom: 1,
    miniTop: false
  };
}
type GameState = ReturnType<typeof makeState>;

// ==========================================================
// 5. HÀM TIỆN ÍCH: HẠT, CHỮ NỔI, SÁT THƯƠNG
// ==========================================================
function emit(st: GameState, p: Partial<Particle> & { type: Particle["type"]; color: string }) {
  st.particles.push({ x: 0, y: 0, vx: 0, vy: 0, size: 4, alpha: 1, decay: 0.03, ...p });
}

function addText(st: GameState, x: number, y: number, text: string, color: string, size = 15) {
  st.floatingTexts.push({ id: Date.now() + Math.random(), x, y, text, color, alpha: 1, size });
}

function damageEnemy(st: GameState, e: EnemyShip, dmg: number, lang: Lang) {
  if (e.dying > 0) return;
  e.hp -= dmg;
  e.flash = 1;
  if (e.hp > 0) return;
  e.hp = 0;
  e.dying = 0.001;
  st.kills += 1;
  AudioSys.playCrash();
  st.shake = Math.max(st.shake, 10);
  emit(st, { type: "shockwave", x: e.x, y: e.y, size: 14, alpha: 1, decay: 0.022, color: "#FFB74D" });
  emit(st, { type: "shockwave", x: e.x, y: e.y, size: 4, alpha: 0.8, decay: 0.03, color: "#E0F7FA" });
  for (let i = 0; i < 16; i++) {
    emit(st, { type: "bubble", x: e.x + (Math.random() - 0.5) * 70, y: e.y + (Math.random() - 0.5) * 36, vy: -0.3 - Math.random() * 0.5, size: 2 + Math.random() * 4, alpha: 0.8, decay: 0.012, color: "#B2EBF2" });
  }
  for (let i = 0; i < 14; i++) {
    emit(st, { type: "debris", x: e.x + (Math.random() - 0.5) * 50, y: e.y + (Math.random() - 0.5) * 24, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4, size: 2 + Math.random() * 3, alpha: 1, decay: 0.01, color: Math.random() > 0.5 ? "#4E342E" : "#212121" });
  }
  for (let i = 0; i < 12; i++) {
    emit(st, { type: "fire", x: e.x + (Math.random() - 0.5) * 40, y: e.y + (Math.random() - 0.5) * 20, vx: (Math.random() - 0.5) * 2, vy: -1 - Math.random() * 1.5, size: 6 + Math.random() * 8, alpha: 1, decay: 0.025, color: Math.random() > 0.4 ? "#FF6D00" : "#FFEA00" });
  }
  addText(st, e.x, e.y - 30, tr(lang, "+1 TIÊU DIỆT", "+1 SUNK"), "#00E676", 18);
}

function hurtPlayer(st: GameState, dmg: number, lang: Lang) {
  st.hp = Math.max(0, st.hp - dmg);
  st.invuln = 650;
  st.flash = 1;
  st.shake = Math.max(st.shake, 12);
  AudioSys.playHit();
  addText(st, st.x, st.y - 40, `-${dmg} ${tr(lang, "ĐỘ BỀN", "HULL")}`, "#FF1744", 16);
  for (let i = 0; i < 8; i++) {
    emit(st, { type: "debris", x: st.x, y: st.y, vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5, size: 2 + Math.random() * 2, decay: 0.03, color: "#6D4C41" });
  }
}

function explodeFirepot(st: GameState, x: number, y: number, lang: Lang) {
  AudioSys.playCrash();
  st.shake = Math.max(st.shake, 9);
  for (const e of st.enemies) {
    if (e.dying > 0) continue;
    const d = Math.hypot(e.x - x, e.y - y);
    if (d < 110) {
      damageEnemy(st, e, d < 60 ? 7 : 4, lang);
      e.burning = 3600;
    }
  }
  emit(st, { type: "shockwave", x, y, size: 10, alpha: 1, decay: 0.02, color: "#FF9800" });
  emit(st, { type: "shockwave", x, y, size: 2, alpha: 0.9, decay: 0.03, color: "#FFF59D" });
  for (let i = 0; i < 34; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 1 + Math.random() * 4;
    emit(st, { type: "fire", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, size: 6 + Math.random() * 10, alpha: 1, decay: 0.022, color: Math.random() > 0.4 ? "#FF5722" : "#FFD600" });
  }
  for (let i = 0; i < 14; i++) {
    emit(st, { type: "smoke", x: x + (Math.random() - 0.5) * 40, y: y + (Math.random() - 0.5) * 20, vx: (Math.random() - 0.5) * 1, vy: -0.6 - Math.random() * 0.8, size: 10 + Math.random() * 10, alpha: 0.7, decay: 0.01, color: "#37474F" });
  }
  addText(st, x, y - 30, tr(lang, "HỎA CÔNG!", "FIRE ATTACK!"), "#FFAB00", 18);
}

function spawnEnemy(st: GameState, W: number, H: number, ts: number) {
  const flagshipAlive = st.enemies.some(e => e.shipClass === "flagship" && e.dying === 0);
  const roll = Math.random();
  let chosen: EnemyShipClass = roll < 0.4 ? "scout" : roll < 0.87 ? "warship" : "flagship";
  if (chosen === "flagship" && flagshipAlive) chosen = "warship";
  const stat = ENEMY_STATS[chosen];

  const leftOK = st.x - W * 0.55 - 100 > 60;
  const rightOK = st.x + W * 0.62 + 100 < WORLD_WIDTH - 60;
  const fromRight = rightOK && (!leftOK || Math.random() < 0.6);
  const spawnX = fromRight ? st.x + W * 0.62 + 60 + Math.random() * 220 : Math.max(60, st.x - W * 0.55 - 60 - Math.random() * 200);
  const spawnY = 120 + Math.random() * (H - 240);

  st.lastSpawn = ts;
  st.enemies.push({
    id: Date.now() + Math.random(),
    x: spawnX,
    y: spawnY,
    angle: Math.atan2(st.y - spawnY, st.x - spawnX),
    shipClass: chosen,
    hp: stat.hp,
    maxHp: stat.hp,
    speed: stat.speed,
    impaled: false,
    lastDamageTick: 0,
    lastShot: ts + 800 + Math.random() * 1200,
    flash: 0,
    burning: 0,
    burnTick: 0,
    dying: 0
  });
}

// ==========================================================
// 6. HÀM VẼ ĐỒ HỌA CANVAS
// ==========================================================
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---------- Thuyền Mông Đồng của Ngô Quyền ----------
function drawNgoQuyenShip(ctx: CanvasRenderingContext2D, st: GameState, time: number) {
  const moving = st.isMoving;
  ctx.save();
  ctx.translate(st.x, st.y + Math.sin(time * 0.003) * 1.6);
  if (st.invuln > 0 && Math.floor(time / 80) % 2 === 0) ctx.globalAlpha = 0.55;
  ctx.rotate((st.facingLeft ? -1 : 1) * st.vy * 0.022);
  if (st.facingLeft) ctx.scale(-1, 1);

  // bóng đổ trên mặt nước
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(3, 10, 58, 17, 0, 0, Math.PI * 2);
  ctx.fill();

  // mái chèo
  const row = moving ? time * 0.014 : time * 0.003;
  const amp = moving ? 0.55 : 0.12;
  for (let i = 0; i < 6; i++) {
    const ox = -34 + i * 12;
    const a = Math.sin(row - i * 0.05) * amp;
    for (const s of [-1, 1]) {
      const bx = ox;
      const by = s * 12;
      const tx = ox + Math.sin(a) * 16;
      const ty = s * (12 + Math.cos(a) * 24);
      ctx.strokeStyle = "#D7CCC8";
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.strokeStyle = "#8D6E63";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(tx - Math.sin(a) * 6, ty - s * Math.cos(a) * 6);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      if (moving) {
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(tx, ty, 4 + Math.abs(Math.sin(row)) * 3, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  const hull = () => {
    ctx.beginPath();
    ctx.moveTo(-52, 0);
    ctx.bezierCurveTo(-48, -13, -30, -15, 0, -15);
    ctx.bezierCurveTo(26, -15, 44, -8, 58, 0);
    ctx.bezierCurveTo(44, 8, 26, 15, 0, 15);
    ctx.bezierCurveTo(-30, 15, -48, 13, -52, 0);
    ctx.closePath();
  };

  const hg = ctx.createLinearGradient(0, -15, 0, 15);
  hg.addColorStop(0, "#2B1812");
  hg.addColorStop(0.5, "#7A5237");
  hg.addColorStop(1, "#2B1812");
  ctx.fillStyle = hg;
  hull();
  ctx.fill();

  // ván thuyền
  ctx.save();
  hull();
  ctx.clip();
  ctx.strokeStyle = "rgba(0,0,0,0.28)";
  ctx.lineWidth = 1;
  for (let y = -12; y <= 12; y += 4) {
    ctx.beginPath();
    ctx.moveTo(-55, y);
    ctx.lineTo(60, y);
    ctx.stroke();
  }
  ctx.restore();

  ctx.strokeStyle = "#D4AF37";
  ctx.lineWidth = 1.8;
  hull();
  ctx.stroke();

  // sàn thuyền
  ctx.save();
  ctx.scale(0.82, 0.6);
  hull();
  ctx.fillStyle = "#24150F";
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "#4E342E";
  ctx.lineWidth = 1.2;
  for (let x = -38; x <= 34; x += 8) {
    const hh = 8.5 * Math.sqrt(Math.max(0, 1 - (x / 56) ** 2));
    ctx.beginPath();
    ctx.moveTo(x, -hh);
    ctx.lineTo(x, hh);
    ctx.stroke();
  }

  // quân chèo thuyền
  for (let i = 0; i < 6; i++) {
    const cx = -34 + i * 12 + Math.sin(row) * 1.5;
    for (const s of [-1, 1]) {
      ctx.fillStyle = "#8E1B1B";
      ctx.beginPath();
      ctx.ellipse(cx, s * 6, 2.6, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#D8C28A";
      ctx.strokeStyle = "#8D6E37";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(cx, s * 6, 3.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  // cung thủ ở mũi
  ctx.fillStyle = "#8E1B1B";
  ctx.beginPath();
  ctx.ellipse(36, 0, 3, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#D8C28A";
  ctx.beginPath();
  ctx.arc(36, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#5D4037";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(42, 0, 6, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  // chủ tướng
  ctx.fillStyle = "#B71C1C";
  ctx.beginPath();
  ctx.ellipse(-4, 0, 4, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#FFD54F";
  ctx.strokeStyle = "#8D6E37";
  ctx.beginPath();
  ctx.arc(-4, 0, 4.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // cột cờ + lá cờ bay
  const fl = 40;
  ctx.fillStyle = "#B71C1C";
  ctx.strokeStyle = "#FFD54F";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = 0; i <= 8; i++) {
    const fx = -8 - (fl * i) / 8;
    const fy = -4 + Math.sin(time * 0.011 - i * 0.8) * 2.6 * (i / 8);
    if (i === 0) ctx.moveTo(fx, fy);
    else ctx.lineTo(fx, fy);
  }
  for (let i = 8; i >= 0; i--) {
    const fx = -8 - (fl * i) / 8;
    const fy = 9 + Math.sin(time * 0.011 - i * 0.8) * 2.6 * (i / 8);
    ctx.lineTo(fx, fy);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#FFD54F";
  ctx.beginPath();
  ctx.arc(-18, 2.5, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3E2723";
  ctx.beginPath();
  ctx.arc(-8, 2, 2.6, 0, Math.PI * 2);
  ctx.fill();

  // đầu rồng ở mũi thuyền
  ctx.fillStyle = "#FFD54F";
  ctx.strokeStyle = "#8D6E37";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(54, 0, 7, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "#FFD54F";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(52, -4);
  ctx.quadraticCurveTo(48, -9, 44, -10);
  ctx.moveTo(52, 4);
  ctx.quadraticCurveTo(48, 9, 44, 10);
  ctx.stroke();
  ctx.fillStyle = "#D50000";
  ctx.beginPath();
  ctx.arc(56, -2.6, 1.3, 0, Math.PI * 2);
  ctx.arc(56, 2.6, 1.3, 0, Math.PI * 2);
  ctx.fill();

  // sóng mũi thuyền
  if (moving) {
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(52, -9, 8 + Math.sin(time * 0.02) * 1.5, -0.6, 1.2);
    ctx.arc(52, 9, 8 + Math.sin(time * 0.02) * 1.5, -1.2, 0.6);
    ctx.stroke();
  }

  if (st.flash > 0) {
    ctx.fillStyle = `rgba(255,60,60,${st.flash * 0.55})`;
    hull();
    ctx.fill();
  }

  // đèn lồng đuôi thuyền
  ctx.fillStyle = "#FFB300";
  ctx.beginPath();
  ctx.arc(-48, 0, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  glow(ctx, st.x + (st.facingLeft ? 48 : -48), st.y, 18, "#FF9800", 0.45 + Math.sin(time * 0.02) * 0.12);
}

// ---------- Chiến thuyền Nam Hán ----------
function drawNamHanWarship(ctx: CanvasRenderingContext2D, e: EnemyShip, time: number, lang: Lang) {
  const stat = ENEMY_STATS[e.shipClass];
  const s = stat.scale;
  const isFlag = e.shipClass === "flagship";
  const isScout = e.shipClass === "scout";
  const flip = Math.cos(e.angle) < 0 ? -1 : 1;
  const sinkK = e.dying;

  ctx.save();
  ctx.translate(e.x, e.y + Math.sin(time * 0.003 + e.id) * 1.4);
  ctx.rotate(e.angle + (e.impaled ? Math.sin(time * 0.03) * 0.03 + 0.1 : 0) + sinkK * 0.6);
  if (flip < 0) ctx.scale(1, -1);
  const sc = s * (1 - sinkK * 0.3);
  ctx.scale(sc, sc);
  ctx.globalAlpha = Math.max(0, 1 - sinkK * sinkK);

  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.ellipse(4, 11, 60, 21, 0, 0, Math.PI * 2);
  ctx.fill();

  // mái chèo
  const row = time * 0.006 + e.id;
  for (let i = 0; i < 7; i++) {
    const ox = -38 + i * 10;
    const a = e.impaled ? 0.7 * (i % 2 ? 1 : -1) : Math.sin(row + i * 0.3) * 0.4;
    for (const sd of [-1, 1]) {
      ctx.strokeStyle = "#CFD8DC";
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(ox, sd * 17);
      ctx.lineTo(ox + Math.sin(a) * 12, sd * (17 + Math.cos(a) * 22));
      ctx.stroke();
    }
  }

  const hull = () => {
    ctx.beginPath();
    ctx.moveTo(-54, -9);
    ctx.quadraticCurveTo(-57, -19, -42, -20);
    ctx.lineTo(22, -20);
    ctx.quadraticCurveTo(50, -15, 62, 0);
    ctx.quadraticCurveTo(50, 15, 22, 20);
    ctx.lineTo(-42, 20);
    ctx.quadraticCurveTo(-57, 19, -54, 9);
    ctx.closePath();
  };

  const hg = ctx.createLinearGradient(0, -20, 0, 20);
  hg.addColorStop(0, "#10191F");
  hg.addColorStop(0.5, "#33495E");
  hg.addColorStop(1, "#10191F");
  ctx.fillStyle = hg;
  hull();
  ctx.fill();

  ctx.save();
  hull();
  ctx.clip();
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 1;
  for (let y = -16; y <= 16; y += 5) {
    ctx.beginPath();
    ctx.moveTo(-58, y);
    ctx.lineTo(64, y);
    ctx.stroke();
  }
  ctx.restore();

  ctx.strokeStyle = isFlag ? "#E53935" : "#0A0F14";
  ctx.lineWidth = 2.2;
  hull();
  ctx.stroke();

  // viền đỏ mạn thuyền
  ctx.save();
  ctx.scale(0.93, 0.88);
  hull();
  ctx.strokeStyle = "#B71C1C";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // sàn
  ctx.fillStyle = "#241810";
  ctx.fillRect(-44, -12, 76, 24);
  ctx.strokeStyle = "#3E2B1D";
  ctx.lineWidth = 1;
  for (let x = -44; x <= 32; x += 9) {
    ctx.beginPath();
    ctx.moveTo(x, -12);
    ctx.lineTo(x, 12);
    ctx.stroke();
  }

  // hàng khiên dọc hai mạn
  if (!isScout) {
    for (let x = -42; x <= 28; x += 9) {
      for (const sd of [-1, 1]) {
        ctx.fillStyle = Math.round((x + 42) / 9) % 2 === 0 ? "#8E1B1B" : "#1C1C1C";
        ctx.strokeStyle = "#D4AF37";
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.arc(x, sd * 16.5, 4.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#D4AF37";
        ctx.beginPath();
        ctx.arc(x, sd * 16.5, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // binh lính
  const soldiers = isFlag ? 8 : isScout ? 3 : 5;
  for (let i = 0; i < soldiers; i++) {
    const sx = -36 + i * (isFlag ? 9 : 13);
    for (const sd of [-1, 1]) {
      if (isScout && sd === 1) continue;
      ctx.fillStyle = "#5C1717";
      ctx.beginPath();
      ctx.ellipse(sx, sd * 6.5, 2.6, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#90A4AE";
      ctx.strokeStyle = "#37474F";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(sx, sd * 6.5, 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#D32F2F";
      ctx.beginPath();
      ctx.arc(sx - 1.5, sd * 6.5, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // mũi nhọn bọc đồng
  ctx.fillStyle = "#B08D57";
  ctx.strokeStyle = "#5D4A2A";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(58, -5);
  ctx.lineTo(80, 0);
  ctx.lineTo(58, 5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // buồm
  const sailWave = Math.sin(time * 0.005 + e.id) * 3;
  const drawSail = (mx: number, w: number, color: string) => {
    const bulge = 12 + sailWave;
    ctx.fillStyle = color;
    ctx.strokeStyle = isFlag ? "#D4AF37" : "#CFD8DC";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(mx, -w);
    ctx.quadraticCurveTo(mx + bulge, 0, mx, w);
    ctx.lineTo(mx - 4, w - 1);
    ctx.quadraticCurveTo(mx + bulge - 4, 0, mx - 4, -w + 1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 1;
    for (let b = -0.75; b <= 0.76; b += 0.25) {
      const yy = b * w;
      const bx = mx + bulge * 0.5 * (1 - (yy / w) ** 2);
      ctx.beginPath();
      ctx.moveTo(bx, yy);
      ctx.lineTo(bx - 4, yy);
      ctx.stroke();
    }
    ctx.fillStyle = "#212121";
    ctx.beginPath();
    ctx.arc(mx, 0, 2.6, 0, Math.PI * 2);
    ctx.fill();
  };
  drawSail(isFlag ? 12 : 2, isScout ? 20 : 25, isScout ? "#37474F" : isFlag ? "#4A0E0E" : "#6B1414");
  if (isFlag) drawSail(-30, 22, "#5A1212");

  // lầu chỉ huy trên soái hạm
  if (isFlag) {
    ctx.fillStyle = "#3B2A1E";
    ctx.strokeStyle = "#D4AF37";
    ctx.lineWidth = 1.6;
    rr(ctx, -22, -14, 30, 28, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#7F1D1D";
    rr(ctx, -19, -11, 24, 22, 3);
    ctx.fill();
    ctx.strokeStyle = "#D4AF37";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-19, 0);
    ctx.lineTo(5, 0);
    ctx.stroke();
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    for (let x = -14; x <= 2; x += 5) {
      ctx.beginPath();
      ctx.moveTo(x, -11);
      ctx.lineTo(x, 11);
      ctx.stroke();
    }
    ctx.fillStyle = "#D4AF37";
    for (const [px, py] of [[-22, -14], [8, -14], [-22, 14], [8, 14]]) {
      ctx.beginPath();
      ctx.arc(px, py, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // cờ hiệu Nam Hán
  const fl = isFlag ? 36 : 22;
  const fx0 = -50;
  ctx.fillStyle = isFlag ? "#6A1B9A" : "#8E1B1B";
  ctx.strokeStyle = "#FFD54F";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= 6; i++) {
    const fx = fx0 - (fl * i) / 6;
    const fy = -6 + Math.sin(time * 0.01 - i * 0.8 + e.id) * 2.4 * (i / 6);
    if (i === 0) ctx.moveTo(fx, fy);
    else ctx.lineTo(fx, fy);
  }
  for (let i = 6; i >= 0; i--) {
    const fx = fx0 - (fl * i) / 6;
    const fy = 7 + Math.sin(time * 0.01 - i * 0.8 + e.id) * 2.4 * (i / 6);
    ctx.lineTo(fx, fy);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  if (!isScout) {
    ctx.fillStyle = "#FFF8E1";
    ctx.font = "bold 11px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("漢", fx0 - fl * 0.45, 1);
  }

  // vết nứt khi bị cọc đâm
  if (e.impaled) {
    ctx.strokeStyle = "#FF7043";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-10, -18);
    ctx.lineTo(-4, -8);
    ctx.lineTo(-12, 0);
    ctx.lineTo(-2, 10);
    ctx.lineTo(-8, 19);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,87,34,${0.5 + Math.sin(time * 0.02) * 0.3})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, 40 + Math.sin(time * 0.02) * 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (e.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${e.flash * 0.7})`;
    hull();
    ctx.fill();
  }
  ctx.restore();

  // đuốc trên soái hạm
  if (isFlag && sinkK === 0) {
    const cosA = Math.cos(e.angle);
    const sinA = Math.sin(e.angle);
    for (const [lx, ly] of [[-22, -14], [8, -14], [-22, 14], [8, 14]]) {
      const yy = flip < 0 ? -ly : ly;
      const wx = e.x + (lx * cosA - yy * sinA) * s;
      const wy = e.y + (lx * sinA + yy * cosA) * s;
      glow(ctx, wx, wy, 16, "#FF9800", 0.4 + Math.sin(time * 0.03 + lx) * 0.12);
    }
  }

  // thanh máu + tên
  if (sinkK === 0) {
    ctx.save();
    ctx.translate(e.x, e.y - 34 * s - 10);
    const barW = 44 + 14 * s;
    const barH = 6;
    ctx.fillStyle = "rgba(0,0,0,0.8)";
    rr(ctx, -barW / 2 - 1.5, -1.5, barW + 3, barH + 3, 3);
    ctx.fill();
    const ratio = e.hp / e.maxHp;
    const bg = ctx.createLinearGradient(-barW / 2, 0, barW / 2, 0);
    bg.addColorStop(0, e.impaled ? "#FF6F00" : "#E53935");
    bg.addColorStop(1, e.impaled ? "#FFB300" : "#FF8A65");
    ctx.fillStyle = bg;
    rr(ctx, -barW / 2, 0, Math.max(2, ratio * barW), barH, 2);
    ctx.fill();
    ctx.font = `bold ${10 * UI_BOOST}px ${UI_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.strokeStyle = "rgba(0,0,0,0.9)";
    ctx.lineWidth = 3;
    const label = (lang === "vi" ? stat.name_vi : stat.name_en) + (e.burning > 0 ? " 🔥" : "");
    ctx.strokeText(label, 0, -5);
    ctx.fillStyle = isFlag ? "#FFD54F" : "#ECEFF1";
    ctx.fillText(label, 0, -5);
    ctx.restore();
  }
}

// ---------- Cọc ngầm ----------
function drawStake(ctx: CanvasRenderingContext2D, x: number, y: number, tideLevel: number, time: number) {
  ctx.save();
  ctx.translate(x, y);
  const isExposed = tideLevel <= 50;

  if (!isExposed) {
    const pulse = Math.sin(time * 0.005 + x) * 3;
    ctx.strokeStyle = "rgba(178, 235, 242, 0.22)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 11 + pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(6, 18, 30, 0.35)";
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const emergeRatio = Math.min(1, (55 - tideLevel) / 35);
    const stakeHeight = 15 + emergeRatio * 17;

    ctx.strokeStyle = "rgba(224, 247, 250, 0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 6, 12 + Math.sin(time * 0.004 + x) * 1.5, 5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(224, 247, 250, 0.3)";
    ctx.beginPath();
    ctx.ellipse(0, 6, 18 + Math.sin(time * 0.004 + x) * 2, 8, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath();
    ctx.ellipse(5, 7, 7, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    const wood = ctx.createLinearGradient(-6, 0, 6, 0);
    wood.addColorStop(0, "#2A1A15");
    wood.addColorStop(0.5, "#5D4037");
    wood.addColorStop(1, "#2A1A15");
    ctx.fillStyle = wood;
    ctx.strokeStyle = "#1A0F0D";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-6, 5);
    ctx.lineTo(-4, -stakeHeight + 9);
    ctx.lineTo(4, -stakeHeight + 9);
    ctx.lineTo(6, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    const ironGrad = ctx.createLinearGradient(-4, -stakeHeight, 4, -stakeHeight + 10);
    ironGrad.addColorStop(0, "#FFFFFF");
    ironGrad.addColorStop(0.5, "#90A4AE");
    ironGrad.addColorStop(1, "#263238");
    ctx.fillStyle = ironGrad;
    ctx.beginPath();
    ctx.moveTo(0, -stakeHeight);
    ctx.lineTo(5, -stakeHeight + 10);
    ctx.lineTo(-5, -stakeHeight + 10);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// ---------- Mặt nước ----------
function drawWaterBase(ctx: CanvasRenderingContext2D, W: number, H: number, st: GameState) {
  const hi = ctx.createLinearGradient(0, 0, 0, H);
  hi.addColorStop(0, "#0A2230");
  hi.addColorStop(0.2, "#12445C");
  hi.addColorStop(0.5, "#1B6C86");
  hi.addColorStop(0.8, "#12445C");
  hi.addColorStop(1, "#0A2230");
  ctx.fillStyle = hi;
  ctx.fillRect(0, 0, W, H);
  if (st.tint > 0.01) {
    const lo = ctx.createLinearGradient(0, 0, 0, H);
    lo.addColorStop(0, "#08161D");
    lo.addColorStop(0.2, "#13303A");
    lo.addColorStop(0.5, "#1D4A50");
    lo.addColorStop(0.8, "#13303A");
    lo.addColorStop(1, "#08161D");
    ctx.globalAlpha = st.tint * 0.9;
    ctx.fillStyle = lo;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
}

function drawWaves(ctx: CanvasRenderingContext2D, W: number, H: number, st: GameState, ts: number) {
  const x0 = Math.floor(st.cameraX / 24) * 24 - 24;
  const x1 = st.cameraX + W + 24;
  for (let l = 0; l < 3; l++) {
    ctx.strokeStyle = `rgba(200,240,255,${0.04 + l * 0.03})`;
    ctx.lineWidth = 1.5 + l * 0.6;
    for (let wy = 96 + l * 14; wy < H - 90; wy += 46) {
      ctx.beginPath();
      for (let wx = x0; wx <= x1; wx += 24) {
        const y = wy + Math.sin(ts * 0.0016 * (1 + l * 0.4) + wx * 0.018 + wy * 0.3 + l) * (4 + l * 1.5);
        if (wx === x0) ctx.moveTo(wx, y);
        else ctx.lineTo(wx, y);
      }
      ctx.stroke();
    }
  }
  // ánh sáng lấp lánh
  const c0 = Math.floor(st.cameraX / 70);
  const c1 = Math.ceil((st.cameraX + W) / 70);
  for (let cx = c0; cx <= c1; cx++) {
    for (let r = 0; r < 6; r++) {
      const hx = hash(cx * 13 + r);
      const hy = hash(cx * 7 + r * 3);
      const tw = Math.sin(ts * 0.004 + hx * 6.28);
      if (tw > 0.7) {
        const px = cx * 70 + hx * 60;
        const py = 100 + hy * (H - 200);
        ctx.strokeStyle = `rgba(255,255,240,${(tw - 0.7) * 2})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(px - 3 - tw * 3, py);
        ctx.lineTo(px + 3 + tw * 3, py);
        ctx.stroke();
      }
    }
  }
}

// ---------- Bờ sông (cây, lau sậy, doanh trại) ----------
function drawCamp(ctx: CanvasRenderingContext2D, x: number, ts: number) {
  ctx.save();
  ctx.translate(x, 34);
  for (const tx of [-48, 48]) {
    ctx.fillStyle = "#CDBB8A";
    ctx.fillRect(tx - 18, -14, 36, 14);
    ctx.fillStyle = "#8F7E57";
    ctx.fillRect(tx - 18, 0, 36, 14);
    ctx.strokeStyle = "#5D4E30";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(tx - 18, -14, 36, 28);
    ctx.beginPath();
    ctx.moveTo(tx - 18, 0);
    ctx.lineTo(tx + 18, 0);
    ctx.stroke();
  }
  // lửa trại
  const fl = Math.sin(ts * 0.03 + x) * 0.5 + Math.sin(ts * 0.07) * 0.3;
  ctx.fillStyle = "#4E4E4E";
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.arc(Math.cos(i * 0.785) * 8, 2 + Math.sin(i * 0.785) * 8, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#FF6D00";
  ctx.beginPath();
  ctx.arc(0, 2, 5 + fl, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#FFEA00";
  ctx.beginPath();
  ctx.arc(0, 2, 2.6 + fl * 0.5, 0, Math.PI * 2);
  ctx.fill();
  // quân sĩ quanh lửa
  for (let i = 0; i < 4; i++) {
    const a = i * 1.57 + 0.6;
    const px = Math.cos(a) * 17;
    const py = 2 + Math.sin(a) * 15;
    ctx.fillStyle = "#8E1B1B";
    ctx.beginPath();
    ctx.ellipse(px, py, 3, 5, a, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#D8C28A";
    ctx.strokeStyle = "#8D6E37";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // cờ hiệu
  ctx.strokeStyle = "#5D4037";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(78, 22);
  ctx.lineTo(78, -26);
  ctx.stroke();
  ctx.fillStyle = "#B71C1C";
  ctx.strokeStyle = "#FFD54F";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= 6; i++) {
    const fx = 78 + i * 5;
    const fy = -26 + Math.sin(ts * 0.008 - i * 0.7) * 2.5 * (i / 6);
    if (i === 0) ctx.moveTo(fx, fy);
    else ctx.lineTo(fx, fy);
  }
  for (let i = 6; i >= 0; i--) {
    ctx.lineTo(78 + i * 5, -12 + Math.sin(ts * 0.008 - i * 0.7) * 2.5 * (i / 6));
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.translate(x, 0);
  glow(ctx, 0, 36, 56, "#FF8F00", 0.3 + (Math.sin(ts * 0.03 + x) * 0.5 + 0.5) * 0.12);
  ctx.restore();
}

function drawBank(ctx: CanvasRenderingContext2D, W: number, H: number, st: GameState, ts: number, top: boolean) {
  const x0 = st.cameraX - 100;
  const x1 = st.cameraX + W + 100;
  const exposure = ((100 - st.tide) / 90) * 14;
  ctx.save();
  if (!top) {
    ctx.translate(0, H);
    ctx.scale(1, -1);
  }

  const mud = ctx.createLinearGradient(0, 0, 0, 82 + exposure);
  mud.addColorStop(0, "#2A2216");
  mud.addColorStop(0.6, "#4D3B27");
  mud.addColorStop(0.9, "#6E5638");
  mud.addColorStop(1, "#3D3022");
  ctx.fillStyle = mud;
  ctx.fillRect(x0, 0, x1 - x0, 82 + exposure);
  ctx.fillStyle = "rgba(150,190,200,0.10)";
  ctx.fillRect(x0, 82, x1 - x0, exposure);

  const gr = ctx.createLinearGradient(0, 0, 0, 60);
  gr.addColorStop(0, "#12281A");
  gr.addColorStop(1, "#27492B");
  ctx.fillStyle = gr;
  ctx.fillRect(x0, 0, x1 - x0, 60);

  for (let gx = Math.floor(x0 / 50) * 50; gx < x1; gx += 50) {
    const hh = hash(gx * 0.37 + (top ? 1 : 9));
    ctx.fillStyle = `rgba(${Math.floor(60 + hh * 40)},${Math.floor(110 + hh * 50)},${Math.floor(50 + hh * 20)},0.25)`;
    ctx.beginPath();
    ctx.ellipse(gx + hh * 30, 20 + hh * 34, 16 + hh * 14, 5 + hh * 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // bọt sóng ven bờ
  for (let pass = 0; pass < 2; pass++) {
    ctx.strokeStyle = pass === 0 ? "rgba(235,250,255,0.38)" : "rgba(235,250,255,0.18)";
    ctx.lineWidth = pass === 0 ? 3 : 1.6;
    ctx.beginPath();
    for (let wx = x0; wx <= x1; wx += 18) {
      const wy = 82 + exposure + pass * 5 + Math.sin(ts * 0.002 + wx * 0.03 + pass * 2) * 2.5;
      if (wx === x0) ctx.moveTo(wx, wy);
      else ctx.lineTo(wx, wy);
    }
    ctx.stroke();
  }

  // lau sậy
  ctx.lineWidth = 1.6;
  ctx.lineCap = "round";
  for (const r of REEDS) {
    if (r.top !== top || r.x < x0 || r.x > x1) continue;
    const bx = r.x;
    const by = 76 + exposure * 0.6;
    for (let b = 0; b < 5; b++) {
      const a = (b - 2) * 0.5 + Math.sin(ts * 0.002 + r.phase) * 0.15;
      ctx.strokeStyle = b % 2 ? "#6B8E3A" : "#8AA84A";
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + Math.sin(a) * r.len, by + Math.cos(a) * r.len * 0.7);
      ctx.stroke();
    }
  }

  // cây cối
  for (const t of TREES) {
    if (t.top !== top || t.x < x0 - 40 || t.x > x1 + 40) continue;
    const ty = 14 + t.depth * 38;
    const sway = Math.sin(ts * 0.0014 + t.phase) * 1.8;
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(t.x + 8, ty + 12, t.r * 1.05, t.r * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    const hue = 95 + t.tone * 30;
    const lobes = [
      [-0.45, 0.1, 0.75],
      [0.4, 0.15, 0.7],
      [0, -0.3, 0.8]
    ];
    for (const [ox, oy, rf] of lobes) {
      const cx = t.x + ox * t.r + sway;
      const cy = ty + oy * t.r;
      const rad = t.r * rf;
      const g = ctx.createRadialGradient(cx - rad * 0.3, cy - rad * 0.3, rad * 0.1, cx, cy, rad);
      g.addColorStop(0, `hsl(${hue}, 50%, ${42 + t.tone * 10}%)`);
      g.addColorStop(1, `hsl(${hue + 10}, 55%, 14%)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(190,230,120,0.18)";
    ctx.beginPath();
    ctx.arc(t.x - t.r * 0.25 + sway, ty - t.r * 0.35, t.r * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const c of CAMPS) {
    if (c.top === top && c.x > x0 - 120 && c.x < x1 + 120) drawCamp(ctx, c.x, ts);
  }
  ctx.restore();
}

function drawStakeZone(ctx: CanvasRenderingContext2D, H: number, st: GameState, lang: Lang) {
  const isLow = st.tide <= 50;
  const g = ctx.createLinearGradient(STAKE_ZONE_START, 0, STAKE_ZONE_END, 0);
  g.addColorStop(0, "rgba(183, 28, 28, 0.04)");
  g.addColorStop(0.5, isLow ? "rgba(183, 28, 28, 0.24)" : "rgba(183, 28, 28, 0.1)");
  g.addColorStop(1, "rgba(183, 28, 28, 0.04)");
  ctx.fillStyle = g;
  ctx.fillRect(STAKE_ZONE_START, 90, STAKE_ZONE_END - STAKE_ZONE_START, H - 180);

  ctx.strokeStyle = "rgba(212, 175, 55, 0.45)";
  ctx.setLineDash([10, 8]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(STAKE_ZONE_START, 90);
  ctx.lineTo(STAKE_ZONE_START, H - 90);
  ctx.moveTo(STAKE_ZONE_END, 90);
  ctx.lineTo(STAKE_ZONE_END, H - 90);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.font = `bold 12px ${UI_FONT}`;
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255, 213, 79, 0.75)";
  ctx.strokeStyle = "rgba(0,0,0,0.7)";
  ctx.lineWidth = 3;
  const label = tr(lang, "⚠ BÃI CỌC NGẦM BẠCH ĐẰNG ⚠", "⚠ BACH DANG STAKE FIELD ⚠");
  ctx.strokeText(label, (STAKE_ZONE_START + STAKE_ZONE_END) / 2, 104);
  ctx.fillText(label, (STAKE_ZONE_START + STAKE_ZONE_END) / 2, 104);
}

function drawQuizStation(ctx: CanvasRenderingContext2D, q: QuizStation, ts: number, lang: Lang, H: number) {
  ctx.save();
  ctx.translate(q.x, clamp(q.y, 120, H - 120));
  const col = q.cleared ? "#00E676" : "#FFD700";
  glow(ctx, 0, 0, 80, q.cleared ? "#00C853" : "#FFB300", 0.4);

  const pulse = Math.sin(ts * 0.006) * 4;
  ctx.strokeStyle = q.cleared ? "rgba(0,230,118,0.7)" : "rgba(255,215,0,0.85)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 36 + pulse, 0, Math.PI * 2);
  ctx.stroke();

  ctx.save();
  ctx.rotate(ts * 0.0008);
  ctx.setLineDash([10, 8]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = q.cleared ? "rgba(0,230,118,0.5)" : "rgba(255,215,0,0.6)";
  ctx.beginPath();
  ctx.arc(0, 0, 48, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // bè gỗ
  ctx.save();
  ctx.rotate(Math.sin(ts * 0.002) * 0.05);
  ctx.fillStyle = "#5D4037";
  ctx.strokeStyle = "#2A1A15";
  ctx.lineWidth = 2;
  rr(ctx, -24, -24, 48, 48, 6);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 1;
  for (let i = -16; i <= 16; i += 8) {
    ctx.beginPath();
    ctx.moveTo(-24, i);
    ctx.lineTo(24, i);
    ctx.stroke();
  }
  ctx.restore();

  ctx.fillStyle = q.cleared ? "#1B5E20" : "#7F0000";
  ctx.strokeStyle = "#FFD700";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = col;
  ctx.font = `bold 20px ${UI_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(q.cleared ? "✓" : q.id.slice(1), 0, 1);

  // cờ lệnh
  ctx.strokeStyle = "#3E2723";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(-16, -16);
  ctx.lineTo(-16, -44);
  ctx.stroke();
  ctx.fillStyle = q.cleared ? "#2E7D32" : "#B71C1C";
  ctx.strokeStyle = "#FFD54F";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= 6; i++) {
    const fx = -16 + i * 5;
    const fy = -44 + Math.sin(ts * 0.009 - i * 0.7) * 2.5 * (i / 6);
    if (i === 0) ctx.moveTo(fx, fy);
    else ctx.lineTo(fx, fy);
  }
  for (let i = 6; i >= 0; i--) {
    ctx.lineTo(-16 + i * 5, -30 + Math.sin(ts * 0.009 - i * 0.7) * 2.5 * (i / 6));
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // tiêu đề
  const title = tr(lang, q.title_vi, q.title_en);
  ctx.font = `bold ${12 * UI_BOOST}px ${UI_FONT}`;
  const tw = ctx.measureText(title).width;
  ctx.fillStyle = "rgba(10,8,6,0.78)";
  ctx.strokeStyle = "rgba(212,175,55,0.7)";
  ctx.lineWidth = 1;
  rr(ctx, -tw / 2 - 10, 54, tw + 20, 22 * UI_BOOST, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#FFF8E1";
  ctx.fillText(title, 0, 54 + 11 * UI_BOOST + 0.5);
  ctx.restore();
}

function drawParticles(ctx: CanvasRenderingContext2D, st: GameState, layer: "under" | "over") {
  for (const p of st.particles) {
    const a = Math.max(0, Math.min(1, p.alpha));
    if (layer === "under") {
      if (p.type === "wake" || p.type === "shockwave") {
        ctx.save();
        ctx.globalAlpha = a;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.type === "shockwave" ? 3 : 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (p.type === "bubble") {
        ctx.save();
        ctx.globalAlpha = a;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (p.type === "splash") {
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    } else {
      if (p.type === "debris") {
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.x * 0.2);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size, -p.size * 0.35, p.size * 2, p.size * 0.7);
        ctx.restore();
      } else if (p.type === "smoke") {
        ctx.save();
        ctx.globalAlpha = a * 0.45;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (p.type === "fire" || p.type === "spark" || p.type === "ember") {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.5, p.size * (0.5 + 0.5 * a)), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }
}

function drawProjectile(ctx: CanvasRenderingContext2D, proj: Projectile, ts: number) {
  ctx.save();
  ctx.translate(proj.x, proj.y);
  if (proj.type === "firepot") {
    ctx.rotate(Math.sin(ts * 0.004 + proj.id) * 0.2);
    ctx.fillStyle = "#4E342E";
    ctx.strokeStyle = "#1A0F0D";
    ctx.lineWidth = 2;
    rr(ctx, -20, -12, 40, 24, 4);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#2A1A15";
    ctx.lineWidth = 1;
    for (let i = -12; i <= 12; i += 8) {
      ctx.beginPath();
      ctx.moveTo(i, -12);
      ctx.lineTo(i, 12);
      ctx.stroke();
    }
    ctx.fillStyle = "#FF5722";
    ctx.beginPath();
    ctx.arc(0, 0, 8 + Math.sin(ts * 0.03) * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#FFEA00";
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    glow(ctx, proj.x, proj.y, 40, "#FF6D00", 0.6);
    return;
  }
  ctx.rotate(Math.atan2(proj.vy, proj.vx));
  const enemy = proj.type === "enemyArrow";
  ctx.strokeStyle = enemy ? "#B0BEC5" : "#FFE082";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-12, 0);
  ctx.lineTo(8, 0);
  ctx.stroke();
  ctx.fillStyle = enemy ? "#ECEFF1" : "#FFFFFF";
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.lineTo(6, -3);
  ctx.lineTo(6, 3);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = enemy ? "#E53935" : "#FF8F00";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-12, 0);
  ctx.lineTo(-16, -3);
  ctx.moveTo(-12, 0);
  ctx.lineTo(-16, 3);
  ctx.stroke();
  ctx.restore();
  if (!enemy) glow(ctx, proj.x, proj.y, 14, "#FFB300", 0.4);
}

function drawAtmosphere(ctx: CanvasRenderingContext2D, W: number, H: number, st: GameState, ts: number) {
  // sương mù trôi
  for (let i = 0; i < 6; i++) {
    const span = W + 700;
    const raw = i * 430 + ts * (0.012 + i * 0.003) - st.cameraX * (0.35 + i * 0.05);
    const mx = ((raw % span) + span) % span - 350;
    const my = H * (0.12 + ((i * 0.17) % 0.8));
    ctx.save();
    ctx.translate(mx, my);
    ctx.scale(3.2, 0.8);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 140);
    g.addColorStop(0, `rgba(200,225,235,${0.09 + st.tint * 0.03})`);
    g.addColorStop(1, "rgba(200,225,235,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 140, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // tia nắng
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 3; i++) {
    const bx = ((i * 520 + ts * 0.01) % (W + 500)) - 250;
    ctx.fillStyle = `rgba(255,214,150,${0.025 + Math.sin(ts * 0.0006 + i) * 0.01})`;
    ctx.beginPath();
    ctx.moveTo(bx, 0);
    ctx.lineTo(bx + 120, 0);
    ctx.lineTo(bx + 120 - 330, H);
    ctx.lineTo(bx - 330, H);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // hoàng hôn + sắc đỏ khi nước ròng
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "rgba(255,170,90,0.10)");
  sky.addColorStop(0.5, "rgba(0,0,0,0)");
  sky.addColorStop(1, "rgba(5,20,45,0.20)");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  if (st.tint > 0.01) {
    ctx.fillStyle = `rgba(160,35,12,${0.1 * st.tint})`;
    ctx.fillRect(0, 0, W, H);
  }

  // vignette
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.78);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.6)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  // cảnh báo máu thấp / trúng đòn
  if (st.hud && st.hp < 35) {
    const a = 0.15 + 0.1 * Math.sin(ts * 0.008);
    const rg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.75);
    rg.addColorStop(0, "rgba(160,0,0,0)");
    rg.addColorStop(1, `rgba(160,0,0,${a * 3})`);
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
  }
  if (st.flash > 0) {
    ctx.fillStyle = `rgba(255,0,0,${st.flash * 0.22})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawMinimap(ctx: CanvasRenderingContext2D, W: number, H: number, st: GameState, lang: Lang) {
  const z = st.zoom;
  const vw = W * z;
  const vh = H * z;
  if (vw < 480) return;
  const top = st.miniTop;
  const mw = top ? 190 : 280;
  const mh = top ? 30 : 44;
  const mx = vw - mw - (top ? 20 : 28);
  const my = top ? 104 : vh - mh - 28;
  const sx = mw / WORLD_WIDTH;
  ctx.save();
  ctx.scale(1 / z, 1 / z);
  ctx.fillStyle = "rgba(10,8,6,0.85)";
  ctx.strokeStyle = "#8A6D2F";
  ctx.lineWidth = 1.5;
  rr(ctx, mx - 10, my - 22, mw + 20, mh + 34, 8);
  ctx.fill();
  ctx.stroke();
  ctx.font = `bold 10px ${UI_FONT}`;
  ctx.fillStyle = "#D4AF37";
  ctx.textAlign = "left";
  ctx.fillText(top ? tr(lang, "BẢN ĐỒ", "MAP") : tr(lang, "BẢN ĐỒ SÔNG BẠCH ĐẰNG", "BACH DANG RIVER MAP"), mx, my - 8);

  const rg = ctx.createLinearGradient(0, my, 0, my + mh);
  rg.addColorStop(0, "#0C3248");
  rg.addColorStop(0.5, "#16627F");
  rg.addColorStop(1, "#0C3248");
  ctx.fillStyle = rg;
  ctx.fillRect(mx, my, mw, mh);
  ctx.fillStyle = "rgba(198,40,40,0.4)";
  ctx.fillRect(mx + STAKE_ZONE_START * sx, my, (STAKE_ZONE_END - STAKE_ZONE_START) * sx, mh);

  for (const q of st.quizzes) {
    const qx = mx + q.x * sx;
    const qy = my + mh / 2;
    ctx.fillStyle = q.cleared ? "#00E676" : "#FFD700";
    ctx.beginPath();
    ctx.moveTo(qx, qy - 5);
    ctx.lineTo(qx + 4, qy);
    ctx.lineTo(qx, qy + 5);
    ctx.lineTo(qx - 4, qy);
    ctx.closePath();
    ctx.fill();
  }
  for (const e of st.enemies) {
    if (e.dying > 0) continue;
    ctx.fillStyle = e.shipClass === "flagship" ? "#E040FB" : "#FF5252";
    ctx.beginPath();
    ctx.arc(mx + e.x * sx, my + ((e.y - 100) / Math.max(1, H - 200)) * (mh - 8) + 4, e.shipClass === "flagship" ? 3.4 : 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  const px = mx + st.x * sx;
  const py = my + ((st.y - 100) / Math.max(1, H - 200)) * (mh - 8) + 4;
  ctx.fillStyle = "#FFFFFF";
  ctx.strokeStyle = "#D4AF37";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(px + (st.facingLeft ? -6 : 6), py);
  ctx.lineTo(px - (st.facingLeft ? -4 : 4), py - 4);
  ctx.lineTo(px - (st.facingLeft ? -4 : 4), py + 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 1;
  ctx.strokeRect(mx + st.cameraX * sx, my + 0.5, W * sx, mh - 1);
  ctx.restore();
}

// ==========================================================
// 7. COMPONENT CHÍNH (APP)
// ==========================================================
const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&family=Cormorant+Garamond:ital,wght@0,500;0,700;1,500&display=swap');
html, body { margin: 0; padding: 0; overflow: hidden; overscroll-behavior: none; -webkit-tap-highlight-color: transparent; }
.bd-btn { transition: transform .15s ease, filter .15s ease, box-shadow .15s ease; }
.bd-btn:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.18); box-shadow: 0 6px 18px rgba(212,175,55,.35); }
.bd-btn:active:not(:disabled) { transform: translateY(0); }
.bd-btn:disabled { cursor: not-allowed; }
.bd-panel { background: linear-gradient(180deg, rgba(28,21,13,.94), rgba(10,8,6,.94)); border: 1px solid #8A6D2F; box-shadow: 0 0 0 1px #000, inset 0 0 0 3px rgba(212,175,55,.10), 0 10px 32px rgba(0,0,0,.65); backdrop-filter: blur(4px); }
@keyframes bd-fadein { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes bd-shake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-8px); } 40% { transform: translateX(8px); } 60% { transform: translateX(-5px); } 80% { transform: translateX(5px); } }
@keyframes bd-wave { from { background-position: 0 0; } to { background-position: 48px 0; } }
@keyframes bd-glow { 0%,100% { text-shadow: 0 0 12px rgba(212,175,55,.35); } 50% { text-shadow: 0 0 28px rgba(212,175,55,.8); } }
`;

const LABEL: React.CSSProperties = { color: "#D4AF37", fontSize: 10, fontWeight: 700, letterSpacing: 1.6, marginBottom: 5, fontFamily: UI_FONT };

function Key({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ display: "inline-block", minWidth: 20, textAlign: "center", padding: "2px 7px", margin: "0 5px 0 0", borderRadius: 5, background: "linear-gradient(180deg,#3a3326,#1e1a12)", border: "1px solid #8A6D2F", borderBottomWidth: 3, color: "#FFE9A8", fontSize: 11, fontWeight: 700 }}>
      {children}
    </span>
  );
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [lang, setLang] = useState<Lang>("vi");
  const [phase, setPhase] = useState<GamePhase>("language");
  const [tideLevel, setTideLevel] = useState<number>(100);
  const [playerHp, setPlayerHp] = useState<number>(100);
  const [killCount, setKillCount] = useState<number>(0);
  const [quizzes, setQuizzes] = useState<QuizStation[]>(INITIAL_QUIZZES);
  const [activeQuiz, setActiveQuiz] = useState<QuizStation | null>(null);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [wrongAnswersCount, setWrongAnswersCount] = useState<number>(0);
  const [wrongPicks, setWrongPicks] = useState<number[]>([]);
  const [solved, setSolved] = useState<boolean>(false);
  const [shakeKey, setShakeKey] = useState<number>(0);
  const [muted, setMuted] = useState<boolean>(false);
  const [gcd, setGcd] = useState<number>(1);

  const stateRef = useRef<GameState>(null as unknown as GameState);
  if (stateRef.current === null) stateRef.current = makeState(window.innerHeight / getZoom());

  stateRef.current.isPaused = phase !== "gameplay" || activeQuiz !== null || showSettings;
  stateRef.current.hud = phase === "gameplay";

  // ----- Hỗ trợ điện thoại / máy tính bảng -----
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [touchMode, setTouchMode] = useState<boolean>(
    () => window.matchMedia("(pointer: coarse)").matches || (navigator.maxTouchPoints > 0 && window.innerWidth < 1100)
  );
  const [joyKnob, setJoyKnob] = useState({ x: 0, y: 0 });
  const [fireDown, setFireDown] = useState<boolean>(false);
  const [raftDown, setRaftDown] = useState<boolean>(false);
  const inputRef = useRef({ jx: 0, jy: 0, fire: false, raft: false });
  const joyPointer = useRef<number | null>(null);
  const compact = vp.w < 1000 || vp.h < 520;
  const portrait = vp.h > vp.w;
  const canFs = typeof document !== "undefined" && !!document.fullscreenEnabled;
  stateRef.current.miniTop = compact || touchMode;

  useEffect(() => {
    let meta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "viewport";
      document.head.appendChild(meta);
    }
    meta.content = "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover";
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    const onTouch = () => setTouchMode(true);
    const noGesture = (e: Event) => e.preventDefault();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    window.addEventListener("touchstart", onTouch, { passive: true, once: true });
    document.addEventListener("gesturestart", noGesture);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      window.removeEventListener("touchstart", onTouch);
      document.removeEventListener("gesturestart", noGesture);
    };
  }, []);

  useEffect(() => {
    const onHide = () => {
      if (document.hidden && phase === "gameplay") setShowSettings(true);
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [phase]);

  const pausedNow = phase !== "gameplay" || activeQuiz !== null || showSettings;
  useEffect(() => {
    if (pausedNow) {
      inputRef.current = { jx: 0, jy: 0, fire: false, raft: false };
      joyPointer.current = null;
      setJoyKnob({ x: 0, y: 0 });
      setFireDown(false);
      setRaftDown(false);
    }
  }, [pausedNow]);

  const joySize = compact ? 112 : 136;
  const updateJoy = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const max = r.width / 2 - 16;
    const d = Math.hypot(dx, dy);
    if (d > max) {
      dx = (dx / d) * max;
      dy = (dy / d) * max;
    }
    setJoyKnob({ x: dx, y: dy });
    const nx = dx / max;
    const ny = dy / max;
    inputRef.current.jx = Math.abs(nx) < 0.18 ? 0 : nx;
    inputRef.current.jy = Math.abs(ny) < 0.18 ? 0 : ny;
  };
  const joyDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    joyPointer.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateJoy(e);
  };
  const joyMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joyPointer.current === e.pointerId) updateJoy(e);
  };
  const joyUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joyPointer.current !== e.pointerId) return;
    joyPointer.current = null;
    inputRef.current.jx = 0;
    inputRef.current.jy = 0;
    setJoyKnob({ x: 0, y: 0 });
  };
  const holdBtn = (key: "fire" | "raft", set: (v: boolean) => void) => ({
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      inputRef.current[key] = true;
      set(true);
    },
    onPointerUp: () => {
      inputRef.current[key] = false;
      set(false);
    },
    onPointerCancel: () => {
      inputRef.current[key] = false;
      set(false);
    }
  });
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      const req = document.documentElement.requestFullscreen?.();
      if (req) {
        req
          .then(() => {
            const so = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
            so.lock?.("landscape").catch(() => undefined);
          })
          .catch(() => undefined);
      }
    } else {
      document.exitFullscreen?.();
    }
  };

  const shuffledOptions = useMemo(() => (activeQuiz ? shuffle(activeQuiz.options) : []), [activeQuiz]);

  useEffect(() => {
    setWrongPicks([]);
    setSolved(false);
  }, [activeQuiz]);

  const resetGame = () => {
    const fresh = makeState(window.innerHeight / getZoom());
    stateRef.current = fresh;
    setPlayerHp(100);
    setKillCount(0);
    setTideLevel(100);
    setQuizzes(fresh.quizzes);
    setActiveQuiz(null);
    setShowSettings(false);
    setWrongAnswersCount(0);
    setGcd(1);
    setPhase("gameplay");
    AudioSys.startAmbient();
  };

  const answerQuiz = (opt: QuizOption, idx: number) => {
    if (!activeQuiz || solved) return;
    if (opt.isCorrect) {
      AudioSys.playTone(720, "sine", 0.3);
      setTimeout(() => AudioSys.playTone(960, "sine", 0.3), 120);
      setSolved(true);
    } else {
      AudioSys.playTone(180, "sawtooth", 0.35);
      setWrongPicks(prev => (prev.includes(idx) ? prev : [...prev, idx]));
      setWrongAnswersCount(prev => prev + 1);
      setShakeKey(k => k + 1);
      const st = stateRef.current;
      st.hp = Math.max(10, st.hp - 15);
      setPlayerHp(st.hp);
    }
  };

  const continueAfterQuiz = () => {
    if (!activeQuiz) return;
    const st = stateRef.current;
    st.quizzes = st.quizzes.map(q => (q.id === activeQuiz.id ? { ...q, cleared: true } : q));
    setQuizzes([...st.quizzes]);
    setActiveQuiz(null);
    AudioSys.playDrum();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const key = e.key.toLowerCase();
      if (key === "escape" && phase === "gameplay") {
        setShowSettings(prev => !prev);
        return;
      }
      if (key === "m") {
        setMuted(AudioSys.toggleMute());
        return;
      }
      if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key) && phase === "gameplay") e.preventDefault();
      stateRef.current.keys[key] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      stateRef.current.keys[e.key.toLowerCase()] = false;
    };
    const handleBlur = () => {
      stateRef.current.keys = {};
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [phase]);

  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();
    let uiSyncTick = 0;

    const renderLoop = (ts: number) => {
      animId = requestAnimationFrame(renderLoop);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Thu phóng theo kích thước màn hình: điện thoại nhìn được cùng một vùng chiến trường như máy tính
      const zoom = getZoom();
      const W = window.innerWidth / zoom;
      const H = window.innerHeight / zoom;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = Math.round(window.innerWidth * dpr);
      const ch = Math.round(window.innerHeight * dpr);
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
        canvas.style.width = `${window.innerWidth}px`;
        canvas.style.height = `${window.innerHeight}px`;
      }
      ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, 0, 0);
      UI_BOOST = Math.max(1, 0.85 / zoom);

      const st = stateRef.current;
      st.zoom = zoom;

      if (!st.isPaused) {
        const dt = Math.min(ts - lastTime, 33);
        lastTime = ts;
        const k = dt / 16.67;
        const keys = st.keys;

        // ---------- Di chuyển có quán tính ----------
        let ix = 0;
        let iy = 0;
        if (keys["arrowup"] || keys["w"]) iy -= 1;
        if (keys["arrowdown"] || keys["s"]) iy += 1;
        if (keys["arrowleft"] || keys["a"]) ix -= 1;
        if (keys["arrowright"] || keys["d"]) ix += 1;
        ix += inputRef.current.jx;
        iy += inputRef.current.jy;
        const mag = Math.hypot(ix, iy);
        if (mag > 1) {
          ix /= mag;
          iy /= mag;
        }
        if (ix < -0.2) st.facingLeft = true;
        if (ix > 0.2) st.facingLeft = false;
        const maxSp = 5.6;
        const ease = Math.min(1, 0.12 * k);
        st.vx += (ix * maxSp - st.vx) * ease;
        st.vy += (iy * maxSp - st.vy) * ease;
        st.isMoving = Math.hypot(st.vx, st.vy) > 0.6;

        // Đài chưa hoàn thành gần nhất (theo trục x) sẽ chặn đường bằng tường vô hình
        const lockedQuiz = st.quizzes.filter(q => !q.cleared).sort((a, b) => a.x - b.x)[0];
        const maxX = Math.min(WORLD_WIDTH - 65, lockedQuiz ? lockedQuiz.x + QUIZ_WALL_OFFSET : WORLD_WIDTH - 65);
        let nx = st.x + st.vx * k;
        if (nx > maxX) {
          if (lockedQuiz && ix > 0.2 && ts - st.lastWallMsg > 1200) {
            st.lastWallMsg = ts;
            addText(st, st.x, st.y - 50, tr(lang, "TRẢ LỜI ĐÚNG ĐỂ TIẾN TIẾP!", "ANSWER CORRECTLY TO PROCEED!"), "#FFD700", 16);
          }
          nx = maxX;
          st.vx = Math.min(0, st.vx);
        }
        if (nx < 65) {
          nx = 65;
          st.vx = Math.max(0, st.vx);
        }
        st.x = nx;
        const rawY = st.y + st.vy * k;
        st.y = clamp(rawY, 100, H - 100);
        if (st.y !== rawY) st.vy = 0;

        // Tới gần đài -> bắt buộc dừng lại và mở câu hỏi
        if (lockedQuiz && Math.abs(st.x - lockedQuiz.x) < QUIZ_TRIGGER_RANGE) {
          st.keys = {};
          st.vx = 0;
          st.vy = 0;
          st.isMoving = false;
          st.isPaused = true;
          AudioSys.playDrum();
          setActiveQuiz(lockedQuiz);
        }

        // ---------- Bắn tên / thả hỏa công (giữ phím để bắn liên tục) ----------
        if ((keys["j"] || keys[" "] || inputRef.current.fire) && ts - st.lastShot > ARROW_CD) {
          st.lastShot = ts;
          AudioSys.playArrow();
          const dir = st.facingLeft ? -1 : 1;
          let best: EnemyShip | null = null;
          let bestD = 720;
          for (const e of st.enemies) {
            if (e.dying > 0 || Math.sign(e.x - st.x) !== dir) continue;
            const d = Math.hypot(e.x - st.x, e.y - st.y);
            if (d < bestD) {
              best = e;
              bestD = d;
            }
          }
          const sp = 14;
          let vx = dir * sp;
          let vy = 0;
          if (best) {
            const base = dir === 1 ? 0 : Math.PI;
            const a = base + clamp(angleDiff(base, Math.atan2(best.y - st.y, best.x - st.x)), -0.4, 0.4);
            vx = Math.cos(a) * sp;
            vy = Math.sin(a) * sp;
          }
          st.projectiles.push({ id: Date.now() + Math.random(), x: st.x + dir * 52, y: st.y, vx, vy, type: "arrow", dmg: 2, life: 90 });
          for (let i = 0; i < 3; i++) {
            emit(st, { type: "spark", x: st.x + dir * 52, y: st.y, vx: dir * (1 + Math.random() * 2), vy: (Math.random() - 0.5) * 2, size: 2, decay: 0.08, color: "#FFE082" });
          }
        }
        if ((keys["g"] || inputRef.current.raft) && ts - st.lastRaft > RAFT_CD) {
          st.lastRaft = ts;
          AudioSys.playDrum();
          const dir = st.facingLeft ? -1 : 1;
          st.projectiles.push({ id: Date.now() + Math.random(), x: st.x - dir * 56, y: st.y, vx: -dir * 3.2, vy: 0, type: "firepot", dmg: 7, life: 260 });
        }

        // ---------- Vệt nước sau thuyền ----------
        if (st.isMoving && Math.random() < 0.8) {
          const dir = st.facingLeft ? -1 : 1;
          emit(st, { type: "wake", x: st.x - dir * 48, y: st.y + (Math.random() - 0.5) * 14, vx: -dir * (0.6 + Math.random()), vy: (Math.random() - 0.5) * 0.5, size: 4 + Math.random() * 5, alpha: 0.7, decay: 0.02, color: "#E0F7FA" });
          if (Math.random() < 0.5) {
            emit(st, { type: "splash", x: st.x + dir * 54, y: st.y + (Math.random() > 0.5 ? 8 : -8), vx: dir * 0.4, vy: (Math.random() - 0.5) * 1.4, size: 1.6 + Math.random() * 1.6, alpha: 0.8, decay: 0.07, color: "#FFFFFF" });
          }
        }
        if (ts - st.lastRipple > 450) {
          st.lastRipple = ts;
          emit(st, { type: "wake", x: st.cameraX + Math.random() * W, y: 100 + Math.random() * (H - 200), size: 2, alpha: 0.35, decay: 0.008, color: "#E0F7FA" });
        }
        for (const c of CAMPS) {
          if (c.x > st.cameraX - 50 && c.x < st.cameraX + W + 50 && Math.random() < 0.18) {
            emit(st, { type: "ember", x: c.x + (Math.random() - 0.5) * 12, y: c.top ? 36 : H - 36, vx: 0.2 + Math.random() * 0.4, vy: -0.4 - Math.random() * 0.6, size: 1.6, alpha: 1, decay: 0.012, color: "#FFAB40" });
          }
        }

        // ---------- Thủy triều ----------
        st.tide += st.tideDir * k;
        if (st.tide <= 10) {
          st.tide = 10;
          st.tideDir = 0.032;
        } else if (st.tide >= 100) {
          st.tide = 100;
          st.tideDir = -0.05;
        }
        const isLowTide = st.tide <= 50;
        st.tint += ((isLowTide ? 1 : 0) - st.tint) * Math.min(1, 0.02 * k);

        // ---------- Sinh thuyền địch ----------
        const alive = st.enemies.filter(e => e.dying === 0).length;
        if (ts - st.lastSpawn > 3400 && alive < 5) spawnEnemy(st, W, H, ts);

        // ---------- Trống trận ----------
        if (alive > 0 && ts - st.lastBeat > 2600) {
          st.lastBeat = ts;
          AudioSys.playDrum(0.28);
        }

        // ---------- AI thuyền địch ----------
        for (const e of st.enemies) {
          const stat = ENEMY_STATS[e.shipClass];
          e.flash = Math.max(0, e.flash - dt / 220);

          if (e.dying > 0) {
            e.dying += 0.012 * k;
            if (Math.random() < 0.3) {
              emit(st, { type: "bubble", x: e.x + (Math.random() - 0.5) * 60, y: e.y + (Math.random() - 0.5) * 24, vy: -0.4, size: 2 + Math.random() * 3, alpha: 0.7, decay: 0.02, color: "#B2EBF2" });
            }
            continue;
          }

          const dxp = st.x - e.x;
          const dyp = st.y - e.y;
          const dist = Math.hypot(dxp, dyp);

          if (!e.impaled) {
            const desired = Math.atan2(dyp, dxp);
            e.angle += clamp(angleDiff(e.angle, desired), -stat.turn * k, stat.turn * k);
            let spd = e.speed;
            if (stat.keep > 0 && dist < stat.keep) spd *= clamp((dist - stat.keep * 0.6) / (stat.keep * 0.4), 0, 1);
            e.x += Math.cos(e.angle) * spd * k;
            e.y += Math.sin(e.angle) * spd * k;
            if (Math.random() < 0.35) {
              emit(st, { type: "wake", x: e.x - Math.cos(e.angle) * 50 * stat.scale, y: e.y - Math.sin(e.angle) * 50 * stat.scale, size: 3 + Math.random() * 4, alpha: 0.5, decay: 0.025, color: "#CFD8DC" });
            }
          }
          e.x = clamp(e.x, 60, WORLD_WIDTH - 60);
          e.y = clamp(e.y, 100, H - 100);

          // tách nhau ra
          for (const o of st.enemies) {
            if (o === e || o.dying > 0) continue;
            const dd = Math.hypot(o.x - e.x, o.y - e.y);
            const minD = 62 * (stat.scale + ENEMY_STATS[o.shipClass].scale) * 0.5;
            if (dd > 0.1 && dd < minD) {
              e.x -= ((o.x - e.x) / dd) * 0.8 * k;
              e.y -= ((o.y - e.y) / dd) * 0.8 * k;
            }
          }

          // địch bắn tên
          if (stat.shootCd > 0 && dist < 650 && ts - e.lastShot > stat.shootCd) {
            e.lastShot = ts + Math.random() * 500;
            AudioSys.playArrow(0.35);
            const base = Math.atan2(dyp, dxp);
            for (let v = 0; v < stat.volley; v++) {
              const a = base + (v - (stat.volley - 1) / 2) * 0.13 + (Math.random() - 0.5) * 0.08;
              st.projectiles.push({ id: Date.now() + Math.random() + v, x: e.x + Math.cos(base) * 50 * stat.scale, y: e.y + Math.sin(base) * 50 * stat.scale, vx: Math.cos(a) * 7.5, vy: Math.sin(a) * 7.5, type: "enemyArrow", dmg: stat.dmg, life: 110 });
            }
            for (let i = 0; i < 4; i++) {
              emit(st, { type: "smoke", x: e.x + Math.cos(base) * 50 * stat.scale, y: e.y + Math.sin(base) * 50 * stat.scale, vx: (Math.random() - 0.5) * 0.8, vy: (Math.random() - 0.5) * 0.8, size: 4, alpha: 0.5, decay: 0.05, color: "#90A4AE" });
            }
          }

          // cháy
          if (e.burning > 0) {
            e.burning -= dt;
            e.burnTick += dt;
            if (e.burnTick > 500) {
              e.burnTick = 0;
              damageEnemy(st, e, 1, lang);
            }
            if (Math.random() < 0.6) {
              emit(st, { type: "fire", x: e.x + (Math.random() - 0.5) * 50 * stat.scale, y: e.y + (Math.random() - 0.5) * 20 * stat.scale, vx: (Math.random() - 0.5) * 0.8, vy: -1 - Math.random(), size: 5 + Math.random() * 6, alpha: 0.9, decay: 0.035, color: Math.random() > 0.4 ? "#FF5722" : "#FFEA00" });
            }
          }
          if (e.hp / e.maxHp < 0.4 && Math.random() < 0.15) {
            emit(st, { type: "smoke", x: e.x + (Math.random() - 0.5) * 30, y: e.y + (Math.random() - 0.5) * 14, vx: 0.2, vy: -0.7, size: 6, alpha: 0.6, decay: 0.015, color: "#455A64" });
          }

          // mắc cọc ngầm khi nước ròng
          if (isLowTide) {
            const hitR = 30 + 8 * stat.scale;
            const hitStake = INITIAL_STAKES.find(sk => Math.hypot(sk.x - e.x, sk.y - e.y) < hitR);
            if (hitStake) {
              if (!e.impaled) {
                e.impaled = true;
                AudioSys.playCrash();
                st.shake = Math.max(st.shake, 7);
                for (let i = 0; i < 10; i++) {
                  emit(st, { type: "debris", x: e.x, y: e.y, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4, size: 2 + Math.random() * 3, decay: 0.02, color: "#4E342E" });
                }
                addText(st, e.x, e.y - 40, tr(lang, "MẮC CỌC NGẦM ĐÂM THỦNG!", "IMPALED ON STAKES!"), "#FF5722", 16);
              }
              if (Math.random() < 0.7) {
                emit(st, { type: "fire", x: e.x + (Math.random() - 0.5) * 40, y: e.y + (Math.random() - 0.5) * 18, vx: (Math.random() - 0.5) * 1.2, vy: -1 - Math.random() * 1.5, size: 5 + Math.random() * 8, alpha: 0.9, decay: 0.03, color: Math.random() > 0.4 ? "#FF5722" : "#FFEA00" });
              }
              if (ts - e.lastDamageTick > 450) {
                e.lastDamageTick = ts;
                damageEnemy(st, e, 3, lang);
              }
            }
          } else if (e.impaled) {
            e.impaled = false;
          }

          // húc thuyền người chơi
          const ramR = 26 + 26 * stat.scale;
          if (dist < ramR) {
            const a = Math.atan2(dyp, dxp);
            if (st.invuln <= 0) {
              hurtPlayer(st, stat.ram, lang);
              damageEnemy(st, e, 4, lang);
              st.vx += Math.cos(a) * 7;
              st.vy += Math.sin(a) * 7;
              e.x -= Math.cos(a) * 16;
              e.y -= Math.sin(a) * 16;
            } else {
              e.x -= Math.cos(a) * 1.2 * k;
              e.y -= Math.sin(a) * 1.2 * k;
            }
          }
        }

        // ---------- Đạn ----------
        for (const proj of st.projectiles) {
          proj.x += proj.vx * k;
          proj.y += proj.vy * k;
          proj.life -= k;
          if (proj.type === "firepot") {
            proj.y += Math.sin(ts * 0.006 + proj.id) * 0.25 * k;
            emit(st, { type: "fire", x: proj.x + (Math.random() - 0.5) * 20, y: proj.y + (Math.random() - 0.5) * 12, vx: (Math.random() - 0.5) * 0.6, vy: -1 - Math.random(), size: 6 + Math.random() * 5, alpha: 0.9, decay: 0.045, color: Math.random() > 0.5 ? "#FF6D00" : "#FFEA00" });
            if (Math.random() < 0.3) emit(st, { type: "smoke", x: proj.x, y: proj.y - 6, vy: -0.6, size: 5, alpha: 0.5, decay: 0.02, color: "#37474F" });
          } else if (proj.type === "arrow") {
            emit(st, { type: "spark", x: proj.x, y: proj.y, vx: -proj.vx * 0.05, vy: (Math.random() - 0.5) * 0.4, size: 2, alpha: 0.7, decay: 0.12, color: "#FFE082" });
          }

          if (proj.type === "enemyArrow") {
            if (st.invuln <= 0 && Math.hypot(proj.x - st.x, proj.y - st.y) < 32) {
              hurtPlayer(st, proj.dmg, lang);
              proj.life = 0;
            }
            continue;
          }

          for (const e of st.enemies) {
            if (e.dying > 0 || proj.life <= 0) continue;
            const s = ENEMY_STATS[e.shipClass].scale;
            const hitR = proj.type === "firepot" ? 26 + 24 * s : 16 + 24 * s;
            if (Math.hypot(e.x - proj.x, e.y - proj.y) < hitR) {
              if (proj.type === "firepot") {
                explodeFirepot(st, proj.x, proj.y, lang);
                proj.life = -999;
              } else {
                damageEnemy(st, e, proj.dmg, lang);
                proj.life = 0;
                for (let i = 0; i < 7; i++) {
                  emit(st, { type: "spark", x: proj.x, y: proj.y, vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5, size: 2 + Math.random() * 3, decay: 0.06, color: "#FFD600" });
                }
              }
            }
          }
        }
        for (const p of st.projectiles) {
          if (p.type === "firepot" && p.life <= 0 && p.life > -500) explodeFirepot(st, p.x, p.y, lang);
        }
        st.projectiles = st.projectiles.filter(p => p.life > 0 && p.x > 0 && p.x < WORLD_WIDTH);

        if (st.hp <= 0) setPhase("defeat");

        // ---------- Cập nhật hạt / chữ nổi ----------
        for (const p of st.particles) {
          p.x += p.vx * k;
          p.y += p.vy * k;
          p.alpha -= p.decay * k;
          if (p.type === "shockwave") p.size += 3 * k;
          else if (p.type === "wake") p.size += 0.22 * k;
          else if (p.type === "smoke") p.size += 0.3 * k;
          else if (p.type === "debris") {
            p.vx *= 0.97;
            p.vy *= 0.97;
          }
        }
        st.particles = st.particles.filter(p => p.alpha > 0);
        if (st.particles.length > 520) st.particles = st.particles.slice(-520);

        for (const ft of st.floatingTexts) {
          ft.y -= 0.8 * k;
          ft.alpha -= 0.016 * k;
        }
        st.floatingTexts = st.floatingTexts.filter(ft => ft.alpha > 0);
        st.enemies = st.enemies.filter(e => e.dying < 1);

        st.invuln = Math.max(0, st.invuln - dt);
        st.flash = Math.max(0, st.flash - dt / 350);
        st.shake *= Math.pow(0.9, k);
        if (st.shake < 0.3) st.shake = 0;

        // ---------- Camera mượt ----------
        const targetCam = clamp(st.x - W * 0.38 + st.vx * 10, 0, Math.max(0, WORLD_WIDTH - W));
        st.cameraX += (targetCam - st.cameraX) * Math.min(1, 0.1 * k);

        if (st.kills >= TARGET_KILLS && st.quizzes.every(q => q.cleared) && st.hp > 0) setPhase("victory");

        uiSyncTick++;
        if (uiSyncTick % 4 === 0) {
          setPlayerHp(Math.round(st.hp));
          setKillCount(st.kills);
          setTideLevel(st.tide);
          setGcd(Math.min(1, (ts - st.lastRaft) / RAFT_CD));
        }
      } else {
        lastTime = ts;
      }

      // ==================== VẼ ====================
      ctx.clearRect(0, 0, W, H);
      drawWaterBase(ctx, W, H, st);

      const sh = st.isPaused ? 0 : st.shake;
      ctx.save();
      ctx.translate(-st.cameraX + (Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);

      drawWaves(ctx, W, H, st, ts);
      drawBank(ctx, W, H, st, ts, true);
      drawBank(ctx, W, H, st, ts, false);
      drawStakeZone(ctx, H, st, lang);

      for (const stake of INITIAL_STAKES) {
        if (stake.x > st.cameraX - 60 && stake.x < st.cameraX + W + 60) drawStake(ctx, stake.x, stake.y, st.tide, ts);
      }

      for (const q of st.quizzes) drawQuizStation(ctx, q, ts, lang, H);

      // tường vô hình: chỉ hiện mờ khi tới gần
      const wallQuiz = st.quizzes.filter(q => !q.cleared).sort((a, b) => a.x - b.x)[0];
      if (wallQuiz) {
        const wx = wallQuiz.x + QUIZ_WALL_OFFSET;
        const dist = Math.abs(st.x - wx);
        if (dist < 220) {
          ctx.save();
          ctx.globalAlpha = (1 - dist / 220) * 0.5;
          ctx.strokeStyle = "#FFD700";
          ctx.setLineDash([6, 10]);
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(wx, 90);
          ctx.lineTo(wx, H - 90);
          ctx.stroke();
          ctx.restore();
        }
      }

      drawParticles(ctx, st, "under");
      for (const e of st.enemies) drawNamHanWarship(ctx, e, ts, lang);
      drawNgoQuyenShip(ctx, st, ts);
      for (const proj of st.projectiles) drawProjectile(ctx, proj, ts);
      drawParticles(ctx, st, "over");

      for (const ft of st.floatingTexts) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, ft.alpha));
        ctx.font = `bold ${ft.size * UI_BOOST}px ${UI_FONT}`;
        ctx.fillStyle = ft.color;
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 4;
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.strokeText(ft.text, ft.x, ft.y);
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      }
      ctx.restore();

      drawAtmosphere(ctx, W, H, st, ts);
      if (st.hud) drawMinimap(ctx, W, H, st, lang);
    };

    animId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animId);
  }, [lang]);

  const isLowTide = tideLevel <= 50;
  const clearedCount = quizzes.filter(q => q.cleared).length;
  const hullColor = playerHp > 60 ? "linear-gradient(90deg,#2E7D32,#66BB6A)" : playerHp > 30 ? "linear-gradient(90deg,#F9A825,#FFD54F)" : "linear-gradient(90deg,#B71C1C,#FF5252)";
  const objective =
    clearedCount < quizzes.length
      ? tr(lang, "Tiến về Đài Lệnh Kỳ tiếp theo, vừa đi vừa diệt thuyền giặc", "Advance to the next Station while sinking enemy ships")
      : tr(lang, "Dụ giặc vào bãi cọc lúc nước ròng để tiêu diệt hạm đội", "Lure the fleet into the stakes at low tide to destroy it");
  const stars = playerHp >= 70 && wrongAnswersCount <= 1 ? 3 : playerHp >= 40 ? 2 : 1;
  const quizIndex = activeQuiz ? quizzes.findIndex(q => q.id === activeQuiz.id) + 1 : 0;

  const overlay: React.CSSProperties = { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: compact ? 10 : 24, fontFamily: UI_FONT };
  const primaryBtn: React.CSSProperties = { padding: "14px 40px", fontSize: 15, fontWeight: 700, letterSpacing: 1.5, background: "linear-gradient(180deg,#B71C1C,#7F1313)", color: "#FFE9A8", border: "1.5px solid #D4AF37", borderRadius: 6, cursor: "pointer", fontFamily: UI_FONT };
  const darkBtn: React.CSSProperties = { ...primaryBtn, background: "linear-gradient(180deg,#2a3340,#171d26)" };
  const greenBtn: React.CSSProperties = { ...primaryBtn, background: "linear-gradient(180deg,#2E7D32,#1B5E20)" };

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#05070A", fontFamily: UI_FONT, userSelect: "none", WebkitUserSelect: "none", touchAction: "manipulation" }}>
      <style>{GLOBAL_CSS}</style>
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, display: "block", touchAction: "none" }} />

      {/* Nhắc xoay ngang trên điện thoại */}
      {touchMode && portrait && (
        <div style={{ position: "absolute", top: "calc(8px + env(safe-area-inset-top, 0px))", left: "50%", transform: "translateX(-50%)", zIndex: 130, pointerEvents: "none", background: "rgba(10,8,6,.9)", border: "1px solid #D4AF37", color: "#FFE9A8", padding: "6px 14px", borderRadius: 16, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
          📱 {tr(lang, "Xoay ngang màn hình để chơi tốt nhất", "Rotate to landscape for the best experience")}
        </div>
      )}

      {/* CHỌN NGÔN NGỮ */}
      {phase === "language" && (
        <div style={{ ...overlay, background: "radial-gradient(ellipse at center, rgba(5,10,16,0.78), rgba(2,4,6,0.97))", zIndex: 100 }}>
          <div className="bd-panel" style={{ padding: compact ? "26px 24px" : "52px 70px", maxWidth: "100%", textAlign: "center", animation: "bd-fadein .7s ease both", borderRadius: 4 }}>
            <div style={{ color: "#D4AF37", fontSize: 12, letterSpacing: 4, marginBottom: 14, fontWeight: 600 }}>DỰ ÁN LỊCH SỬ VIỆT NAM · 938 AD</div>
            <h1 style={{ color: "#FFF1CC", fontSize: compact ? 34 : 58, margin: "0 0 6px 0", letterSpacing: compact ? 1 : 3, fontFamily: TITLE_FONT, fontWeight: 700, animation: "bd-glow 3s ease-in-out infinite" }}>ĐẠI THẮNG BẠCH ĐẰNG</h1>
            <div style={{ width: 220, height: 2, margin: "10px auto 14px", background: "linear-gradient(90deg,transparent,#D4AF37,transparent)" }} />
            <p style={{ color: "#B9B196", fontSize: 20, fontStyle: "italic", marginBottom: 38, fontFamily: TITLE_FONT }}>Ngô Quyền phá quân Nam Hán</p>
            <div style={{ display: "flex", gap: 20, justifyContent: "center" }}>
              <button className="bd-btn" onClick={() => { AudioSys.playDrum(); setLang("vi"); setPhase("menu"); }} style={primaryBtn}>TIẾNG VIỆT</button>
              <button className="bd-btn" onClick={() => { AudioSys.playDrum(); setLang("en"); setPhase("menu"); }} style={darkBtn}>ENGLISH</button>
            </div>
          </div>
        </div>
      )}

      {/* MENU CHÍNH */}
      {phase === "menu" && (
        <div style={{ ...overlay, background: "radial-gradient(ellipse at center, rgba(8,12,18,0.7), rgba(3,5,8,0.94))", zIndex: 100 }}>
          <div className="bd-panel" style={{ maxWidth: 700, maxHeight: "94vh", overflowY: "auto", touchAction: "pan-y", padding: compact ? "18px 22px" : "42px 52px", textAlign: "center", animation: "bd-fadein .6s ease both", borderRadius: 4 }}>
            <h1 style={{ color: "#D4AF37", fontSize: compact ? 24 : 40, margin: "0 0 12px 0", fontFamily: TITLE_FONT, fontWeight: 700, letterSpacing: 1.5 }}>{tr(lang, "MẬT LỆNH BẠCH ĐẰNG (NĂM 938)", "BACH DANG BATTLE ORDERS (938 AD)")}</h1>
            <p style={{ color: "#E5E0D0", fontSize: compact ? 13 : 15.5, lineHeight: compact ? 1.6 : 1.75, marginBottom: compact ? 14 : 24 }}>
              {tr(
                lang,
                "Lãnh đạo hạm đội thuyền Mông Đồng của Ngô Quyền. Khi NƯỚC LỚN, nhử quân Nam Hán của Lưu Hoằng Tháo lọt vào cửa sông. Khi NƯỚC RÒNG (dưới 50%), bãi cọc nhọn bịt sắt sẽ đâm thủng thuyền giặc. Mỗi khi tới Đài Lệnh Kỳ, thuyền sẽ dừng lại và phải trả lời đúng câu hỏi lịch sử mới được tiến tiếp. Hoàn thành 3 Đài Lệnh Kỳ để lập nên chiến công vĩ đại!",
                "Lead Ngo Quyen's fleet. During HIGH TIDE, lure the Southern Han fleet of Luu Hoang Thao into the river mouth. When LOW TIDE strikes (below 50%), the iron-tipped stakes will impale the enemy ships. At each Historical Station your ship must stop and answer the question correctly before it can advance. Clear 3 Stations to secure victory!"
              )}
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: compact ? 12 : 22, flexWrap: "wrap", marginBottom: compact ? 16 : 28, color: "#CFC7A8", fontSize: compact ? 12 : 12.5 }}>
              {touchMode ? (
                <>
                  <span>🕹 {tr(lang, "Cần gạt trái: chèo thuyền", "Left stick: steer")}</span>
                  <span>🏹 {tr(lang, "Nút BẮN: bắn tên (giữ để bắn liên tục)", "FIRE: arrows (hold to rapid-fire)")}</span>
                  <span>🔥 {tr(lang, "Nút LỬA: thả bè hỏa công", "RAFT: fire raft")}</span>
                </>
              ) : (
                <>
              <span><Key>W A S D</Key>{tr(lang, "Chèo thuyền", "Move")}</span>
              <span><Key>J</Key>{tr(lang, "Bắn tên (giữ để bắn liên tục)", "Arrows (hold to rapid-fire)")}</span>
              <span><Key>G</Key>{tr(lang, "Thả bè hỏa công", "Fire raft")}</span>
              <span><Key>M</Key>{tr(lang, "Tắt/bật âm", "Mute")}</span>
            </>
              )}
            </div>
            <button className="bd-btn" onClick={resetGame} style={{ ...primaryBtn, padding: compact ? "12px 36px" : "16px 54px", fontSize: compact ? 15 : 17 }}>{tr(lang, "PHẤT CỜ XUẤT KÍCH", "LAUNCH CAMPAIGN")}</button>
          </div>
        </div>
      )}

      {/* HUD TRONG TRẬN */}
      {phase === "gameplay" && (
        <>
          <div className="bd-panel" style={{ position: "absolute", top: "calc(12px + env(safe-area-inset-top, 0px))", left: "calc(12px + env(safe-area-inset-left, 0px))", width: compact ? 190 : 270, padding: compact ? "8px 10px" : "12px 14px", borderRadius: 6, zIndex: 40, color: "#F5F0E6" }}>
            <div style={LABEL}>⚓ {compact ? tr(lang, "ĐỘ BỀN", "HULL") : tr(lang, "ĐỘ BỀN THUYỀN", "HULL INTEGRITY")}</div>
            <div style={{ position: "relative", height: compact ? 13 : 16, background: "#14110c", border: "1px solid #5b4a22", borderRadius: 4, overflow: "hidden", marginBottom: compact ? 6 : 10 }}>
              <div style={{ width: `${playerHp}%`, height: "100%", background: hullColor, transition: "width .25s" }} />
              <div style={{ position: "absolute", inset: 0, textAlign: "center", fontSize: 11, fontWeight: 700, lineHeight: compact ? "13px" : "16px", textShadow: "0 1px 2px #000" }}>{playerHp}%</div>
            </div>
            {compact ? (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, color: "#FFE9A8" }}>
                <span>⚔ {killCount}/{TARGET_KILLS}</span>
                <span>📜 {clearedCount}/{quizzes.length}</span>
              </div>
            ) : (
              <>
                <div style={LABEL}>⚔ {tr(lang, "THUYỀN GIẶC ĐÃ DIỆT", "ENEMIES SUNK")} · {killCount}/{TARGET_KILLS}</div>
                <div style={{ display: "flex", gap: 3, marginBottom: 10 }}>
                  {Array.from({ length: TARGET_KILLS }).map((_, i) => (
                    <div key={i} style={{ flex: 1, height: 8, borderRadius: 2, background: i < killCount ? "linear-gradient(180deg,#FFD54F,#FF8F00)" : "#1d1a12", border: "1px solid #5b4a22" }} />
                  ))}
                </div>
                <div style={LABEL}>📜 {tr(lang, "ĐÀI LỆNH KỲ", "STATIONS")} · {clearedCount}/{quizzes.length}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                  {quizzes.map(q => (
                    <div key={q.id} style={{ width: 13, height: 13, transform: "rotate(45deg)", margin: "4px 5px", background: q.cleared ? "linear-gradient(135deg,#43A047,#1B5E20)" : "#1d1a12", border: `1.5px solid ${q.cleared ? "#00E676" : "#8A6D2F"}`, boxShadow: q.cleared ? "0 0 8px rgba(0,230,118,.6)" : "none" }} />
                  ))}
                </div>
              </>
            )}
          </div>

          <div style={{ position: "absolute", top: "calc(12px + env(safe-area-inset-top, 0px))", left: compact ? 214 : 0, right: compact ? (canFs ? 172 : 124) : 0, display: "flex", justifyContent: "center", pointerEvents: "none", zIndex: 40 }}>
            <div className="bd-panel" style={{ width: "100%", maxWidth: compact ? 340 : 380, padding: compact ? "6px 12px 7px" : "10px 18px 12px", borderRadius: 6, textAlign: "center", color: "#F5F0E6" }}>
              <div style={{ color: "#D4AF37", fontSize: compact ? 11 : 12, fontWeight: 700, letterSpacing: 1.5, marginBottom: compact ? 4 : 6 }}>🌊 {tr(lang, "THỦY TRIỀU", "TIDE LEVEL")}: {tideLevel.toFixed(0)}%</div>
              <div style={{ position: "relative", height: compact ? 11 : 14, background: "#0b141b", border: "1px solid #5b4a22", borderRadius: 7, overflow: "hidden" }}>
                <div style={{ width: `${tideLevel}%`, height: "100%", background: isLowTide ? "linear-gradient(90deg,#B71C1C,#FF6F00)" : "linear-gradient(90deg,#0277BD,#26C6DA)" }} />
                <div style={{ position: "absolute", inset: 0, width: `${tideLevel}%`, backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,.18) 0 6px, transparent 6px 12px)", animation: "bd-wave 1.4s linear infinite" }} />
                <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 2, background: "#FFF8E1", opacity: 0.85 }} />
              </div>
              <div style={{ color: isLowTide ? "#FFAB00" : "#80DEEA", fontSize: compact ? 10.5 : 12, fontWeight: 700, marginTop: compact ? 4 : 7 }}>
                {isLowTide ? tr(lang, "⚡ NƯỚC RÒNG: CỌC LỘ DIỆN - ĐÂM THỦNG ĐỊCH!", "⚡ LOW TIDE: STAKES EXPOSED!") : tr(lang, "NƯỚC LỚN: CỌC ĐANG ẨN DƯỚI NƯỚC", "HIGH TIDE: STAKES HIDDEN")}
              </div>
              {!compact && <div style={{ color: "#B9B196", fontSize: 11, marginTop: 5, fontStyle: "italic" }}>{objective}</div>}
            </div>
          </div>

          <div style={{ position: "absolute", top: "calc(12px + env(safe-area-inset-top, 0px))", right: "calc(12px + env(safe-area-inset-right, 0px))", display: "flex", gap: 8, zIndex: 40 }}>
            <button className="bd-btn bd-panel" onClick={() => setMuted(AudioSys.toggleMute())} style={{ width: 42, height: 42, borderRadius: 6, color: "#FFE9A8", fontSize: 18, cursor: "pointer" }}>{muted ? "🔇" : "🔊"}</button>
            {canFs && <button className="bd-btn bd-panel" onClick={toggleFullscreen} style={{ width: 42, height: 42, borderRadius: 6, color: "#FFE9A8", fontSize: 18, cursor: "pointer" }}>⛶</button>}
            <button className="bd-btn bd-panel" onClick={() => setShowSettings(true)} style={{ width: 42, height: 42, borderRadius: 6, color: "#FFE9A8", fontSize: 16, cursor: "pointer" }}>⏸</button>
          </div>

          {!touchMode && (
            <div className="bd-panel" style={{ position: "absolute", bottom: 20, left: 16, padding: "9px 14px", borderRadius: 6, zIndex: 40, color: "#CFC7A8", fontSize: 12, display: "flex", gap: 16, alignItems: "center" }}>
              <span><Key>W A S D</Key>{tr(lang, "Chèo", "Move")}</span>
              <span><Key>J</Key>{tr(lang, "Bắn tên", "Arrow")}</span>
              <span style={{ position: "relative" }}>
                <Key>G</Key>{tr(lang, "Hỏa công", "Fire raft")}
                <div style={{ position: "absolute", left: 0, right: 0, bottom: -6, height: 3, background: "#1d1a12", borderRadius: 2 }}>
                  <div style={{ width: `${gcd * 100}%`, height: "100%", background: gcd >= 1 ? "#FF9800" : "#6d5a2c", borderRadius: 2 }} />
                </div>
              </span>
              <span><Key>ESC</Key>{tr(lang, "Tạm dừng", "Pause")}</span>
            </div>
          )}

          {/* ĐIỀU KHIỂN CẢM ỨNG */}
          {touchMode && (
            <>
              <div
                onPointerDown={joyDown}
                onPointerMove={joyMove}
                onPointerUp={joyUp}
                onPointerCancel={joyUp}
                style={{ position: "absolute", left: "calc(22px + env(safe-area-inset-left, 0px))", bottom: "calc(22px + env(safe-area-inset-bottom, 0px))", width: joySize, height: joySize, borderRadius: "50%", background: "radial-gradient(circle, rgba(212,175,55,.12), rgba(10,8,6,.5))", border: "2px solid rgba(212,175,55,.6)", touchAction: "none", zIndex: 45, WebkitUserSelect: "none" }}
              >
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,233,168,.35)", fontSize: 18, pointerEvents: "none" }}>✥</div>
                <div style={{ position: "absolute", left: "50%", top: "50%", width: joySize * 0.42, height: joySize * 0.42, marginLeft: -joySize * 0.21 + joyKnob.x, marginTop: -joySize * 0.21 + joyKnob.y, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, #F3D98A, #8A6D2F)", border: "2px solid #FFE9A8", boxShadow: "0 4px 12px rgba(0,0,0,.6)", pointerEvents: "none" }} />
              </div>

              <div
                {...holdBtn("raft", setRaftDown)}
                style={{ position: "absolute", right: `calc(${(compact ? 84 : 98) + 34}px + env(safe-area-inset-right, 0px))`, bottom: "calc(30px + env(safe-area-inset-bottom, 0px))", width: compact ? 60 : 68, height: compact ? 60 : 68, borderRadius: "50%", padding: 4, boxSizing: "border-box", background: `conic-gradient(${gcd >= 1 ? "#FF9800" : "#8A6D2F"} ${gcd * 360}deg, rgba(0,0,0,.55) 0deg)`, touchAction: "none", zIndex: 45, transform: raftDown ? "scale(.92)" : "none", WebkitUserSelect: "none" }}
              >
                <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: gcd >= 1 ? "radial-gradient(circle at 35% 30%, #FF8A3D, #8E2A06)" : "radial-gradient(circle at 35% 30%, #5b4630, #2a1f14)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#FFE9A8", fontWeight: 700, fontSize: 10, pointerEvents: "none" }}>
                  <span style={{ fontSize: 20 }}>🔥</span>
                  {tr(lang, "LỬA", "RAFT")}
                </div>
              </div>

              <div
                {...holdBtn("fire", setFireDown)}
                style={{ position: "absolute", right: "calc(22px + env(safe-area-inset-right, 0px))", bottom: "calc(22px + env(safe-area-inset-bottom, 0px))", width: compact ? 84 : 98, height: compact ? 84 : 98, borderRadius: "50%", background: fireDown ? "radial-gradient(circle at 35% 30%, #E53935, #7F1313)" : "radial-gradient(circle at 35% 30%, #C62828, #5E0E0E)", border: "3px solid #D4AF37", boxShadow: "0 6px 16px rgba(0,0,0,.6)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#FFE9A8", fontWeight: 700, fontSize: 12, touchAction: "none", zIndex: 45, transform: fireDown ? "scale(.93)" : "none", WebkitUserSelect: "none" }}
              >
                <span style={{ fontSize: 28, pointerEvents: "none" }}>🏹</span>
                <span style={{ pointerEvents: "none" }}>{tr(lang, "BẮN", "FIRE")}</span>
              </div>
            </>
          )}
        </>
      )}

      {/* CÂU HỎI LỊCH SỬ (BẮT BUỘC TRẢ LỜI ĐÚNG ĐỂ ĐI TIẾP) */}
      {activeQuiz && (
        <div style={{ ...overlay, background: "rgba(3,5,9,0.86)", zIndex: 80 }}>
          <div className="bd-panel" style={{ maxWidth: 660, width: "100%", maxHeight: "94vh", overflowY: "auto", touchAction: "pan-y", padding: compact ? "16px 18px" : "30px 34px", color: "#FFF8E7", borderRadius: 6, animation: "bd-fadein .35s ease both" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ color: "#D4AF37", fontSize: 11, fontWeight: 700, letterSpacing: 2 }}>{tr(lang, activeQuiz.title_vi, activeQuiz.title_en).toUpperCase()}</div>
              <div style={{ color: "#FFD54F", fontSize: 11, fontWeight: 700, padding: "3px 10px", border: "1px solid #8A6D2F", borderRadius: 12 }}>{tr(lang, "ĐÀI", "STATION")} {quizIndex}/{quizzes.length}</div>
            </div>
            <h2 style={{ fontSize: compact ? 18 : 24, lineHeight: 1.45, margin: compact ? "0 0 12px 0" : "0 0 22px 0", color: "#FFF", fontFamily: TITLE_FONT, fontWeight: 700 }}>{tr(lang, activeQuiz.question_vi, activeQuiz.question_en)}</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {shuffledOptions.map((opt, idx) => {
                const wrong = wrongPicks.includes(idx);
                const right = solved && opt.isCorrect;
                return (
                  <button
                    key={idx}
                    className="bd-btn"
                    disabled={wrong || solved}
                    onClick={() => answerQuiz(opt, idx)}
                    style={{ display: "flex", alignItems: "center", gap: 14, textAlign: "left", padding: compact ? "10px 12px" : "13px 16px", background: right ? "linear-gradient(180deg,#1B5E20,#12401a)" : wrong ? "linear-gradient(180deg,#5a1414,#3a0d0d)" : "linear-gradient(180deg,#222b3a,#161c27)", color: wrong ? "#bb8a8a" : "#F5F0E6", border: `1px solid ${right ? "#00E676" : wrong ? "#B71C1C" : "#8A6D2F"}`, borderRadius: 6, fontSize: compact ? 13.5 : 15, fontFamily: UI_FONT, opacity: solved && !right ? 0.45 : 1, textDecoration: wrong ? "line-through" : "none" }}
                  >
                    <span style={{ minWidth: 28, height: 28, borderRadius: "50%", background: right ? "#00C853" : wrong ? "#B71C1C" : "#3a3326", border: "1px solid #D4AF37", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13 }}>
                      {right ? "✓" : wrong ? "✕" : String.fromCharCode(65 + idx)}
                    </span>
                    {tr(lang, opt.text_vi, opt.text_en)}
                  </button>
                );
              })}
            </div>
            {wrongPicks.length > 0 && !solved && (
              <div key={shakeKey} style={{ marginTop: 16, padding: "10px 14px", background: "rgba(183,28,28,.2)", border: "1px solid #B71C1C", borderRadius: 6, color: "#FF8A80", fontSize: 13, animation: "bd-shake .4s" }}>
                {tr(lang, "Chưa chính xác! Thuyền bị mất 15% độ bền. Hãy suy nghĩ lại và chọn đáp án khác.", "Incorrect! Your hull loses 15%. Think again and pick another answer.")}
              </div>
            )}
            {solved && (
              <div style={{ marginTop: 18, animation: "bd-fadein .4s ease both" }}>
                <div style={{ padding: "12px 16px", background: "rgba(46,125,50,.18)", border: "1px solid #2E7D32", borderRadius: 6, color: "#C8E6C9", fontSize: 14, lineHeight: 1.65 }}>
                  <strong style={{ color: "#69F0AE" }}>{tr(lang, "Chính xác! ", "Correct! ")}</strong>
                  {tr(lang, activeQuiz.explanation_vi, activeQuiz.explanation_en)}
                </div>
                <div style={{ textAlign: "right", marginTop: 14 }}>
                  <button className="bd-btn" onClick={continueAfterQuiz} style={greenBtn}>{tr(lang, "TIẾP TỤC HÀNH TRÌNH ▶", "CONTINUE VOYAGE ▶")}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MENU TẠM DỪNG */}
      {showSettings && (
        <div style={{ ...overlay, background: "rgba(3,5,9,0.82)", zIndex: 90 }}>
          <div className="bd-panel" style={{ padding: "32px 36px", width: 340, display: "flex", flexDirection: "column", gap: 14, textAlign: "center", color: "#FFF8E7", borderRadius: 6, animation: "bd-fadein .25s ease both" }}>
            <h3 style={{ margin: "0 0 4px 0", color: "#D4AF37", fontSize: 26, fontFamily: TITLE_FONT, letterSpacing: 2 }}>{tr(lang, "TẠM DỪNG CHIẾN DỊCH", "PAUSED")}</h3>
            <button className="bd-btn" onClick={() => setShowSettings(false)} style={greenBtn}>{tr(lang, "TIẾP TỤC", "RESUME")}</button>
            <button className="bd-btn" onClick={() => setMuted(AudioSys.toggleMute())} style={darkBtn}>{muted ? "🔇 " : "🔊 "}{tr(lang, "ÂM THANH", "SOUND")}</button>
            <button className="bd-btn" onClick={resetGame} style={primaryBtn}>{tr(lang, "CHƠI LẠI", "RESTART")}</button>
          </div>
        </div>
      )}

      {/* CHIẾN THẮNG */}
      {phase === "victory" && (
        <div style={{ ...overlay, background: "radial-gradient(ellipse at center, rgba(10,14,20,0.8), rgba(3,5,8,0.96))", zIndex: 100, color: "#FFF8E7", textAlign: "center" }}>
          <div className="bd-panel" style={{ padding: compact ? "16px 22px" : "40px 54px", maxWidth: 640, maxHeight: "94vh", overflowY: "auto", touchAction: "pan-y", borderRadius: 6, animation: "bd-fadein .6s ease both" }}>
            <div style={{ fontSize: compact ? 26 : 40, letterSpacing: 10, marginBottom: 4 }}>{"⭐".repeat(stars)}<span style={{ opacity: 0.2 }}>{"⭐".repeat(3 - stars)}</span></div>
            <h1 style={{ color: "#FFD700", fontSize: compact ? 28 : 46, margin: "0 0 8px 0", fontFamily: TITLE_FONT, animation: "bd-glow 3s ease-in-out infinite" }}>{tr(lang, "ĐẠI THẮNG BẠCH ĐẰNG 938!", "VICTORY AT BACH DANG 938!")}</h1>
            <p style={{ color: "#C8C2B0", fontSize: 15, lineHeight: 1.6, marginBottom: 22 }}>{tr(lang, "Hạm đội Nam Hán bị tiêu diệt hoàn toàn. Dưới đây là hồ sơ dữ liệu thực nghiệm phục vụ NCKH:", "Southern Han fleet destroyed. Empirical session report:")}</p>
            <div style={{ background: "rgba(22,29,40,.9)", border: "1px solid #8A6D2F", borderRadius: 6, padding: "16px 28px", marginBottom: 26, textAlign: "left", fontSize: 15, lineHeight: 1.9 }}>
              <div>• {tr(lang, "Số thuyền giặc tiêu diệt:", "Enemies destroyed:")} <strong style={{ color: "#FFD700" }}>{killCount}</strong></div>
              <div>• {tr(lang, "Độ bền thuyền còn lại:", "Remaining hull:")} <strong style={{ color: "#4CAF50" }}>{playerHp}%</strong></div>
              <div>• {tr(lang, "Đài Lệnh Kỳ hoàn thành:", "Stations cleared:")} <strong style={{ color: "#FFD700" }}>{quizzes.length}/{quizzes.length}</strong></div>
              <div>• {tr(lang, "Số lần trả lời sai:", "Incorrect quiz attempts:")} <strong style={{ color: "#FF8A65" }}>{wrongAnswersCount}</strong></div>
            </div>
            <button className="bd-btn" onClick={resetGame} style={primaryBtn}>{tr(lang, "THỰC NGHIỆM LẠI", "PLAY AGAIN")}</button>
          </div>
        </div>
      )}

      {/* THẤT BẠI */}
      {phase === "defeat" && (
        <div style={{ ...overlay, background: "radial-gradient(ellipse at center, rgba(60,10,10,0.82), rgba(20,3,3,0.96))", zIndex: 100, color: "#FFF8E7", textAlign: "center" }}>
          <div className="bd-panel" style={{ padding: compact ? "20px 24px" : "40px 50px", maxWidth: 560, maxHeight: "94vh", overflowY: "auto", touchAction: "pan-y", borderRadius: 6, animation: "bd-fadein .6s ease both" }}>
            <h1 style={{ color: "#FF5252", fontSize: compact ? 28 : 44, margin: "0 0 14px 0", fontFamily: TITLE_FONT }}>{tr(lang, "CHIẾN THUYỀN ĐÃ CHÌM", "WARSHIP SUNK")}</h1>
            <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 12, color: "#E0D8C8" }}>{tr(lang, "Hãy dụ địch tiến vào bãi cọc ngầm đúng lúc thủy triều rút xuống dưới 50% để phát huy tối đa sức mạnh trận địa.", "Lure the enemy into the stake field during low tide (below 50%).")}</p>
            <p style={{ fontSize: 13, color: "#B9B196", marginBottom: 26 }}>{tr(lang, "Mẹo: thả bè hỏa công [G] về phía sau để chặn thuyền đang đuổi theo, và né tên của thuyền chiến địch.", "Tip: drop a fire raft [G] behind you to stop pursuers, and dodge enemy arrows.")}</p>
            <button className="bd-btn" onClick={resetGame} style={darkBtn}>{tr(lang, "TÁI LẬP TRẬN ĐỊA", "TRY AGAIN")}</button>
          </div>
        </div>
      )}
    </div>
  );
}