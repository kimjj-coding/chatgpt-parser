import Phaser from 'phaser';
import { openingDialogue, type DialogueBlock } from '../data/dialogue';
import {
  createInitialState,
  loadGameState,
  saveGameState,
  type GameState,
  type WorldPosition,
} from '../state/gameState';

type RoomId =
  | 'title'
  | 'prologue'
  | 'flower'
  | 'bully_room'
  | 'rescue'
  | 'gate'
  | 'welfare'
  | 'switch_hall'
  | 'practice'
  | 'rest'
  | 'supply'
  | 'hallway'
  | 'nerd';
type NpcId = 'bully' | 'dormitoriel' | 'nerd' | 'proggithub' | 'ranked';
type EncounterId =
  | 'bully_tutorial'
  | 'proggithub_tutorial'
  | 'proggithub_random'
  | 'ranked_first'
  | 'nerd_first';

export class SchoolScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle;
  private prompt!: Phaser.GameObjects.Text;
  private dialoguePanel?: Phaser.GameObjects.Rectangle;
  private dialogueSpeaker?: Phaser.GameObjects.Text;
  private dialogueText?: Phaser.GameObjects.Text;
  private dialoguePortrait?: Phaser.GameObjects.Image;
  private dialogueContinue?: Phaser.GameObjects.Text;
  private choiceTexts: Phaser.GameObjects.Text[] = [];
  private statusPanel?: Phaser.GameObjects.Container;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private confirmKey!: Phaser.Input.Keyboard.Key;
  private enterKey!: Phaser.Input.Keyboard.Key;
  private cancelKey!: Phaser.Input.Keyboard.Key;
  private menuKey!: Phaser.Input.Keyboard.Key;
  private state: GameState = loadGameState();
  private room: RoomId = 'title';
  private activeBlock?: DialogueBlock;
  private activeDialogueId?: string;
  private lineIndex = 0;
  private choiceMode = false;
  private dialogueOpen = false;
  private statusOpen = false;
  private selectedChoice = 0;
  private nameBuffer = '';
  private nameText?: Phaser.GameObjects.Text;
  private nameCursor = 0;
  private nameOptionTexts: Phaser.GameObjects.Text[] = [];
  private prologueText?: Phaser.GameObjects.Text;
  private prologueIndex = 0;
  private resetKey!: Phaser.Input.Keyboard.Key;
  private npcActors = new Map<NpcId, Phaser.GameObjects.Container>();
  private walkedSinceEncounter = 0;
  private encounterStepTarget = 0;
  private readonly puzzleOrder = [1, 2, 0];
  private switchIndicators: Phaser.GameObjects.Rectangle[] = [];
  private switchHallDoor?: Phaser.GameObjects.Rectangle;

  constructor() {
    super('SchoolScene');
  }

  preload(): void {
    this.load.image('dormitoriel', '/assets/dormitoriel.png');
    this.load.svg('player', '/assets/player.svg');
    this.load.svg('bully', '/assets/bully.svg');
    this.load.svg('ranked', '/assets/ranked.svg');
    this.load.svg('nerd', '/assets/nerd.svg');
    this.load.svg('proggithub', '/assets/proggithub.svg');
    this.load.svg('notice-board', '/assets/notice-board.svg');
    this.load.svg('switch-panel', '/assets/switch-panel.svg');
    this.load.svg('record-terminal', '/assets/record-terminal.svg');
    this.load.svg('snack-basket', '/assets/snack-basket.svg');
  }

  create(): void {
    this.state = loadGameState();
    this.npcActors.clear();
    this.switchIndicators = [];
    this.switchHallDoor = undefined;
    if (!this.state.playerName) {
      this.state.playerName = '';
      this.state.sceneId = 'title';
      this.state.prologueIndex = 0;
      saveGameState(this.state);
    }
    const savedRoom = this.state.sceneId as RoomId;
    this.room = this.validRoom(savedRoom) ? savedRoom : 'title';
    this.choiceTexts = [];
    this.nameBuffer = this.state.playerName || '';
    this.prologueIndex = this.state.prologueIndex || 0;

    const completed = this.registry.get('completedEncounter') as EncounterId | undefined;
    if (completed === 'bully_tutorial') {
      this.room = 'rescue';
      this.state.sceneId = 'rescue';
      this.state.spawnPosition = { sceneId: 'rescue', x: 480, y: 390 };
      saveGameState(this.state);
    }
    if (completed === 'proggithub_tutorial') {
      this.room = 'practice';
      this.state.sceneId = 'practice';
      this.state.spawnPosition = { sceneId: 'practice', x: 700, y: 350 };
      saveGameState(this.state);
    }
    if (completed === 'ranked_first') {
      this.room = 'hallway';
      this.state.sceneId = 'hallway';
      this.state.spawnPosition = { sceneId: 'hallway', x: 690, y: 350 };
      saveGameState(this.state);
    }
    if (completed === 'nerd_first') {
      this.room = 'nerd';
      this.state.sceneId = 'nerd';
      this.state.spawnPosition = { sceneId: 'nerd', x: 700, y: 350 };
      saveGameState(this.state);
    }
    this.registry.set('completedEncounter', undefined);

    this.drawRoom();
    this.createPlayer();
    this.createNpc();
    this.bindKeys();
    if (completed === 'ranked_first') {
      this.openDialogueBlock('rankedAftermath', {
        speaker: '도미토리엘',
        lines: [
          '아이고, 놀라게 할 생각은 없었는데… 늘 저렇게 급하단다.',
          '책을 끝까지 읽고 나면 인사하러 오겠지. 자, 우리도 가 보자.',
        ],
      });
    } else if (this.room === 'welfare' && !this.state.flags.welfareGuideSeen) {
      this.openDialogue('dormitoriel');
      this.activeDialogueId = 'dormitorielGuide';
      this.activeBlock = openingDialogue.dormitorielGuide;
      this.lineIndex = 0;
      this.renderDialogue();
    }
    this.encounterStepTarget = Phaser.Math.Between(10, 20) * 18;
  }

  private validRoom(room: RoomId): boolean {
    return [
      'title',
      'prologue',
      'flower',
      'bully_room',
      'rescue',
      'gate',
      'welfare',
      'switch_hall',
      'practice',
      'rest',
      'supply',
      'hallway',
      'nerd',
    ].includes(room);
  }

  private bindKeys(): void {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.confirmKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    this.enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.cancelKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.X);
    this.menuKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.C);
    this.resetKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.prompt = this.add.text(480, 510, '', {
      color: '#cbd5e1',
      backgroundColor: '#090d16',
      padding: { x: 12, y: 7 },
      fontFamily: 'monospace',
      fontSize: '15px',
    }).setOrigin(0.5);
  }

  private drawRoom(): void {
    this.cameras.main.setBackgroundColor('#0d121b');
    if (this.room === 'title') {
      this.add.rectangle(480, 270, 960, 540, 0x10131c);
      this.add.rectangle(480, 300, 740, 330, 0x1b2532)
        .setStrokeStyle(3, 0x6a587b);
      this.drawTitle();
      return;
    }
    this.add.rectangle(480, 270, 960, 540, 0x0d121b);
    this.add.rectangle(480, 133, 960, 122, 0x263344);
    this.add.rectangle(480, 193, 960, 4, 0x141d2a);
    this.add.rectangle(480, 307, 960, 266, 0x45515d);
    for (let x = 0; x <= 960; x += 64) {
      this.add.rectangle(x, 320, 2, 242, 0x34404b, 0.9);
      this.add.rectangle(x + 32, 259, 1, 120, 0x606b73, 0.55);
      this.add.rectangle(x + 32, 382, 1, 122, 0x606b73, 0.55);
    }
    this.add.rectangle(480, 197, 960, 8, 0x1b2532);
    this.add.rectangle(480, 447, 960, 17, 0x242f3c);
    this.add.rectangle(480, 439, 960, 3, 0x8a7554);
    for (let x = 90; x < 900; x += 202) {
      this.add.rectangle(x, 126, 106, 75, 0x152333).setStrokeStyle(5, 0x536273);
      this.add.rectangle(x, 126, 92, 61, 0x587383);
      this.add.rectangle(x, 126, 3, 61, 0xb4a27c);
      this.add.rectangle(x, 126, 92, 3, 0xb4a27c);
    }
    this.add.rectangle(480, 46, 960, 92, 0x101722);
    this.add.rectangle(480, 90, 960, 3, 0x6a587b);
    this.add.text(42, 48, this.title(), {
      color: '#f8fafc',
      fontFamily: 'monospace',
      fontSize: '20px',
    });
    this.add.rectangle(478, 502, 920, 60, 0x0d121b, 0.95)
      .setStrokeStyle(2, 0x776b88);

    if (this.room === 'prologue') this.drawPrologue();
    if (this.room === 'flower') this.drawFlower();
    if (this.room === 'bully_room') this.drawBullyRoom();
    if (this.room === 'rescue') this.drawRescue();
    if (this.room === 'gate') this.drawGate();
    if (this.room === 'welfare') this.drawWelfare();
    if (this.room === 'switch_hall') this.drawSwitchHall();
    if (this.room === 'practice') this.drawPractice();
    if (this.room === 'rest') this.drawRest();
    if (this.room === 'supply') this.drawSupply();
    if (this.room === 'hallway') this.drawHallway();
    if (this.room === 'nerd') this.drawNerd();
  }

  private title(): string {
    const titles: Record<RoomId, string> = {
      title: 'UNDERFAIL',
      prologue: '풍화양상 중학교 배정',
      flower: '꽃밭',
      rescue: '도미토리엘의 구출',
      bully_room: '교문 복도',
      gate: '풍화양상 고등학교',
      welfare: '교육복지반',
      switch_hall: '표시 스위치 연습실',
      practice: '모의 조우 교실',
      rest: '교육복지반 휴게실',
      supply: '교육복지반 보관실',
      hallway: '기초학력동 복도',
      nerd: '기초학력동 복도',
    };
    return titles[this.room];
  }

  private drawTitle(): void {
    this.add.text(480, 180, 'UNDERFAIL', {
      color: '#f8fafc',
      fontFamily: 'monospace',
      fontSize: '44px',
    }).setOrigin(0.5);
    this.add.text(480, 250, '이름을 입력하세요', {
      color: '#cbd5e1',
      fontFamily: 'monospace',
      fontSize: '18px',
    }).setOrigin(0.5);
    this.nameText = this.add.text(480, 320, this.nameBuffer || '＿', {
      color: '#fde68a',
      fontFamily: 'monospace',
      fontSize: '28px',
    }).setOrigin(0.5);
    this.add.text(480, 360, 'Z / Enter · 선택   X · 지움', {
      color: '#94a3b8',
      fontFamily: 'monospace',
      fontSize: '15px',
    }).setOrigin(0.5);
    this.renderNameOptions();
  }

  private nameOptions(): string[] {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    return [...letters, 'BACK', 'DONE', 'RESET'];
  }

  private renderNameOptions(): void {
    this.nameOptionTexts.forEach((text) => text.destroy());
    this.nameOptionTexts = [];
    const options = this.nameOptions();
    const columns = 8;
    options.forEach((option, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const marker = index === this.nameCursor ? '▶ ' : '  ';
      this.nameOptionTexts.push(this.add.text(
        250 + column * 66,
        385 + row * 20,
        `${marker}${option}`,
        {
          color: index === this.nameCursor ? '#fbbf24' : '#f8fafc',
          fontFamily: 'monospace',
          fontSize: option.length > 1 ? '13px' : '16px',
        },
      ).setOrigin(0.5));
    });
  }

  private moveNameCursor(direction: 'left' | 'right' | 'up' | 'down'): void {
    const options = this.nameOptions();
    const columns = 8;
    const rows = Math.ceil(options.length / columns);
    const lastRowStart = (rows - 1) * columns;
    const lastRowCount = options.length - lastRowStart;
    const row = Math.floor(this.nameCursor / columns);
    const column = this.nameCursor % columns;

    if (direction === 'left') {
      this.nameCursor = column > 0
        ? this.nameCursor - 1
        : row * columns + (row === rows - 1 ? lastRowCount - 1 : columns - 1);
    } else if (direction === 'right') {
      const rowCount = row === rows - 1 ? lastRowCount : columns;
      this.nameCursor = column < rowCount - 1
        ? this.nameCursor + 1
        : row * columns;
    } else if (direction === 'up') {
      this.nameCursor = row > 0
        ? this.nameCursor - columns
        : lastRowStart + Math.min(column, lastRowCount - 1);
    } else {
      const next = this.nameCursor + columns;
      this.nameCursor = row < rows - 1 && next < options.length ? next : column;
    }

    this.renderNameOptions();
  }

  private drawPrologue(): void {
    const panels = [
      '꿈을 향해 나아가는 학생이, 그 꿈 위에 함께하는 학교가 있었다.',
      '많은 학생의 꿈이 함께하는 합주곡 혼합고등학교.',
      '그러나 학적과 성적 부진이 학교의 문을 닫게 했다.',
      '202X년, 풍화양상 중학교의 배정 통지서가 펼쳐진다.',
    ];
    this.add.text(480, 115, '프롤로그', {
      color: '#94a3b8',
      fontFamily: 'monospace',
      fontSize: '16px',
    }).setOrigin(0.5);
    this.add.rectangle(480, 285, 780, 250, 0x1f2937).setStrokeStyle(3, 0x64748b);
    this.prologueText = this.add.text(480, 285, panels[this.prologueIndex] || panels[panels.length - 1], {
      color: '#f8fafc',
      fontFamily: 'monospace',
      fontSize: '22px',
      align: 'center',
      wordWrap: { width: 700 },
      lineSpacing: 10,
    }).setOrigin(0.5);
  }

  private drawFlower(): void {
    this.add.rectangle(480, 300, 860, 290, 0x26364a);
    this.add.rectangle(480, 164, 860, 16, 0x7b6a50).setStrokeStyle(3, 0xc7b58a);
    for (let i = 0; i < 18; i += 1) {
      const x = 110 + (i % 6) * 148;
      const y = 210 + Math.floor(i / 6) * 62;
      this.add.rectangle(x, y, 5, 18, 0x5f8f63);
      this.add.rectangle(x - 8, y - 8, 18, 12, i % 3 === 0 ? 0xfde68a : 0x8bd3a3);
      this.add.rectangle(x - 4, y - 12, 10, 10, i % 3 === 0 ? 0xeabf52 : 0x65b985);
    }
    this.add.rectangle(80, 300, 18, 220, 0x1b2635).setStrokeStyle(3, 0x718096);
    this.add.rectangle(880, 300, 18, 220, 0x1b2635).setStrokeStyle(3, 0x718096);
    this.drawNpc('bully', 480, 260, 0xc084fc, '불리');
  }

  private drawRescue(): void {
    this.add.rectangle(480, 300, 860, 290, 0x26364a);
    this.add.rectangle(480, 164, 860, 16, 0x7b6a50).setStrokeStyle(3, 0xc7b58a);
    this.add.rectangle(140, 300, 170, 34, 0x3f4f63).setStrokeStyle(3, 0x9aa8ba);
    this.add.rectangle(820, 300, 170, 34, 0x3f4f63).setStrokeStyle(3, 0x9aa8ba);
    this.add.rectangle(140, 282, 46, 6, 0x8a7354);
    this.add.rectangle(820, 282, 46, 6, 0x8a7354);
    this.drawNpc('dormitoriel', 480, 260, 0xfbbf24, '도미토리엘');
  }

  private drawBullyRoom(): void {
    this.add.rectangle(480, 270, 860, 130, 0x202936);
    this.drawNpc('bully', 480, 250, 0xc084fc, '불리');
  }

  private drawGate(): void {
    this.add.rectangle(480, 270, 180, 220, 0x182436).setStrokeStyle(5, 0x94a3b8);
  }

  private drawWelfare(): void {
    this.add.image(210, 230, 'notice-board').setDisplaySize(144, 96);
    this.add.rectangle(720, 300, 100, 130, 0x283448).setStrokeStyle(3, 0x718096);
    this.add.rectangle(720, 246, 74, 8, 0x526172);
    this.add.rectangle(720, 226, 36, 36, 0xf3f4f6).setStrokeStyle(3, 0x94a3b8);
    this.add.text(720, 226, '담임실', {
      color: '#263449',
      fontFamily: 'monospace',
      fontSize: '10px',
    }).setOrigin(0.5);
    this.add.text(210, 292, '안내 자료', {
      color: '#cbd5e1',
      fontFamily: 'monospace',
      fontSize: '14px',
    }).setOrigin(0.5);
    this.add.text(850, 270,
      this.state.flags.welfareGuideSeen ? '동쪽 복도 →' : '도미토리엘의 안내를 기다리자', {
        color: '#dce7ef',
        fontFamily: 'monospace',
        fontSize: '13px',
      }).setOrigin(0.5);
  }

  private drawSwitchHall(): void {
    this.add.rectangle(480, 270, 860, 320, 0x26364a).setStrokeStyle(3, 0x172334);
    this.add.rectangle(480, 170, 860, 28, 0x7b8a9d);
    this.add.rectangle(480, 420, 860, 28, 0x7b8a9d);
    this.add.image(240, 260, 'notice-board').setDisplaySize(174, 116);
    this.add.text(240, 239, '안내', {
      color: '#f1f5f9',
      fontFamily: 'monospace',
      fontSize: '17px',
    }).setOrigin(0.5);
    this.add.text(240, 272, '● → ▲ → ◆', {
      color: '#cbd5e1',
      fontFamily: 'monospace',
      fontSize: '13px',
    }).setOrigin(0.5);
    const active = this.state.flags.switchHallSolved;
    [390, 510, 630].forEach((x, index) => {
      const progress = this.state.puzzleProgress ?? 0;
      const lit = active || this.puzzleOrder.slice(0, progress).includes(index);
      this.add.image(x, 310, 'switch-panel').setDisplaySize(52, 52);
      this.switchIndicators.push(this.add.rectangle(
        x, 310, 14, 14, lit ? 0x22c55e : 0x526172,
      ));
      this.add.text(x, 356, ['◆', '●', '▲'][index], {
        color: lit ? '#86efac' : '#dce7ef',
        fontFamily: 'monospace',
        fontSize: '17px',
      }).setOrigin(0.5);
    });
    if (active) {
      this.switchHallDoor = this.add.rectangle(870, 292, 28, 136, 0x172033)
        .setStrokeStyle(3, 0x22c55e);
    } else {
      this.switchHallDoor = this.add.rectangle(870, 292, 28, 136, 0x172033)
        .setStrokeStyle(3, 0x718096);
    }
  }

  private drawPractice(): void {
    this.add.rectangle(480, 270, 860, 320, 0x26364a).setStrokeStyle(3, 0x172334);
    this.add.rectangle(480, 170, 860, 28, 0x7b8a9d);
    this.add.rectangle(480, 420, 860, 28, 0x7b8a9d);
    this.add.rectangle(220, 260, 156, 90, 0x5a4d42).setStrokeStyle(3, 0xb5a17e);
    this.add.rectangle(220, 238, 120, 10, 0x3c4656);
    this.add.text(220, 222, '연습용 교탁', {
      color: '#f1e8d5',
      fontFamily: 'monospace',
      fontSize: '13px',
    }).setOrigin(0.5);
    this.add.rectangle(490, 260, 180, 62, 0x34465a).setStrokeStyle(3, 0x91a1b5);
    this.add.text(490, 260,
      this.state.flags.proggithubTutorial ? '모의 조우 완료' : '전투 연습 안내', {
        color: '#e2e8f0',
        fontFamily: 'monospace',
        fontSize: '15px',
      }).setOrigin(0.5);
    if (this.state.flags.proggithubTutorial) {
      this.add.rectangle(870, 292, 28, 136, 0x172033)
        .setStrokeStyle(3, 0x22c55e);
    }
  }

  private drawRest(): void {
    this.add.rectangle(480, 270, 860, 320, 0x26364a).setStrokeStyle(3, 0x172334);
    this.add.rectangle(480, 170, 860, 28, 0x7b8a9d);
    this.add.rectangle(480, 420, 860, 28, 0x7b8a9d);
    this.add.image(360, 278, 'record-terminal').setDisplaySize(64, 64);
    const saveMark = this.add.star(360, 250, 4, 4, 10,
      this.state.flags.welfareCheckpoint ? 0xfbbf24 : 0xf8fafc)
      .setStrokeStyle(1, 0xfff1b6);
    this.tweens.add({
      targets: saveMark,
      alpha: { from: 0.45, to: 1 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
    this.add.text(360, 328,
      this.state.flags.welfareCheckpoint ? '기록 저장됨' : '기록 단말기', {
        color: '#dce7ef',
        fontFamily: 'monospace',
        fontSize: '13px',
      }).setOrigin(0.5);
    this.add.image(680, 278, 'notice-board').setDisplaySize(82, 54);
    this.add.text(680, 328, '보관실 안내', {
      color: '#dce7ef',
      fontFamily: 'monospace',
      fontSize: '13px',
    }).setOrigin(0.5);
    this.add.rectangle(870, 292, 28, 136, 0x172033)
      .setStrokeStyle(3, 0x718096);
    this.add.text(480, 199, '교육복지반 휴게실', {
      color: '#dce7ef',
      fontFamily: 'monospace',
      fontSize: '15px',
    }).setOrigin(0.5);
    this.add.text(480, 222, '↑ 보관실', {
      color: '#dce7ef',
      fontFamily: 'monospace',
      fontSize: '13px',
    }).setOrigin(0.5);
  }

  private drawSupply(): void {
    this.add.rectangle(480, 280, 760, 260, 0x26364a).setStrokeStyle(4, 0x1b2432);
    this.add.image(280, 260, 'notice-board').setDisplaySize(180, 118);
    this.add.image(480, 260, 'snack-basket').setDisplaySize(92, 68);
    this.add.image(680, 260, 'record-terminal').setDisplaySize(84, 84);
    this.add.text(280, 330, '복도 안내도', {
      color: '#dce7ef', fontFamily: 'monospace', fontSize: '14px',
    }).setOrigin(0.5);
    this.add.text(480, 330, this.state.flags.candyClaimed ? '사탕을 챙김' : '간식 바구니', {
      color: '#dce7ef', fontFamily: 'monospace', fontSize: '14px',
    }).setOrigin(0.5);
    this.add.text(680, 330, '낡은 기록기', {
      color: '#dce7ef', fontFamily: 'monospace', fontSize: '14px',
    }).setOrigin(0.5);
    this.add.text(480, 190, '교육복지반 보관실', {
      color: '#dce7ef', fontFamily: 'monospace', fontSize: '16px',
    }).setOrigin(0.5);
    this.add.text(480, 396, '↓ 돌아가기', {
      color: '#dce7ef', fontFamily: 'monospace', fontSize: '13px',
    }).setOrigin(0.5);
  }

  private drawHallway(): void {
    this.add.rectangle(480, 270, 860, 180, 0x3d4a5c).setStrokeStyle(4, 0x1b2432);
    this.add.rectangle(480, 174, 860, 28, 0x7b8a9d);
    this.add.rectangle(480, 366, 860, 28, 0x7b8a9d);
    for (let x = 120; x < 860; x += 170) {
      this.add.rectangle(x, 270, 90, 82, 0x2a3545).setStrokeStyle(3, 0x718096);
      this.add.rectangle(x - 30, 255, 18, 48, 0x526172);
      this.add.rectangle(x + 30, 255, 18, 48, 0x526172);
    }
    if (!this.state.flags.rankedFirstEncounter) {
      this.add.text(480, 205, '복도 끝에서 책장을 넘기는 소리가 난다.', {
        color: '#94a3b8',
        fontFamily: 'monospace',
        fontSize: '16px',
      }).setOrigin(0.5);
    }
  }

  private drawNerd(): void {
    this.add.rectangle(480, 270, 860, 180, 0x3d4a5c).setStrokeStyle(4, 0x1b2432);
    this.add.rectangle(480, 174, 860, 28, 0x7b8a9d);
    this.add.rectangle(480, 366, 860, 28, 0x7b8a9d);
    this.add.rectangle(130, 270, 120, 90, 0x283548).setStrokeStyle(3, 0x718096);
    this.add.rectangle(350, 270, 120, 90, 0x283548).setStrokeStyle(3, 0x718096);
    this.add.rectangle(840, 270, 42, 170, 0x172033)
      .setStrokeStyle(3, this.state.flags.nerdFirstEncounter ? 0x22c55e : 0x60a5fa);
    if (this.state.flags.nerdFirstEncounter) {
      this.add.text(480, 205, '너드스타블룩이 비킨 길', {
        color: '#86efac',
        fontFamily: 'monospace',
        fontSize: '16px',
      }).setOrigin(0.5);
    }
  }

  private createPlayer(): void {
    if (this.room === 'title' || this.room === 'prologue') return;
    const positions: Record<RoomId, { x: number; y: number }> = {
      title: { x: 480, y: 350 },
      prologue: { x: 480, y: 350 },
      flower: { x: 480, y: 390 },
      rescue: { x: 480, y: 390 },
      bully_room: { x: 480, y: 350 },
      gate: { x: 480, y: 390 },
      welfare: { x: 180, y: 350 },
      switch_hall: { x: 180, y: 350 },
      practice: { x: 180, y: 350 },
      rest: { x: 180, y: 350 },
      supply: { x: 480, y: 360 },
      hallway: { x: 180, y: 350 },
      nerd: { x: 480, y: 350 },
    };
    const savedPosition = this.state.spawnPosition;
    const position = savedPosition?.sceneId === this.room
      ? { x: savedPosition.x, y: savedPosition.y }
      : positions[this.room];
    this.player = this.add.rectangle(position.x, position.y, 22, 22, 0xf87171, 0);
    this.player.setData('sprite', this.add.image(position.x, position.y, 'player')
      .setDisplaySize(38, 56));
    this.player.setData('lastX', position.x);
    this.player.setData('lastY', position.y);
  }

  private createNpc(): void {
    if (this.room === 'welfare') this.drawNpc('dormitoriel', 720, 280, 0xfbbf24, '도미토리엘');
    if (this.room === 'nerd') this.drawNpc('nerd', 700, 270, 0x60a5fa, '너드스타블룩');
    if (this.room === 'practice' && !this.state.flags.proggithubTutorial) {
      this.drawNpc('proggithub', 700, 270, 0x60a5fa, '프로깃허브');
    }
    if (this.room === 'hallway') {
      this.drawNpc(
        'dormitoriel',
        this.state.flags.rankedFirstEncounter ? 640 : 270,
        270,
        0xfbbf24,
        '도미토리엘',
      );
      if (!this.state.flags.rankedFirstEncounter) {
        this.drawNpc('ranked', 700, 270, 0x60a5fa, '전교 2등');
      }
    }
  }

  private drawNpc(id: NpcId, x: number, y: number, color: number, label: string): void {
    const body = this.add.image(0, -2, id).setDisplaySize(
      id === 'proggithub' ? 68 : id === 'dormitoriel' ? 76 : 80,
      id === 'proggithub' ? 88 : id === 'dormitoriel' ? 112 : 112,
    );
    const name = this.add.text(0, 52, label, {
      color: '#f8fafc',
      backgroundColor: '#111827',
      padding: { x: 6, y: 4 },
      fontFamily: 'monospace',
      fontSize: '13px',
    }).setOrigin(0.5);
    const actor = this.add.container(x, y, [body, name]);
    this.npcActors.set(id, actor);
    const patrol = id === 'bully' || id === 'ranked'
      ? 24
      : id === 'dormitoriel' || id === 'nerd'
        ? 12
        : 18;
    this.tweens.add({
      targets: actor,
      x: { from: x - patrol, to: x + patrol },
      duration: Phaser.Math.Between(1700, 2500),
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
  }

  update(): void {
    if (Phaser.Input.Keyboard.JustDown(this.resetKey)) {
      this.resetGame();
      return;
    }
    if (this.room === 'title') {
      this.prompt?.setText('');
      this.prompt?.setVisible(false);
      const options = this.nameOptions();
      if (Phaser.Input.Keyboard.JustDown(this.cursors.left!)) {
        this.moveNameCursor('left');
      }
      if (Phaser.Input.Keyboard.JustDown(this.cursors.right!)) {
        this.moveNameCursor('right');
      }
      if (Phaser.Input.Keyboard.JustDown(this.cursors.up!)) {
        this.moveNameCursor('up');
      }
      if (Phaser.Input.Keyboard.JustDown(this.cursors.down!)) {
        this.moveNameCursor('down');
      }
      if (Phaser.Input.Keyboard.JustDown(this.cancelKey)) {
        this.nameBuffer = this.nameBuffer.slice(0, -1);
        this.nameText?.setText(this.nameBuffer || '＿');
      }
      if (this.confirmPressed()) {
        const option = options[this.nameCursor];
        if (option === 'BACK') {
          this.nameBuffer = this.nameBuffer.slice(0, -1);
          this.nameText?.setText(this.nameBuffer || '＿');
        } else if (option === 'RESET') {
          this.resetGame();
        } else if (option === 'DONE') {
          this.state.playerName = this.nameBuffer.trim() || 'PLAYER';
          this.state.sceneId = 'prologue';
          saveGameState(this.state);
          this.changeRoom('prologue');
        } else {
          if (this.nameBuffer.length < 6) {
            this.nameBuffer += option;
            this.nameText?.setText(this.nameBuffer);
          }
        }
      }
      return;
    }
    this.prompt?.setVisible(true);
    if (this.room === 'prologue') {
      this.prompt?.setText('Z / Enter · 다음 장면');
      if (this.confirmPressed()) {
        this.prologueIndex += 1;
        if (this.prologueIndex >= 4) {
          this.state.prologueIndex = 4;
          this.state.sceneId = 'flower';
          saveGameState(this.state);
          this.changeRoom('flower');
        } else {
          this.state.prologueIndex = this.prologueIndex;
          saveGameState(this.state);
          const panels = [
            '꿈을 향해 나아가는 학생이, 그 꿈 위에 함께하는 학교가 있었다.',
            '많은 학생의 꿈이 함께하는 합주곡 혼합고등학교.',
            '그러나 학적과 성적 부진이 학교의 문을 닫게 했다.',
            '202X년, 풍화양상 중학교의 배정 통지서가 펼쳐진다.',
          ];
          this.prologueText?.setText(panels[this.prologueIndex]);
        }
      }
      return;
    }
    if (this.statusOpen) {
      if (Phaser.Input.Keyboard.JustDown(this.cancelKey) ||
        Phaser.Input.Keyboard.JustDown(this.menuKey)) this.closeStatus();
      return;
    }
    if (this.dialogueOpen) {
      this.updateDialogue();
      return;
    }
    if (this.room === 'flower') {
      this.prompt?.setText('Z / Enter · 불리와 대화');
      if (this.confirmPressed()) this.openDialogue('bully');
      return;
    }
    if (this.room === 'rescue') {
      this.prompt?.setText('Z / Enter · 도미토리엘과 대화');
      if (this.confirmPressed()) this.openDialogue('dormitoriel');
      return;
    }
    if (Phaser.Input.Keyboard.JustDown(this.menuKey)) {
      this.openStatus();
      return;
    }

    if (this.cursors.left.isDown) this.move(-2.6, 0);
    if (this.cursors.right.isDown) this.move(2.6, 0);
    if (this.cursors.up.isDown) this.move(0, -2.6);
    if (this.cursors.down.isDown) this.move(0, 2.6);
    if (this.checkRandomEncounter()) return;

    const npc = this.nearbyNpc();
    if (npc) {
      this.prompt.setText(`Z / Enter - ${this.npcName(npc)}와 대화`);
      if (this.confirmPressed()) this.openDialogue(npc);
      return;
    }

    if (this.room === 'bully_room') {
      this.prompt.setText('Z / Enter - 불리와 대화');
      if (this.player.y <= 150 && this.state.flags.bullyTutorial) {
        this.changeRoom('gate');
      }
    } else if (this.room === 'gate') {
      this.prompt.setText('Z / Enter - 조사 / 북쪽 복도');
      if (this.player.y <= 150 && this.state.flags.bullyTutorial) {
        this.changeRoom('welfare');
      }
    } else if (this.room === 'welfare') {
      this.prompt.setText('Z / Enter - 대화 / C - 상태');
      if (!this.state.flags.welfareGuideSeen) {
        this.prompt.setText('먼저 도미토리엘에게 안내를 들어보자');
        return;
      }
      if (this.player.x >= 872) {
        this.changeRoom('switch_hall');
      } else if (this.player.x < 105) {
        this.prompt.setText('서쪽 문으로 돌아가기');
      }
    } else if (this.room === 'switch_hall') {
      const nearSign = Phaser.Math.Distance.Between(this.player.x, this.player.y, 240, 260) < 68;
      const switchXs = [390, 510, 630];
      const nearSwitch = switchXs.findIndex((x) =>
        Phaser.Math.Distance.Between(this.player.x, this.player.y, x, 310) < 55);
      if (nearSign) {
        this.prompt.setText('Z / Enter - 안내 표지 읽기');
        if (this.confirmPressed()) {
          this.state.flags.switchHallHintSeen = true;
          saveGameState(this.state);
          this.openMessage('안내 표지', [
            '발판의 모양을 ●, ▲, ◆ 순으로 밟아야 한다.',
            '순서가 틀리면 처음부터 다시 시작한다.',
          ]);
        }
      } else if (nearSwitch >= 0 && !this.state.flags.switchHallSolved) {
        const progress = this.state.puzzleProgress ?? 0;
        const expected = this.puzzleOrder[progress];
        this.prompt.setText(`Z / Enter - ${['◆', '●', '▲'][nearSwitch]} 발판`);
        if (this.confirmPressed()) {
          if (nearSwitch === expected) {
            this.state.puzzleProgress = progress + 1;
            this.switchIndicators[nearSwitch]?.setFillStyle(0x22c55e);
            if (this.state.puzzleProgress >= this.puzzleOrder.length) {
              this.state.flags.switchHallSolved = true;
              this.state.puzzleProgress = 0;
              this.switchHallDoor?.setStrokeStyle(3, 0x22c55e);
              saveGameState(this.state);
              this.openMessage('발판', ['세 표시가 차례로 켜진다. 잠금장치가 풀렸다.']);
            } else {
              saveGameState(this.state);
              this.openMessage('발판', ['표시가 켜졌다. 안내판의 다음 모양을 찾아보자.']);
            }
          } else {
            this.state.puzzleProgress = 0;
            this.switchIndicators.forEach((indicator) => indicator.setFillStyle(0x526172));
            saveGameState(this.state);
            this.openMessage('발판', ['순서가 맞지 않는다. 안내판을 다시 확인하자.']);
          }
        }
      } else if (this.state.flags.switchHallSolved && this.player.x >= 872) {
        this.changeRoom('practice');
      } else {
        this.prompt.setText('동쪽 문으로 이동');
      }
    } else if (this.room === 'practice') {
      if (this.state.flags.proggithubTutorial && this.player.x >= 872) {
        this.changeRoom('rest');
      } else if (this.state.flags.proggithubTutorial) {
        this.prompt.setText('동쪽 문으로 휴게실 이동');
      } else {
        this.prompt.setText('프로깃허브에게 모의 조우 안내를 받자');
      }
    } else if (this.room === 'rest') {
      const atSave = Phaser.Math.Distance.Between(this.player.x, this.player.y, 360, 278) < 62;
      if (atSave) {
        this.prompt.setText('Z / Enter - 기록 단말기');
        if (this.confirmPressed()) {
          this.state.checkpoint = {
            sceneId: 'rest',
            x: this.player.x,
            y: this.player.y,
          };
          this.state.flags.welfareCheckpoint = true;
          this.state.sceneId = 'rest';
          this.state.spawnPosition = this.state.checkpoint;
          saveGameState(this.state);
          this.openMessage('기록 단말기', [
            '화면에 짧은 문장이 떠오른다.',
            '진행 상황을 기록했다.',
          ]);
        }
      } else if (this.player.y <= 172 && this.player.x >= 420 && this.player.x <= 540) {
        this.changeRoom('supply', { x: 480, y: 380 });
      } else if (this.player.y <= 172) {
        this.prompt.setText('복도 중앙 위쪽이 보관실 입구다');
      } else if (this.player.x >= 872) {
        this.changeRoom('hallway');
      } else {
        this.prompt.setText('↑ 보관실   ·   동쪽 복도 →');
      }
    } else if (this.room === 'supply') {
      const atCandy = Phaser.Math.Distance.Between(this.player.x, this.player.y, 480, 260) < 68;
      const atNotice = Phaser.Math.Distance.Between(this.player.x, this.player.y, 280, 260) < 90;
      if (atCandy && !this.state.flags.candyClaimed) {
        this.prompt.setText('Z / Enter - 사탕 하나 챙기기');
        if (this.confirmPressed()) {
          this.state.flags.candyClaimed = true;
          this.state.flags.candy = true;
          saveGameState(this.state);
          this.openMessage('간식 바구니', ['색이 바랜 사탕 하나를 챙겼다. 전투 중 ITEM에서 쓸 수 있다.']);
        }
      } else if (atCandy) {
        this.prompt.setText('바구니는 비어 있다');
      } else if (atNotice) {
        this.prompt.setText('Z / Enter - 복도 안내도를 살펴본다');
        if (this.confirmPressed()) {
          this.openMessage('복도 안내도', [
            '교육복지반은 여러 복도와 교실을 이어 붙인 오래된 구역이다.',
            '표시를 따라가면 처음 온 학생도 출구를 찾을 수 있다.',
          ]);
        }
      } else if (this.player.y >= 408 && this.player.x >= 420 && this.player.x <= 540) {
        this.changeRoom('rest', { x: 680, y: 350 });
      } else if (this.player.y >= 408) {
        this.prompt.setText('보관실 중앙 아래쪽으로 돌아간다');
      } else {
        this.prompt.setText('선반 사이를 살펴볼 수 있다');
      }
    } else if (this.room === 'hallway') {
      if (!this.state.flags.rankedIntroduced) {
        this.prompt.setText('도미토리엘에게 전교 2등을 소개받자');
      } else if (!this.state.flags.rankedFirstEncounter) {
        this.prompt.setText('책을 든 학생에게 다가가 인사해 보자');
      } else if (this.player.x >= 872) {
        this.changeRoom('nerd');
      } else {
        this.prompt.setText('동쪽 복도 진행');
      }
    } else if (this.room === 'nerd') {
      if (this.state.flags.nerdFirstEncounter) {
        this.prompt.setText('동쪽의 문이 열려 있다');
      } else {
        this.prompt.setText('Z / Enter - 너드스타블룩과 대화');
      }
    } else {
      this.prompt.setText('Z / Enter - 너드스타블룩과 대화');
    }
  }

  private move(dx: number, dy: number): void {
    const previousX = this.player.x;
    const previousY = this.player.y;
    this.player.x = Phaser.Math.Clamp(this.player.x + dx, 86, 874);
    this.player.y = Phaser.Math.Clamp(this.player.y + dy, 150, 418);
    this.walkedSinceEncounter += Phaser.Math.Distance.Between(
      previousX, previousY, this.player.x, this.player.y,
    );
    const sprite = this.player.getData('sprite') as Phaser.GameObjects.Image | undefined;
    sprite?.setPosition(this.player.x, this.player.y);
  }

  private checkRandomEncounter(): boolean {
    const encounterAllowed =
      (this.room === 'switch_hall' && this.state.flags.switchHallSolved) ||
      (this.room === 'practice' && this.state.flags.proggithubTutorial) ||
      (this.room === 'hallway' && this.state.flags.rankedIntroduced);
    if (!encounterAllowed || this.walkedSinceEncounter < this.encounterStepTarget) return false;
    this.walkedSinceEncounter = 0;
    this.encounterStepTarget = Phaser.Math.Between(14, 24) * 18;
    if (Math.random() < 0.42) {
      this.startEncounter('proggithub_random');
      return true;
    }
    return false;
  }

  private confirmPressed(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.confirmKey) ||
      Phaser.Input.Keyboard.JustDown(this.enterKey);
  }

  private nearbyNpc(): NpcId | undefined {
    for (const [id, actor] of this.npcActors) {
      if (Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        actor.x,
        actor.y,
      ) < 82) return id;
    }
    return undefined;
  }

  private npcName(id: NpcId): string {
    if (id === 'bully') return '불리';
    if (id === 'dormitoriel') return '도미토리엘';
    if (id === 'proggithub') return '프로깃허브';
    if (id === 'ranked') return '전교 2등';
    return '너드스타블룩';
  }

  private openDialogue(npc: NpcId): void {
    if (npc === 'nerd' && this.state.flags.nerdFirstEncounter) return;
    const dialogueId = npc === 'dormitoriel' && this.room === 'welfare'
      ? 'dormitorielGuide'
      : npc === 'dormitoriel' && this.room === 'hallway'
        ? this.state.flags.rankedIntroduced
          ? 'rankedIntroductionAgain'
          : 'rankedIntroduction'
        : npc;
    this.openDialogueBlock(dialogueId, openingDialogue[dialogueId]);
  }

  private openMessage(speaker: string, lines: string[]): void {
    this.openDialogueBlock('object', { speaker, lines });
  }

  private openDialogueBlock(dialogueId: string, block: DialogueBlock): void {
    this.activeDialogueId = dialogueId;
    this.activeBlock = block;
    this.lineIndex = 0;
    this.choiceMode = false;
    this.selectedChoice = 0;
    this.dialogueOpen = true;
    this.dialoguePanel = this.add.rectangle(480, 405, 780, 155, 0x0b1020, 0.98)
      .setStrokeStyle(4, 0xcbb88a);
    this.dialoguePortrait = this.add.image(145, 405, 'player').setDisplaySize(48, 72);
    this.dialogueSpeaker = this.add.text(198, 350, '', {
      color: '#fde68a',
      fontFamily: 'monospace',
      fontSize: '17px',
    });
    this.dialogueText = this.add.text(198, 382, '', {
      color: '#f8fafc',
      fontFamily: 'monospace',
      fontSize: '17px',
      wordWrap: { width: 638 },
      lineSpacing: 7,
    });
    this.dialogueContinue = this.add.text(850, 450, '▼ Z / Enter', {
      color: '#e5c777',
      fontFamily: 'monospace',
      fontSize: '13px',
    }).setOrigin(1, 0);
    this.renderDialogue();
  }

  private updateDialogue(): void {
    if (!this.activeBlock) return;
    if (this.choiceMode) {
      if (Phaser.Input.Keyboard.JustDown(this.cursors.up!) ||
        Phaser.Input.Keyboard.JustDown(this.cursors.left!)) {
        this.selectedChoice =
          (this.selectedChoice - 1 + this.activeBlock.choices!.length) %
          this.activeBlock.choices!.length;
        this.renderChoices();
      }
      if (Phaser.Input.Keyboard.JustDown(this.cursors.down!) ||
        Phaser.Input.Keyboard.JustDown(this.cursors.right!)) {
        this.selectedChoice =
          (this.selectedChoice + 1) % this.activeBlock.choices!.length;
        this.renderChoices();
      }
      if (this.confirmPressed()) this.handleChoice(
        this.activeBlock.choices![this.selectedChoice].next,
      );
      if (Phaser.Input.Keyboard.JustDown(this.cancelKey)) {
        this.choiceMode = false;
        this.renderDialogue();
      }
      return;
    }

    if (this.confirmPressed()) {
      if (this.lineIndex + 1 < this.activeBlock.lines.length) {
        this.lineIndex += 1;
        this.renderDialogue();
      } else if (this.activeBlock.choices) {
        this.choiceMode = true;
        this.renderChoices();
      } else {
        const completedDialogueId = this.activeDialogueId;
        this.closeDialogue();
        if (completedDialogueId === 'dormitorielGuide') {
          this.state.flags.welfareGuideSeen = true;
          saveGameState(this.state);
        }
        if (completedDialogueId === 'rankedIntroduction') {
          this.state.flags.rankedIntroduced = true;
          saveGameState(this.state);
        }
        if (completedDialogueId === 'proggithub') {
          this.startEncounter('proggithub_tutorial');
          return;
        }
        if (completedDialogueId === 'ranked') {
          this.startEncounter('ranked_first');
          return;
        }
        if (this.room === 'flower') this.startEncounter('bully_tutorial');
        if (this.room === 'bully_room') this.startEncounter('bully_tutorial');
        if (this.room === 'nerd') this.startEncounter('nerd_first');
        if (this.room === 'rescue') this.changeRoom('welfare');
      }
    }
  }

  private handleChoice(nextId: string): void {
    void nextId;
    this.state.flags.dormitorielMet = true;
    saveGameState(this.state);
    this.closeDialogue();
    this.changeRoom('welfare');
  }

  private renderDialogue(): void {
    if (!this.activeBlock || !this.dialogueText || !this.dialogueSpeaker) return;
    this.dialogueSpeaker.setText(this.activeBlock.speaker);
    this.dialogueText.setText(this.activeBlock.lines[this.lineIndex]);
    const portraits: Record<string, string> = {
      '불리': 'bully',
      '도미토리엘': 'dormitoriel',
      '프로깃허브': 'proggithub',
      '전교 2등': 'ranked',
      '너드스타블룩': 'nerd',
    };
    const portrait = portraits[this.activeBlock.speaker] ?? 'player';
    this.dialoguePortrait?.setTexture(portrait).setDisplaySize(48, 72);
    this.prompt?.setText('');
    this.clearChoices();
  }

  private renderChoices(): void {
    if (!this.activeBlock?.choices) return;
    this.clearChoices();
    this.dialogueContinue?.setText('↑ ↓  Z / Enter');
    this.activeBlock.choices.forEach((choice, index) => {
      const marker = index === this.selectedChoice ? '▶ ' : '  ';
      this.choiceTexts.push(this.add.text(150, 416 + index * 27,
        `${marker}${choice.label}`, {
          color: index === this.selectedChoice ? '#fbbf24' : '#f8fafc',
          backgroundColor: '#101827',
          padding: { x: 8, y: 4 },
          fontFamily: 'monospace',
          fontSize: '16px',
        }));
    });
  }

  private clearChoices(): void {
    this.choiceTexts.forEach((text) => text.destroy());
    this.choiceTexts = [];
  }

  private closeDialogue(): void {
    this.dialoguePanel?.destroy();
    this.dialogueSpeaker?.destroy();
    this.dialogueText?.destroy();
    this.dialoguePortrait?.destroy();
    this.dialogueContinue?.destroy();
    this.clearChoices();
    this.dialoguePanel = undefined;
    this.dialogueSpeaker = undefined;
    this.dialogueText = undefined;
    this.dialoguePortrait = undefined;
    this.dialogueContinue = undefined;
    this.activeBlock = undefined;
    this.activeDialogueId = undefined;
    this.dialogueOpen = false;
  }

  private changeRoom(room: RoomId, spawn?: { x: number; y: number }): void {
    const defaultSpawn: Partial<Record<RoomId, { x: number; y: number }>> = {
      welfare: { x: 130, y: 350 },
      switch_hall: { x: 130, y: 350 },
      practice: { x: 130, y: 350 },
      rest: { x: 130, y: 350 },
      supply: { x: 480, y: 380 },
      hallway: { x: 130, y: 350 },
      nerd: { x: 130, y: 350 },
    };
    this.state.sceneId = room;
    const position = spawn ?? defaultSpawn[room];
    if (position) this.state.spawnPosition = { sceneId: room, ...position };
    saveGameState(this.state);
    this.registry.set('completedEncounter', undefined);
    this.scene.restart();
  }

  private startEncounter(id: EncounterId): void {
    this.state.encounterReturn = {
      sceneId: this.room,
      x: this.player.x,
      y: this.player.y,
    };
    this.state.spawnPosition = this.state.encounterReturn;
    saveGameState(this.state);
    this.registry.set('encounterId', id);
    this.scene.start('BattleScene');
  }

  private openStatus(): void {
    this.statusOpen = true;
    const panel = this.add.rectangle(480, 300, 440, 220, 0x090d16, 0.98)
      .setStrokeStyle(3, 0xf8fafc);
    const title = this.add.text(480, 230, '상태', {
      color: '#f8fafc',
      fontFamily: 'monospace',
      fontSize: '24px',
    }).setOrigin(0.5);
    const content = this.add.text(260, 280,
      `이름  ${this.state.playerName || 'PLAYER'}\n소지품  ${this.state.flags.candy ? '사탕 1개' : '없음'}\n체력  20/20`, {
        color: '#cbd5e1',
        fontFamily: 'monospace',
        fontSize: '16px',
        lineSpacing: 8,
      });
    const resetButton = this.add.rectangle(480, 390, 180, 34, 0x7f1d1d)
      .setStrokeStyle(2, 0xfca5a5)
      .setInteractive({ useHandCursor: true });
    const resetLabel = this.add.text(480, 390, '처음부터 초기화', {
      color: '#fff1f2',
      fontFamily: 'monospace',
      fontSize: '15px',
    }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    resetButton.on('pointerdown', () => this.resetGame());
    resetLabel.on('pointerdown', () => this.resetGame());
    this.statusPanel = this.add.container(0, 0, [
      panel,
      title,
      content,
      resetButton,
      resetLabel,
    ]);
  }

  private closeStatus(): void {
    this.statusPanel?.destroy();
    this.statusPanel = undefined;
    this.statusOpen = false;
  }

  private resetGame(): void {
    this.state = createInitialState();
    saveGameState(this.state);
    this.registry.set('completedEncounter', undefined);
    this.registry.set('encounterId', undefined);
    this.scene.restart();
  }
}
