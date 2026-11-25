import Phaser from 'phaser';
import { loadGameState, saveGameState } from '../state/gameState';

type EncounterId =
  | 'bully_tutorial'
  | 'proggithub_tutorial'
  | 'proggithub_random'
  | 'ranked_first'
  | 'nerd_first';
type BattlePhase = 'bully_intro' | 'menu' | 'act' | 'item' | 'fight' | 'pattern' | 'result';

export class BattleScene extends Phaser.Scene {
  private encounter: EncounterId = 'bully_tutorial';
  private phase: BattlePhase = 'bully_intro';
  private selectedMenu = 0;
  private selectedAct = 0;
  private resolve = 0;
  private positiveActs = 0;
  private hp = 20;
  private enemyHp = 100;
  private attacksUsed = 0;
  private mercyReady = false;
  private fightTarget!: Phaser.GameObjects.Rectangle;
  private fightMarker!: Phaser.GameObjects.Rectangle;
  private fightDirection = 1;
  private heart!: Phaser.GameObjects.Text;
  private enemy!: Phaser.GameObjects.Rectangle;
  private statusText!: Phaser.GameObjects.Text;
  private messageText!: Phaser.GameObjects.Text;
  private menuTexts: Phaser.GameObjects.Text[] = [];
  private menuPanel?: Phaser.GameObjects.Rectangle;
  private actTexts: Phaser.GameObjects.Text[] = [];
  private bullets: Phaser.GameObjects.Image[] = [];
  private itemIcon?: Phaser.GameObjects.Image;
  private patternHelp?: Phaser.GameObjects.Text;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private confirmKey!: Phaser.Input.Keyboard.Key;
  private enterKey!: Phaser.Input.Keyboard.Key;
  private cancelKey!: Phaser.Input.Keyboard.Key;
  private invulnerableUntil = 0;
  private patternTimer?: Phaser.Time.TimerEvent;
  private encounterTitle!: Phaser.GameObjects.Text;
  private selectedItem = 0;
  private itemTexts: Phaser.GameObjects.Text[] = [];
  private actResult = '';

  constructor() {
    super('BattleScene');
  }

  private finishProggithub(): void {
    this.phase = 'result';
    this.clearMenu();
    this.clearBullets();
    this.messageText.setText('프로깃허브는 고개를 끄덕이고 연습실 문을 열어준다.');
    const state = loadGameState();
    state.flags.proggithubTutorial = true;
    state.sceneId = 'practice';
    if (state.encounterReturn) state.spawnPosition = state.encounterReturn;
    saveGameState(state);
    this.registry.set('completedEncounter', 'proggithub_tutorial');
    this.time.delayedCall(1500, () => this.scene.start('SchoolScene'));
  }

  preload(): void {
    this.load.svg('battle-bully', '/assets/bully.svg');
    this.load.svg('battle-ranked', '/assets/ranked.svg');
    this.load.svg('battle-nerd', '/assets/nerd.svg');
    this.load.svg('battle-proggithub', '/assets/proggithub.svg');
    this.load.svg('projectile-cigarette', '/assets/projectile-cigarette.svg');
    this.load.svg('projectile-bottle', '/assets/projectile-bottle.svg');
    this.load.svg('projectile-paper', '/assets/projectile-paper.svg');
    this.load.svg('projectile-comic', '/assets/projectile-comic.svg');
    this.load.svg('candy-item', '/assets/candy.svg');
  }

  create(): void {
    this.encounter = (this.registry.get('encounterId') as EncounterId) || 'bully_tutorial';
    this.phase = this.encounter === 'bully_tutorial' ? 'bully_intro' : 'menu';
    this.selectedMenu = 0;
    this.selectedAct = 0;
    this.resolve = 0;
    this.positiveActs = 0;
    this.mercyReady = false;
    this.hp = 20;
    this.enemyHp = 100;
    this.attacksUsed = 0;
    this.menuTexts = [];
    this.actTexts = [];
    this.itemTexts = [];
    this.bullets = [];

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.confirmKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    this.enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.cancelKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.X);

