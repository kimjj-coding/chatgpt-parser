export type DialogueChoice = {
  label: string;
  next: string;
};

export type DialogueBlock = {
  speaker: string;
  lines: string[];
  choices?: DialogueChoice[];
};

export const openingDialogue: Record<string, DialogueBlock> = {
  bully: {
    speaker: '불리',
    lines: [
      '처음 보는 얼굴이네. 겁먹지 마, 내가 친절하게 알려줄게.',
      '여기선 반짝이는 걸 받으면 된다고들 하지. 가까이 와 봐.',
      '괜찮아. 다들 처음엔 설명을 믿거든.',
    ],
  },
  dormitoriel: {
    speaker: '도미토리엘',
    lines: [
      '괜찮니? 다친 곳은 없는지 보자.',
      '나는 교육복지반을 맡고 있는 도미토리엘이란다.',
      '혼자 두지 않을게. 우선 안전한 곳으로 가자.',
    ],
  },
  dormitorielGuide: {
    speaker: '도미토리엘',
    lines: [
      '복도는 낡았지만, 길을 알려주는 표시가 남아 있단다.',
      '안내판에 적힌 모양을 순서대로 밟아야 문이 열린단다.',
      '급하게 외울 필요는 없어. 네가 길을 찾는 동안 여기서 기다릴게.',
    ],
  },
  proggithub: {
    speaker: '프로깃허브',
    lines: [
      '개구리허브 안내소에 온 걸 환영해.',
      '명령은 네 차례에 고르고, 상대의 차례에는 상자 안을 움직여 피하면 돼.',
      '말을 건네 상황을 바꾼 다음, 자비를 골라 마무리해 보렴.',
    ],
  },
  rankedIntroduction: {
    speaker: '도미토리엘',
    lines: [
      '저기 책을 든 학생이 전교 2등이야. 성적표보다 책을 더 믿는 아이란다.',
      '깜짝 놀라게 하지 말고, 먼저 인사해 보렴.',
      '……아, 벌써 눈치챈 모양이네.',
    ],
  },
  rankedIntroductionAgain: {
    speaker: '도미토리엘',
    lines: ['책을 아끼는 아이야. 놀라게 하지 않도록 살며시 다가가렴.'],
  },
  ranked: {
    speaker: '전교 2등',
    lines: [
      '어, 도미토리엘 선생님이 말한 새 학생이구나.',
      '미안, 다음 수업 전에 읽을 게 남아서!',
    ],
  },
  nerd: {
    speaker: '너드스타블룩',
    lines: [
      '저기… 지금 지나가려는 거야?',
      '나, 이 책을 다 읽고 나면 비켜줄게.',
      '혹시… 잠깐 소개해도 괜찮을까?',
    ],
  },
};
