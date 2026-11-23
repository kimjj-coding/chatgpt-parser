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
      '이제 모두가 너의 도움이 필요하다고는 하지 않아.',
      '이 꽃밭의 규칙은 간단해. 움직이면 길이 보이지.',
      '가까이 다가오는 표정은 좋은데, 그 표정만 믿으면 안 돼.',
    ],
  },
  dormitoriel: {
    speaker: '도미토리엘',
    lines: [
      '괜찮니? 다친 곳은 없는지 보자.',
      '내가 이곳을 지키는 교육복지반의 담임이다.',
      '이제부터 이 길을 내가 안내할게. 나를 따라와.',
    ],
  },
  nerd: {
    speaker: '너드스타블룩',
    lines: [
      '어… 잠깐만.',
      '이 복도는 내가 막고 있어.',
      '내가 보는 만화 이야기를 들으면 길을 줄까.',
    ],
  },
};