    this.cameras.main.setBackgroundColor('#090b12');
    this.add.rectangle(480, 270, 960, 540, 0x090b12);
    this.add.rectangle(480, 82, 960, 2, 0x303b4d);
    this.encounterTitle = this.add.text(120, 30, this.encounterName(), {
      color: '#f8fafc',
      fontFamily: 'monospace',
      fontSize: '18px',
    });
    this.add.text(320, 30, loadGameState().playerName || 'PLAYER', {
      color: '#fbbf24',
      fontFamily: 'monospace',
      fontSize: '18px',
    });
    const battleSprite = this.encounter === 'bully_tutorial'
      ? 'battle-bully'
      : this.encounter === 'ranked_first'
        ? 'battle-ranked'
        : this.encounter === 'proggithub_tutorial' || this.encounter === 'proggithub_random'
          ? 'battle-proggithub'
          : 'battle-nerd';
    this.enemy = this.add.rectangle(480, 136, 78, 78, 0x090b12, 0);
    this.add.image(480, 148, battleSprite).setDisplaySize(100, 134);
    this.add.text(480, 230, this.encounterEnemyName(), {
      color: '#f8fafc',
      backgroundColor: '#111827',
      padding: { x: 8, y: 4 },
      fontFamily: 'monospace',
      fontSize: '15px',
    }).setOrigin(0.5);

