export type Suit = "S" | "H" | "D" | "C";
export type Rank =
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K"
  | "A";

export type NormalCard = {
  kind: "normal";
  suit: Suit;
  rank: Rank;
};

export type JokerCard = {
  kind: "joker";
  joker: "small" | "big";
};

export type Card = NormalCard | JokerCard;

export const suits: Suit[] = ["S", "H", "D", "C"];
export const ranks: Rank[] = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
  "A"
];

export const rankValue: Record<Rank, number> = {
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14
};

export function createDeck(includeJokers = true): Card[] {
  const deck: Card[] = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ kind: "normal", suit, rank });
    }
  }
  if (includeJokers) {
    deck.push({ kind: "joker", joker: "small" }, { kind: "joker", joker: "big" });
  }
  return deck;
}

export function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function cardId(card: Card): string {
  if (card.kind === "joker") {
    return card.joker === "big" ? "JOKER_BIG" : "JOKER_SMALL";
  }
  return `${card.suit}_${card.rank}`;
}

export function cardLabel(card: Card): string {
  if (card.kind === "joker") {
    return card.joker === "big" ? "大王" : "小王";
  }
  const suitLabel: Record<Suit, string> = {
    S: "黑桃",
    H: "红心",
    D: "方块",
    C: "梅花"
  };
  return `${suitLabel[card.suit]}${card.rank}`;
}
