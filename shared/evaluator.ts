import { Card, NormalCard, Rank, Suit, rankValue, ranks, suits } from "./cards.js";

export type HandType =
  | "special235"
  | "triple"
  | "straightFlush"
  | "straight"
  | "flush"
  | "single";

export type DreamHand = {
  type: HandType;
  typeLabel: string;
  cards: NormalCard[];
  score: number[];
  description: string;
};

export type RuleOptions = {
  jokersWild: boolean;
  special235BeatsTriple: boolean;
};

const handTypePower: Record<HandType, number> = {
  single: 1,
  flush: 2,
  straight: 3,
  straightFlush: 4,
  triple: 5,
  special235: 6
};

const handTypeLabel: Record<HandType, string> = {
  special235: "235吃豹子",
  triple: "豹子",
  straightFlush: "同花顺",
  straight: "拖拉机",
  flush: "同花",
  single: "单张"
};

export function bestDreamHand(
  privateCard: Card,
  publicCard: Card,
  options: RuleOptions
): DreamHand {
  const candidates = buildCandidates(privateCard, publicCard, options);
  return candidates
    .map((cards) => evaluateNormalCards(cards, options))
    .filter((hand): hand is DreamHand => Boolean(hand))
    .sort(compareDreamHands)
    .at(-1)!;
}

export function compareDreamHands(a: DreamHand, b: DreamHand): number {
  const typeDiff = handTypePower[a.type] - handTypePower[b.type];
  if (typeDiff !== 0) {
    return typeDiff;
  }

  const length = Math.max(a.score.length, b.score.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (a.score[index] ?? 0) - (b.score[index] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

function buildCandidates(privateCard: Card, publicCard: Card, options: RuleOptions): NormalCard[][] {
  const normalDeck = allNormalCards();
  const fixedCards = [privateCard, publicCard].filter(
    (card): card is NormalCard => card.kind === "normal"
  );
  const jokerCount = [privateCard, publicCard].length - fixedCards.length;

  if (jokerCount > 0 && !options.jokersWild) {
    return fixedCards.length > 0
      ? normalDeck.map((fantasyCard) => [...fixedCards, fantasyCard])
      : normalDeck.flatMap((first) => normalDeck.map((second) => [first, second]));
  }

  const wildcardSlots = jokerCount + 1;
  return fillWildcardSlots(fixedCards, wildcardSlots, normalDeck);
}

function fillWildcardSlots(
  fixedCards: NormalCard[],
  slots: number,
  choices: NormalCard[]
): NormalCard[][] {
  if (slots === 0) {
    return [fixedCards];
  }

  const result: NormalCard[][] = [];
  const append = (prefix: NormalCard[], remaining: number) => {
    if (remaining === 0) {
      result.push([...fixedCards, ...prefix]);
      return;
    }
    for (const choice of choices) {
      append([...prefix, choice], remaining - 1);
    }
  };
  append([], slots);
  return result;
}

function evaluateNormalCards(cards: NormalCard[], options: RuleOptions): DreamHand | null {
  if (cards.length !== 3) {
    return null;
  }

  const sorted = [...cards].sort((a, b) => rankValue[b.rank] - rankValue[a.rank]);
  const values = sorted.map((card) => rankValue[card.rank]);
  const uniqueRanks = new Set(sorted.map((card) => card.rank));
  const uniqueSuits = new Set(sorted.map((card) => card.suit));
  const isFlush = uniqueSuits.size === 1;
  const isTriple = uniqueRanks.size === 1;
  const isStraight = values[0] - values[1] === 1 && values[1] - values[2] === 1;
  const isSpecial235 =
    options.special235BeatsTriple && values.slice().sort((a, b) => a - b).join(",") === "2,3,5";

  let type: HandType = "single";
  if (isSpecial235) {
    type = "special235";
  } else if (isTriple) {
    type = "triple";
  } else if (isStraight && isFlush) {
    type = "straightFlush";
  } else if (isStraight) {
    type = "straight";
  } else if (isFlush) {
    type = "flush";
  }

  const score = type === "triple" ? [values[0]] : values;
  const labels = sorted.map(formatNormalCard).join("、");

  return {
    type,
    typeLabel: handTypeLabel[type],
    cards: sorted,
    score,
    description: `${handTypeLabel[type]}：${labels}`
  };
}

function allNormalCards(): NormalCard[] {
  const cards: NormalCard[] = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      cards.push({ kind: "normal", suit, rank });
    }
  }
  return cards;
}

function formatNormalCard(card: { suit: Suit; rank: Rank }): string {
  const suitLabel: Record<Suit, string> = {
    S: "黑桃",
    H: "红心",
    D: "方块",
    C: "梅花"
  };
  return `${suitLabel[card.suit]}${card.rank}`;
}