    this.add.rectangle(480, 370, 760, 216, 0x111827)
      .setStrokeStyle(3, 0xf8fafc);
    this.heart = this.add.text(480, 370, '♥', {
      color: '#f87171',
      fontFamily: 'monospace',
      fontSize: '26px',
    }).setOrigin(0.5);
    this.statusText = this.add.text(120, 270, '', {
      color: '#cbd5e1',
      fontFamily: 'monospace',
      fontSize: '14px',
    });
    this.messageText = this.add.text(120, 302, '', {
      color: '#f8fafc',
      fontFamily: 'monospace',
      fontSize: '16px',
      wordWrap: { width: 720 },
    });
    this.updateStatus();
    if (this.encounter === 'bully_tutorial') {
      this.messageText.setText('불리는 웃으며 손을 내민다. 손끝에서 연기가 피어오른다.');
      this.time.delayedCall(1800, () => this.beginBullyIntroPattern());
    } else if (this.encounter === 'ranked_first') {
      this.messageText.setText('전교 2등이 책을 꼭 끌어안고 뒤로 물러선다.');
      this.renderMenu();
    } else if (this.encounter === 'proggithub_tutorial') {
      this.messageText.setText('차례가 바뀌면 상자 안을 움직여 피한다. 순서대로 해 보자.');
      this.renderMenu();
    } else if (this.encounter === 'proggithub_random') {
      this.messageText.setText('프로깃허브가 복도에서 급히 지나가려 한다.');
      this.renderMenu();
    } else {
      this.messageText.setText('너드스타블룩이 복도를 막는다.');
      this.renderMenu();
    }
  }

  private encounterName(): string {
    if (this.encounter === 'bully_tutorial') return '첫 만남';
    if (this.encounter === 'ranked_first') return '기초학력동';
    if (this.encounter === 'nerd_first') return '복도에서 만난 학생';
    return '교육복지반 모의 전투';
  }

  private encounterEnemyName(): string {
    if (this.encounter === 'bully_tutorial') return '불리';
    if (this.encounter === 'ranked_first') return '전교 2등';
    if (this.encounter === 'nerd_first') return '너드스타블룩';
    return '프로깃허브';
  }

  update(time: number, delta: number): void {
    if (this.phase === 'bully_intro') return;
    if (this.phase === 'menu') this.updateMenu();
    if (this.phase === 'act') this.updateAct();
    if (this.phase === 'item') this.updateItems();
    if (this.phase === 'fight') {
      this.updateFight();
      return;
    }
    if (this.phase !== 'pattern') return;

    if (this.cursors.left.isDown) this.heart.x -= 3.1;
    if (this.cursors.right.isDown) this.heart.x += 3.1;
    if (this.cursors.up.isDown) this.heart.y -= 3.1;
    if (this.cursors.down.isDown) this.heart.y += 3.1;
    this.heart.x = Phaser.Math.Clamp(this.heart.x, 118, 842);
    this.heart.y = Phaser.Math.Clamp(this.heart.y, 282, 478);

    for (const bullet of this.bullets) {
      if (!bullet.active) continue;
      const frameScale = delta / 16.667;
      bullet.x += (bullet.getData('vx') as number) * frameScale;
      bullet.y += (bullet.getData('vy') as number) * frameScale;
      bullet.angle += (bullet.getData('spin') as number) * frameScale;

      if (bullet.x < 94 || bullet.x > 866 || bullet.y < 260 || bullet.y > 500) {
        bullet.destroy();
      } else if (time > this.invulnerableUntil &&
        Phaser.Math.Distance.Between(this.heart.x, this.heart.y, bullet.x, bullet.y) < 23) {
        this.hp = Math.max(0, this.hp - 5);
        this.invulnerableUntil = time + 650;
        this.updateStatus();
        if (this.hp === 0) this.handleDefeat();
      }
    }
  }

  private updateStatus(): void {
    this.statusText.setText(this.encounter === 'nerd_first'
      ? `HP ${this.hp}/20     대화 진전 ${Math.min(this.positiveActs, 2)}/2`
      : `HP ${this.hp}/20`);
  }

  private confirmPressed(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.confirmKey) ||
      Phaser.Input.Keyboard.JustDown(this.enterKey);
  }

  private renderMenu(): void {
    this.phase = 'menu';
    this.clearMenu();
    this.menuPanel = this.add.rectangle(480, 432, 770, 54, 0x18202d)
      .setStrokeStyle(2, 0x9b8a6c);
    const labels = ['FIGHT', 'ACT', 'ITEM', 'MERCY'];
    labels.forEach((label, index) => {
      const marker = index === this.selectedMenu ? '▶ ' : '  ';
      this.menuTexts.push(this.add.text(
        112 + index * 186,
        432,
        `${marker}${label}`,
        {
          color: index === this.selectedMenu ? '#fbbf24' : '#f8fafc',
          backgroundColor: '#101827',
          padding: { x: 8, y: 6 },
          fontFamily: 'monospace',
          fontSize: '16px',
        },
      ));
    });
    this.menuTexts.push(this.add.text(480, 468, '← → 선택     Z / Enter 결정     X 돌아가기', {
      color: '#94a3b8',
      fontFamily: 'monospace',
      fontSize: '13px',
    }).setOrigin(0.5));
  }

  private clearMenu(): void {
    this.menuTexts.forEach((text) => text.destroy());
    this.menuTexts = [];
    this.menuPanel?.destroy();
    this.menuPanel = undefined;
  }

  private beginFight(): void {
    this.phase = 'fight';
    this.clearMenu();
    this.messageText.setText('조준 마커의 위치를 선택해 공격한다.');
    this.fightTarget = this.add.rectangle(480, 370, 500, 24, 0x1f2937)
      .setStrokeStyle(3, 0xf8fafc);
    this.fightMarker = this.add.rectangle(230, 370, 12, 38, 0xef4444)
      .setStrokeStyle(2, 0xfecaca);
    this.fightDirection = 1;
  }

  private updateFight(): void {
    this.fightMarker.x += this.fightDirection * 5;
    if (this.fightMarker.x >= 730) {
      this.fightMarker.x = 730;
      this.fightDirection = -1;
    } else if (this.fightMarker.x <= 230) {
      this.fightMarker.x = 230;
      this.fightDirection = 1;
    }
    if (!this.confirmPressed()) return;

    const distanceFromCenter = Math.abs(this.fightMarker.x - 480);
    const damage = Math.max(8, 24 - Math.round(distanceFromCenter / 12));
    this.enemyHp = Math.max(0, this.enemyHp - damage);
    this.attacksUsed += 1;
    this.fightMarker.destroy();
    this.fightTarget.destroy();
    this.messageText.setText(`${damage}의 피해를 주었다.`);
    this.resolve = Math.max(0, this.resolve - 10);

    this.time.delayedCall(800, () => {
      if (this.encounter === 'ranked_first') {
        this.finishRanked('책을 향해 손을 뻗었다');
      } else if (this.enemyHp === 0) {
        if (this.encounter === 'proggithub_tutorial') this.finishProggithub();
        else if (this.encounter === 'proggithub_random') this.finishRandomProggithub();
        else this.finishNerd(true);
      } else {
        this.startPattern();
      }
    });
  }

  private updateMenu(): void {
    if (Phaser.Input.Keyboard.JustDown(this.cursors.left!) ||
      Phaser.Input.Keyboard.JustDown(this.cursors.up!)) {
      this.selectedMenu = (this.selectedMenu + 3) % 4;
      this.renderMenu();
    }
    if (Phaser.Input.Keyboard.JustDown(this.cursors.right!) ||
      Phaser.Input.Keyboard.JustDown(this.cursors.down!)) {
      this.selectedMenu = (this.selectedMenu + 1) % 4;
      this.renderMenu();
    }
    if (this.confirmPressed()) this.chooseMenu();
  }

  private chooseMenu(): void {
    if (this.selectedMenu === 0) {
      this.beginFight();
      return;
    }
    if (this.selectedMenu === 1) {
      this.selectedAct = 0;
      this.phase = 'act';
      this.renderActs();
      return;
    }
    if (this.selectedMenu === 2) {
      this.renderItems();
      return;
    }
    this.tryMercy();
  }

  private useItem(): void {
    const state = loadGameState();
    if (!state.flags.candy) {
      this.messageText.setText('가방 안에 먹을 것이 없다.');
      this.renderMenu();
      return;
    }
    if (this.hp >= 20) {
      this.messageText.setText('아직 사탕을 먹을 필요는 없다.');
      this.renderMenu();
      return;
    }
    this.hp = Math.min(20, this.hp + 8);
    state.flags.candy = false;
    saveGameState(state);
    this.updateStatus();
    this.messageText.setText('사탕을 먹었다. 조금 기운이 난다.');
    if (this.encounter === 'ranked_first') this.finishRanked('사탕을 꺼냈다');
    else this.startPattern();
  }

  private renderItems(): void {
    this.phase = 'item';
    this.clearMenu();
    this.menuTexts.push(this.add.text(480, 468, '↑ ↓ 선택     Z / Enter 사용     X 돌아가기', {
      color: '#94a3b8',
      fontFamily: 'monospace',
      fontSize: '13px',
    }).setOrigin(0.5));
    const state = loadGameState();
    const entries = state.flags.candy ? ['학교 사탕  ·  HP 회복', '돌아가기'] : ['돌아가기'];
    if (state.flags.candy) {
      this.itemIcon = this.add.image(128, 411, 'candy-item').setDisplaySize(28, 28);
    }
    this.itemTexts = entries.map((entry, index) => this.add.text(
      150, 405 + index * 34,
      `${index === this.selectedItem ? '▶ ' : '  '}${entry}`,
      {
        color: index === this.selectedItem ? '#fbbf24' : '#f8fafc',
        backgroundColor: '#101827',
        padding: { x: 8, y: 5 },
        fontFamily: 'monospace',
        fontSize: '16px',
      },
    ));
  }

  private updateItems(): void {
    const state = loadGameState();
    const entries = state.flags.candy ? 2 : 1;
    if (Phaser.Input.Keyboard.JustDown(this.cursors.up!) ||
      Phaser.Input.Keyboard.JustDown(this.cursors.down!)) {
      this.selectedItem = (this.selectedItem + 1) % entries;
      this.itemTexts.forEach((text, index) => {
        text.setText(`${index === this.selectedItem ? '▶ ' : '  '}${state.flags.candy
          ? ['학교 사탕  ·  HP 회복', '돌아가기'][index]
          : '돌아가기'}`);
        text.setColor(index === this.selectedItem ? '#fbbf24' : '#f8fafc');
      });
    }
    if (Phaser.Input.Keyboard.JustDown(this.cancelKey)) {
      this.selectedItem = 0;
      this.itemTexts.forEach((text) => text.destroy());
      this.itemTexts = [];
      this.itemIcon?.destroy();
      this.itemIcon = undefined;
      this.renderMenu();
      return;
    }
    if (!this.confirmPressed()) return;
    if (state.flags.candy && this.selectedItem === 0) {
      this.itemTexts.forEach((text) => text.destroy());
      this.itemTexts = [];
      this.itemIcon?.destroy();
      this.itemIcon = undefined;
      this.useItem();
    } else {
      this.selectedItem = 0;
      this.itemTexts.forEach((text) => text.destroy());
      this.itemTexts = [];
      this.itemIcon?.destroy();
      this.itemIcon = undefined;
      this.renderMenu();
    }
  }

  private actLabels(): string[] {
    if (this.encounter === 'ranked_first') return ['인사한다', '책 이야기를 묻는다', '길을 비켜달라고 한다'];
    if (this.encounter === 'proggithub_tutorial' || this.encounter === 'proggithub_random') {
      return ['인사한다', '길을 비켜달라고 부탁한다', '규칙을 묻는다'];
    }
    if (this.encounter === 'nerd_first') return ['관심을 보인다', '더 추천해 달라고 한다', '조롱한다'];
    return ['관찰', '관심을 보인다', '조롱한다'];
  }

  private renderActs(): void {
    this.clearMenu();
    this.actTexts.forEach((text) => text.destroy());
    this.actTexts = [];
    this.menuTexts.push(this.add.text(480, 468, '↑ ↓ 선택     Z / Enter 결정     X 돌아가기', {
      color: '#94a3b8',
      fontFamily: 'monospace',
      fontSize: '13px',
    }).setOrigin(0.5));
    this.actLabels().forEach((label, index) => {
      const marker = index === this.selectedAct ? '▶ ' : '  ';
      this.actTexts.push(this.add.text(120, 394 + index * 31,
        `${marker}${label}`, {
          color: index === this.selectedAct ? '#fbbf24' : '#f8fafc',
          backgroundColor: '#101827',
          padding: { x: 8, y: 4 },
          fontFamily: 'monospace',
          fontSize: '17px',
        }));
    });
  }

  private updateAct(): void {
    if (Phaser.Input.Keyboard.JustDown(this.cursors.up!)) {
      this.selectedAct =
        (this.selectedAct - 1 + this.actLabels().length) % this.actLabels().length;
      this.renderActs();
    }
    if (Phaser.Input.Keyboard.JustDown(this.cursors.down!)) {
      this.selectedAct =
        (this.selectedAct + 1) % this.actLabels().length;
      this.renderActs();
    }
    if (Phaser.Input.Keyboard.JustDown(this.cancelKey)) {
      this.phase = 'menu';
      this.actTexts.forEach((text) => text.destroy());
      this.actTexts = [];
      this.renderMenu();
    }
    if (this.confirmPressed()) this.chooseAct();
  }

  private chooseAct(): void {
    this.actTexts.forEach((text) => text.destroy());
    this.actTexts = [];
    const label = this.actLabels()[this.selectedAct];
    if (this.encounter === 'ranked_first') {
      this.finishRanked(label);
      return;
    }
    if (this.encounter === 'proggithub_tutorial' || this.encounter === 'proggithub_random') {
      this.resolve = Math.min(100, this.resolve + 50);
      this.positiveActs += 1;
      this.mercyReady = true;
      this.messageText.setText(label === '규칙을 묻는다'
        ? '프로깃허브가 공격 방향을 손으로 가리킨다. 다음엔 상대 차례다.'
        : label === '길을 비켜달라고 부탁한다'
          ? '프로깃허브는 놀라서 옆으로 한 걸음 물러난다. 다음엔 상대 차례다.'
          : '프로깃허브가 고개를 끄덕이며 인사를 돌려준다. 다음엔 상대 차례다.');
      this.startPattern();
      return;
    }
    if (label === '조롱한다') {
      this.resolve = Math.max(0, this.resolve - 34);
      this.mercyReady = false;
      this.messageText.setText('너드스타블룩은 책을 가슴에 끌어안고 말수를 줄인다.');
    } else if (label === '관심을 보인다') {
      this.resolve = Math.min(100, this.resolve + 34);
      this.positiveActs += 1;
      this.messageText.setText('네가 고개를 끄덕이자, 너드스타블룩은 다음 권 이야기도 꺼낸다.');
      this.mercyReady = this.positiveActs >= 2;
    } else if (label === '관찰') {
      this.resolve = Math.min(100, this.resolve + (this.encounter === 'nerd_first' ? 34 : 20));
      this.positiveActs += 1;
      this.messageText.setText('상대의 행동과 말 사이의 차이를 확인한다.');
      this.mercyReady = this.positiveActs >= 2;
    } else if (this.encounter === 'nerd_first') {
      this.resolve = Math.min(100, this.resolve + 34);
      this.positiveActs += 1;
      this.mercyReady = this.positiveActs >= 2;
      this.messageText.setText(label === '더 추천해 달라고 한다'
        ? '너드스타블룩은 들뜬 표정으로 다음 이야기를 꺼낸다.'
        : '너드스타블룩은 책 표지를 조심스럽게 보여준다.');
    } else {
      this.resolve = Math.min(100, this.resolve + 15);
      this.positiveActs += 1;
      this.messageText.setText('먼저 피할 수 있는 길을 찾는다.');
    }
    this.updateStatus();
    this.startPattern();
  }

  private tryMercy(): void {
    if (this.encounter === 'bully_tutorial') {
      this.messageText.setText('불리는 자비를 시험하지 않는다.');
      this.startPattern();
      return;
    }
    if (this.encounter === 'ranked_first') {
      this.finishRanked('인사하려 했다');
      return;
    }
    if (this.encounter === 'proggithub_tutorial' || this.encounter === 'proggithub_random') {
      if (this.mercyReady) {
        if (this.encounter === 'proggithub_tutorial') this.finishProggithub();
        else this.finishRandomProggithub();
      }
      else {
        this.messageText.setText('먼저 ACT로 인사를 건네보자.');
        this.renderMenu();
      }
      return;
    }
    if (this.mercyReady) this.finishNerd();
    else {
      this.messageText.setText('너드스타블룩은 아직 이야기를 마치지 못했다.');
      this.startPattern();
    }
  }

  private startPattern(): void {
    this.phase = 'pattern';
    this.clearMenu();
    this.showPatternHelp();
    this.actTexts.forEach((text) => text.destroy());
    this.actTexts = [];
    this.heart.setPosition(480, 370);
    this.clearBullets();
    this.spawnPattern();
    this.patternTimer?.remove();
    this.patternTimer = this.time.delayedCall(3600, () => this.finishPattern());
  }

  private beginBullyIntroPattern(): void {
    if (this.phase !== 'bully_intro') return;
    this.phase = 'pattern';
    this.clearMenu();
    this.showPatternHelp();
    this.heart.setPosition(480, 370);
    this.clearBullets();
    this.spawnPattern();
    this.messageText.setText('연기와 유리병이 날아든다. 비어 있는 틈으로 피하자.');
    this.patternTimer?.remove();
    this.patternTimer = this.time.delayedCall(3600, () => this.finishBully());
  }

  private spawnPattern(): void {
    const count = this.encounter === 'bully_tutorial'
      ? 6
      : this.encounter === 'proggithub_tutorial' || this.encounter === 'proggithub_random'
        ? 5
        : this.encounter === 'nerd_first'
          ? this.mercyReady ? 4 : 7
          : 0;
    for (let i = 0; i < count; i += 1) {
      let key = 'projectile-paper';
      let x = 850;
      let y = 300 + (i % 5) * 34;
      let vx = -3.2;
      let vy = 0;
      let spin = 0;
      if (this.encounter === 'bully_tutorial') {
        key = i % 2 === 0 ? 'projectile-bottle' : 'projectile-cigarette';
        x = i % 2 === 0 ? 850 : 110;
        y = 304 + Math.floor(i / 2) * 48;
        vx = i % 2 === 0 ? -3.1 : 3.1;
        vy = i % 2 === 0 ? 0.15 : -0.15;
        spin = i % 2 === 0 ? -1.2 : 1.2;
      } else if (this.encounter === 'proggithub_tutorial' || this.encounter === 'proggithub_random') {
        x = 850;
        y = 300 + i * 31;
        vx = -3.4;
        vy = i % 2 === 0 ? 0.32 : -0.32;
      } else {
        key = 'projectile-comic';
        x = 230 + i * 84;
        y = 278;
        vx = (this.heart.x - x) * 0.008;
        vy = 2.3 + (i % 2) * 0.35;
        spin = i % 2 === 0 ? 1.2 : -1.2;
      }
      const bullet = this.add.image(x, y, key).setDisplaySize(28, 28);
      bullet.setData('vx', vx);
      bullet.setData('vy', vy);
      bullet.setData('spin', spin);
      this.bullets.push(bullet);
    }
  }

  private finishPattern(): void {
    if (this.phase !== 'pattern') return;
    this.clearBullets();
    this.clearPatternHelp();
    this.phase = 'menu';
    this.renderMenu();
  }

  private finishBully(): void {
    this.phase = 'result';
    this.clearBullets();
    this.clearPatternHelp();
    this.messageText.setText('도미토리엘이 개입해 불리를 물리친다.');
    const state = loadGameState();
    state.flags.bullyTutorial = true;
    state.sceneId = 'rescue';
    saveGameState(state);
    this.registry.set('completedEncounter', 'bully_tutorial');
    this.time.delayedCall(2200, () => this.scene.start('SchoolScene'));
  }

  private finishRanked(action: string): void {
    this.phase = 'result';
    this.clearMenu();
    this.actTexts.forEach((text) => text.destroy());
    this.actTexts = [];
    this.messageText.setText(action === '책을 향해 손을 뻗었다'
      ? '도미토리엘이 조용히 사이를 막는다. 전교 2등은 책을 챙겨 달아난다.'
      : '전교 2등은 책을 챙겨 서둘러 복도를 빠져나간다.');
    const state = loadGameState();
    state.flags.rankedFirstEncounter = true;
    state.sceneId = 'hallway';
    if (state.encounterReturn) state.spawnPosition = state.encounterReturn;
    saveGameState(state);
    this.registry.set('completedEncounter', 'ranked_first');
    this.time.delayedCall(1500, () => this.scene.start('SchoolScene'));
  }

  private finishRandomProggithub(): void {
    this.phase = 'result';
    this.clearMenu();
    this.clearBullets();
    this.messageText.setText('프로깃허브가 길을 비켜 준다.');
    const state = loadGameState();
    if (state.encounterReturn) {
      state.sceneId = state.encounterReturn.sceneId;
      state.spawnPosition = state.encounterReturn;
    }
    saveGameState(state);
    this.time.delayedCall(1100, () => this.scene.start('SchoolScene'));
  }

  private finishNerd(attacked = false): void {
    this.phase = 'result';
    this.clearBullets();
    this.messageText.setText(attacked
      ? '너드스타블룩은 다친 척을 하다가, 네가 걱정할까 봐 그랬다며 머쓱하게 비켜선다.'
      : '너드스타블룩은 책 이야기를 마치고 조심스럽게 길을 비킨다.');
    const state = loadGameState();
    state.flags.nerdFirstEncounter = true;
    state.routeHint = attacked ? 'violent' : this.positiveActs >= 2 ? 'peace' : 'mixed';
    state.sceneId = 'nerd';
    if (state.encounterReturn) state.spawnPosition = state.encounterReturn;
    saveGameState(state);
    this.registry.set('completedEncounter', 'nerd_first');
    this.time.delayedCall(2200, () => this.scene.start('SchoolScene'));
  }

  private handleDefeat(): void {
    if (this.phase === 'result') return;
    this.phase = 'result';
    this.clearBullets();
    this.clearPatternHelp();
    this.messageText.setText('의식이 흐려진다. 잠시 뒤 기록된 장소에서 눈을 뜬다.');
    const state = loadGameState();
    state.recordRisk += 1;
    saveGameState(state);
    this.time.delayedCall(1800, () => {
      if (state.checkpoint) {
        state.sceneId = state.checkpoint.sceneId;
        state.spawnPosition = state.checkpoint;
      } else if (state.encounterReturn) {
        state.sceneId = state.encounterReturn.sceneId;
        state.spawnPosition = state.encounterReturn;
      } else {
        state.sceneId = 'flower';
      }
      saveGameState(state);
      this.scene.start('SchoolScene');
    });
  }

  private clearBullets(): void {
    this.bullets.forEach((bullet) => bullet.destroy());
    this.bullets = [];
  }

  private showPatternHelp(): void {
    this.clearPatternHelp();
    this.patternHelp = this.add.text(480, 468, '← ↑ ↓ → 이동 · 탄환을 피해라', {
      color: '#94a3b8',
      fontFamily: 'monospace',
      fontSize: '13px',
    }).setOrigin(0.5);
  }

  private clearPatternHelp(): void {
    this.patternHelp?.destroy();
    this.patternHelp = undefined;
  }
}
