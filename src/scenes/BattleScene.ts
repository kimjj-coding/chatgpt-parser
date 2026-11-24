import Phaser from 'phaser';
import { loadGameState, saveGameState } from '../state/gameState';

type EncounterId = 'bully_tutorial' | 'ranked_first' | 'nerd_first';
type BattlePhase = 'bully_intro' | 'menu' | 'act' | 'fight' | 'pattern' | 'result';

export class BattleScene extends Phaser.Scene {
  private encounter: EncounterId = 'bully_tutorial';
  private phase: BattlePhase = 'bully_intro';
  private selectedMenu = 0;
  private selectedAct = 0;
  private resolve = 0;
  private positiveActs = 0;
  private hp = 20;
  private enemyHp = 100;
  private fightTarget!: Phaser.GameObjects.Rectangle;
  private fightMarker!: Phaser.GameObjects.Rectangle;
  private fightDirection = 1;
  private heart!: Phaser.GameObjects.Rectangle;
  private enemy!: Phaser.GameObjects.Rectangle;
  private statusText!: Phaser.GameObjects.Text;
  private messageText!: Phaser.GameObjects.Text;
  private menuTexts: Phaser.GameObjects.Text[] = [];
  private actTexts: Phaser.GameObjects.Text[] = [];
  private bullets: Phaser.GameObjects.Rectangle[] = [];
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private confirmKey!: Phaser.Input.Keyboard.Key;
  private enterKey!: Phaser.Input.Keyboard.Key;
  private cancelKey!: Phaser.Input.Keyboard.Key;
  private invulnerableUntil = 0;
  private patternTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super('BattleScene');
  }

  preload(): void {
    this.load.svg('battle-bully', '/assets/bully.svg');
    this.load.svg('battle-ranked', '/assets/ranked.svg');
    this.load.svg('battle-nerd', '/assets/nerd.svg');
  }

  create(): void {
    this.encounter = (this.registry.get('encounterId') as EncounterId) || 'bully_tutorial';
    this.phase = this.encounter === 'bully_tutorial' ? 'bully_intro' : 'menu';
    this.selectedMenu = 0;
    this.selectedAct = 0;
    this.resolve = 0;
    this.positiveActs = 0;
    this.hp = 20;
    this.enemyHp = 100;
    this.menuTexts = [];
    this.actTexts = [];
    this.bullets = [];

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.confirmKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    this.enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.cancelKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.X);

    this.cameras.main.setBackgroundColor('#090b12');
    this.add.rectangle(480, 270, 960, 540, 0x090b12);
    this.add.rectangle(480, 82, 960, 2, 0x303b4d);
    const battleSprite = this.encounter === 'bully_tutorial'
      ? 'battle-bully'
      : this.encounter === 'ranked_first'
        ? 'battle-ranked'
        : 'battle-nerd';
    this.enemy = this.add.rectangle(480, 170, 78, 78, 0x090b12, 0);
    this.add.image(480, 170, battleSprite).setDisplaySize(
      this.encounter === 'ranked_first' ? 92 : 96,
      this.encounter === 'ranked_first' ? 112 : 116,
    );
    this.add.text(480, 220,
      this.encounter === 'bully_tutorial'
        ? '불리'
        : this.encounter === 'ranked_first'
          ? '전교 2등'
          : '너드스타블룩', {
        color: '#dfe7ef',
        fontFamily: 'monospace',
        fontSize: '15px',
      }).setOrigin(0.5);

    this.add.rectangle(480, 370, 760, 216, 0x111827)
      .setStrokeStyle(3, 0xf8fafc);
    this.heart = this.add.rectangle(480, 370, 18, 18, 0xf87171)
      .setStrokeStyle(2, 0xfecaca);
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
      this.messageText.setText('불리의 화려한 설명을 따라서 움직여 보자.');
      this.time.delayedCall(1800, () => this.beginBullyIntroPattern());
    } else if (this.encounter === 'ranked_first') {
      this.messageText.setText('전교 2등은 책에서 눈을 떼지 않는다.');
      this.renderMenu();
    } else {
      this.messageText.setText('너드스타블룩이 복도를 막는다.');
      this.renderMenu();
    }
  }

  update(time: number): void {
    if (this.phase === 'bully_intro') return;
    if (this.phase === 'menu') this.updateMenu();
    if (this.phase === 'act') this.updateAct();
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
      bullet.x += bullet.getData('vx') as number;
      bullet.y += bullet.getData('vy') as number;
      bullet.angle += bullet.getData('spin') as number;

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
    this.statusText.setText(`HP ${this.hp}/20`);
  }

  private confirmPressed(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.confirmKey) ||
      Phaser.Input.Keyboard.JustDown(this.enterKey);
  }

  private renderMenu(): void {
    this.phase = 'menu';
    this.clearMenu();
    const labels = ['FIGHT', 'ACT', 'ITEM', 'MERCY'];
    labels.forEach((label, index) => {
      const marker = index === this.selectedMenu ? '▶ ' : '  ';
      this.menuTexts.push(this.add.text(
        120 + index * 190,
        420,
        `${marker}${label}`,
        {
          color: index === this.selectedMenu ? '#fbbf24' : '#f8fafc',
          backgroundColor: '#101827',
          padding: { x: 8, y: 6 },
          fontFamily: 'monospace',
          fontSize: '17px',
        },
      ));
    });
  }

  private clearMenu(): void {
    this.menuTexts.forEach((text) => text.destroy());
    this.menuTexts = [];
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
    this.fightMarker.destroy();
    this.fightTarget.destroy();
    this.messageText.setText(`${damage}의 피해를 주었다.`);
    this.resolve = Math.max(0, this.resolve - 10);

    this.time.delayedCall(800, () => {
      if (this.enemyHp === 0) {
        this.finishNerd();
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
    if (this.encounter === 'ranked_first') {
      this.finishRanked();
      return;
    }
    if (this.selectedMenu === 0) {
      this.beginFight();
      return;
    }
    if (this.selectedMenu === 1) {
      this.phase = 'act';
      this.renderActs();
      return;
    }
    if (this.selectedMenu === 2) {
      this.messageText.setText('가지고 있는 장비나 아이템이 없다.');
      this.renderMenu();
      return;
    }
    this.tryMercy();
  }

  private actLabels(): string[] {
    return ['관찰', '관심을 보인다', '조롱한다'];
  }

  private renderActs(): void {
    this.clearMenu();
    this.actTexts.forEach((text) => text.destroy());
    this.actTexts = [];
    this.actLabels().forEach((label, index) => {
      const marker = index === this.selectedAct ? '▶ ' : '  ';
      this.actTexts.push(this.add.text(120, 410 + index * 34,
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
    if (this.encounter === 'ranked_first') {
      this.finishRanked();
      return;
    }
    this.actTexts.forEach((text) => text.destroy());
    this.actTexts = [];
    const label = this.actLabels()[this.selectedAct];
    if (label === '조롱한다') {
      this.resolve = Math.max(0, this.resolve - 34);
      this.messageText.setText('너드스타블룩의 말이 잠긴다.');
    } else if (label === '관심을 보인다') {
      this.resolve = Math.min(100, this.resolve + 34);
      this.positiveActs += 1;
      this.messageText.setText('추천 만화에 관심을 보인다.');
    } else if (label === '관찰') {
      this.resolve = Math.min(100, this.resolve + (this.encounter === 'nerd_first' ? 34 : 20));
      this.positiveActs += 1;
      this.messageText.setText('상대의 행동과 말 사이의 차이를 확인한다.');
    } else {
      this.resolve = Math.min(100, this.resolve + 15);
      this.positiveActs += 1;
      this.messageText.setText('먼저 피할 수 있는 길을 찾는다.');
    }
    this.updateStatus();
    this.startPattern();
  }

  private tryMercy(): void {
    if (this.encounter === 'ranked_first') {
      this.finishRanked();
      return;
    }
    if (this.encounter === 'bully_tutorial') {
      this.messageText.setText('불리는 자비를 시험하지 않는다.');
      this.startPattern();
      return;
    }
    if (this.resolve >= 68) this.finishNerd();
    else {
      this.messageText.setText('너드스타블룩은 아직 길을 비키지 않는다.');
      this.startPattern();
    }
  }

  private startPattern(): void {
    this.phase = 'pattern';
    this.clearMenu();
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
    this.heart.setPosition(480, 370);
    this.clearBullets();
    this.spawnPattern();
    this.messageText.setText('불리의 탄막을 피하라.');
    this.patternTimer?.remove();
    this.patternTimer = this.time.delayedCall(3600, () => this.finishBully());
  }

  private spawnPattern(): void {
    const count = this.encounter === 'bully_tutorial'
      ? 8
      : this.resolve >= 68
        ? 6
        : 14;
    for (let i = 0; i < count; i += 1) {
      const fromLeft = i % 2 === 0;
      const bullet = this.add.rectangle(
        fromLeft ? 105 : 855,
        300 + (i % 6) * 28,
        12,
        12,
        this.encounter === 'bully_tutorial' ? 0xf59e0b : 0x93c5fd,
      ).setStrokeStyle(1, 0xffffff);
      bullet.setData('vx', fromLeft ? 1.25 : -1.25);
      bullet.setData('vy', i % 2 === 0 ? 0.75 : -0.55);
      bullet.setData('spin', fromLeft ? 2 : -2);
      this.bullets.push(bullet);
    }
  }

  private finishPattern(): void {
    if (this.phase !== 'pattern') return;
    this.clearBullets();
    if (this.encounter === 'nerd_first' && this.positiveActs >= 3) {
      this.finishNerd();
    } else {
      this.phase = 'menu';
      this.renderMenu();
    }
  }

  private finishBully(): void {
    this.phase = 'result';
    this.clearBullets();
    this.messageText.setText('도미토리엘이 개입해 불리를 물리친다.');
    const state = loadGameState();
    state.flags.bullyTutorial = true;
    state.sceneId = 'rescue';
    saveGameState(state);
    this.registry.set('completedEncounter', 'bully_tutorial');
    this.time.delayedCall(2200, () => this.scene.start('SchoolScene'));
  }

  private finishRanked(): void {
    this.phase = 'result';
    this.clearMenu();
    this.actTexts.forEach((text) => text.destroy());
    this.actTexts = [];
    this.messageText.setText('전교 2등은 책을 챙겨 복도 끝으로 달아난다.');
    const state = loadGameState();
    state.flags.rankedFirstEncounter = true;
    state.sceneId = 'hallway';
    saveGameState(state);
    this.registry.set('completedEncounter', 'ranked_first');
    this.time.delayedCall(1500, () => this.scene.start('SchoolScene'));
  }

  private finishNerd(): void {
    this.phase = 'result';
    this.clearBullets();
    this.messageText.setText('너드스타블룩은 추천을 멈추고 길을 비킨다.');
    const state = loadGameState();
    state.flags.nerdFirstEncounter = true;
    state.routeHint = this.positiveActs >= 3 ? 'peace' : 'mixed';
    state.sceneId = 'nerd';
    saveGameState(state);
    this.registry.set('completedEncounter', 'nerd_first');
    this.time.delayedCall(2200, () => this.scene.start('SchoolScene'));
  }

  private handleDefeat(): void {
    if (this.phase === 'result') return;
    this.phase = 'result';
    this.clearBullets();
    this.messageText.setText('HP가 전부 줄었다.');
    const state = loadGameState();
    state.recordRisk += 1;
    saveGameState(state);
    this.time.delayedCall(1800, () => {
      state.sceneId = this.encounter === 'bully_tutorial'
        ? 'flower'
        : this.encounter === 'ranked_first'
          ? 'hallway'
          : 'nerd';
      saveGameState(state);
      this.scene.start('SchoolScene');
    });
  }

  private clearBullets(): void {
    this.bullets.forEach((bullet) => bullet.destroy());
    this.bullets = [];
  }
}
