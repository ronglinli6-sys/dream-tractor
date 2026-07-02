import { Card, cardId, createDeck, shuffle } from "./cards.js";
import { DreamHand, RuleOptions, bestDreamHand, compareDreamHands } from "./evaluator.js";

export type SeatDirection = "clockwise" | "counterClockwise";
export type GamePhase = "waiting" | "bidding" | "dealerAction" | "settled";

export type Player = {
  id: string;
  name: string;
  seat: number;
  connected: boolean;
};

export type Bid = {
  playerId: string;
  value: number;
  blind: boolean;
};

export type RoomRules = RuleOptions & {
  minPlayers: number;
  maxPlayers: number;
  dealerDirection: SeatDirection;
  passPenalty: number;
  blindMultiplier: number;
  fullSweepToRotate: number;
};

export type PlayerRound = {
  playerId: string;
  privateCard?: Card;
  dreamHand?: DreamHand;
  bid?: Bid;
};

export type Settlement = {
  mode: "openOne" | "openAll" | "pass";
  dealerId: string;
  targetPlayerId?: string;
  winnerIds: string[];
  loserIds: string[];
  scoreDelta: Record<string, number>;
  message: string;
};

export type GameState = {
  roomId: string;
  ownerId: string;
  phase: GamePhase;
  players: Player[];
  rules: RoomRules;
  dealerSeat: number;
  dealerSweepCount: number;
  publicCard?: Card;
  rounds: PlayerRound[];
  settlement?: Settlement;
};

export const defaultRules: RoomRules = {
  jokersWild: true,
  special235BeatsTriple: true,
  minPlayers: 2,
  maxPlayers: 10,
  dealerDirection: "clockwise",
  passPenalty: 1,
  blindMultiplier: 2,
  fullSweepToRotate: 3
};

export function createInitialState(
  roomId: string,
  owner: Omit<Player, "seat" | "connected">,
  rules: Partial<RoomRules> = {}
): GameState {
  return {
    roomId,
    ownerId: owner.id,
    phase: "waiting",
    players: [{ ...owner, seat: 0, connected: true }],
    rules: { ...defaultRules, ...rules },
    dealerSeat: 0,
    dealerSweepCount: 0,
    rounds: []
  };
}

export function addPlayer(state: GameState, player: Omit<Player, "seat" | "connected">): GameState {
  if (state.players.some((item) => item.id === player.id)) {
    return state;
  }
  if (state.players.length >= state.rules.maxPlayers) {
    throw new Error("房间人数已满");
  }
  return {
    ...state,
    players: [...state.players, { ...player, seat: state.players.length, connected: true }]
  };
}

export function startRound(state: GameState): GameState {
  if (state.players.length < state.rules.minPlayers) {
    throw new Error("至少需要 2 人才能开局");
  }

  const deck = shuffle(createDeck(state.rules.jokersWild));
  const rounds: PlayerRound[] = state.players.map((player) => ({
    playerId: player.id,
    privateCard: deck.pop()
  }));
  const publicCard = deck.pop();
  if (!publicCard || rounds.some((round) => !round.privateCard)) {
    throw new Error("发牌失败");
  }

  return {
    ...state,
    phase: "bidding",
    publicCard,
    rounds: rounds.map((round) => ({
      ...round,
      dreamHand: bestDreamHand(round.privateCard!, publicCard, state.rules)
    })),
    settlement: undefined
  };
}

export function placeBid(state: GameState, playerId: string, value: number, blind = false): GameState {
  assertPhase(state, "bidding");
  if (value < 0) {
    throw new Error("叫分不能为负数");
  }
  const dealer = getDealer(state);
  if (dealer.id === playerId) {
    throw new Error("庄家不需要叫分");
  }

  const rounds = state.rounds.map((round) =>
    round.playerId === playerId ? { ...round, bid: { playerId, value, blind } } : round
  );
  const idlePlayers = state.players.filter((player) => player.id !== dealer.id);
  const allBid = idlePlayers.every((player) =>
    rounds.some((round) => round.playerId === player.id && round.bid)
  );

  return {
    ...state,
    phase: allBid ? "dealerAction" : state.phase,
    rounds
  };
}

export function dealerPass(state: GameState): GameState {
  assertPhase(state, "dealerAction");
  const dealer = getDealer(state);
  const scoreDelta = { [dealer.id]: -state.rules.passPenalty };
  return settleAndMaybeRotate(state, {
    mode: "pass",
    dealerId: dealer.id,
    winnerIds: [],
    loserIds: [dealer.id],
    scoreDelta,
    message: `庄家不开，扣 ${state.rules.passPenalty} 分`
  });
}

export function dealerOpenOne(state: GameState, targetPlayerId: string): GameState {
  assertPhase(state, "dealerAction");
  const dealer = getDealer(state);
  const dealerRound = requireRound(state, dealer.id);
  const targetRound = requireRound(state, targetPlayerId);
  const targetBid = targetRound.bid;
  if (!targetBid) {
    throw new Error("目标玩家还没有叫分");
  }

  const compare = compareDreamHands(dealerRound.dreamHand!, targetRound.dreamHand!);
  const dealerWins = compare >= 0;
  const value = bidValue(targetBid, state.rules);
  const scoreDelta = dealerWins
    ? { [dealer.id]: value, [targetPlayerId]: -value }
    : { [dealer.id]: -value, [targetPlayerId]: value };

  return settleAndMaybeRotate(state, {
    mode: "openOne",
    dealerId: dealer.id,
    targetPlayerId,
    winnerIds: dealerWins ? [dealer.id] : [targetPlayerId],
    loserIds: dealerWins ? [targetPlayerId] : [dealer.id],
    scoreDelta,
    message: dealerWins ? "庄家开牌获胜" : "闲家开牌获胜"
  });
}

export function dealerOpenAll(state: GameState): GameState {
  assertPhase(state, "dealerAction");
  const dealer = getDealer(state);
  const dealerRound = requireRound(state, dealer.id);
  const challengers = state.rounds.filter((round) => round.playerId !== dealer.id && round.bid);
  if (challengers.length === 0) {
    throw new Error("没有可通开的闲家");
  }

  const winners = challengers.filter(
    (round) => compareDreamHands(dealerRound.dreamHand!, round.dreamHand!) < 0
  );
  const scoreDelta: Record<string, number> = {};

  if (winners.length === 0) {
    const total = challengers.reduce((sum, round) => sum + bidValue(round.bid!, state.rules), 0);
    scoreDelta[dealer.id] = total;
    for (const round of challengers) {
      scoreDelta[round.playerId] = -bidValue(round.bid!, state.rules);
    }

    return settleAndMaybeRotate(state, {
      mode: "openAll",
      dealerId: dealer.id,
      winnerIds: [dealer.id],
      loserIds: challengers.map((round) => round.playerId),
      scoreDelta,
      message: "庄家通杀"
    });
  }

  const total = challengers.reduce((sum, round) => sum + bidValue(round.bid!, state.rules), 0);
  scoreDelta[dealer.id] = -total;
  for (const round of challengers) {
    scoreDelta[round.playerId] = bidValue(round.bid!, state.rules);
  }

  return settleAndMaybeRotate(state, {
    mode: "openAll",
    dealerId: dealer.id,
    winnerIds: winners.map((round) => round.playerId),
    loserIds: [dealer.id],
    scoreDelta,
    message: "庄家通开失败"
  });
}

export function publicStateForPlayer(state: GameState, viewerId: string): GameState {
  return {
    ...state,
    rounds: state.rounds.map((round) => ({
      ...round,
      privateCard: round.playerId === viewerId || state.phase === "settled" ? round.privateCard : undefined,
      dreamHand: round.playerId === viewerId || state.phase === "settled" ? round.dreamHand : undefined
    }))
  };
}

export function serializeCard(card?: Card): string | undefined {
  return card ? cardId(card) : undefined;
}

function settleAndMaybeRotate(state: GameState, settlement: Settlement): GameState {
  const didSweep = settlement.mode === "openAll" && settlement.winnerIds.length === 1 && settlement.winnerIds[0] === settlement.dealerId;
  const dealerSweepCount = didSweep ? state.dealerSweepCount + 1 : 0;
  const shouldRotate = !didSweep || dealerSweepCount >= state.rules.fullSweepToRotate;

  return {
    ...state,
    phase: "settled",
    dealerSweepCount: shouldRotate ? 0 : dealerSweepCount,
    dealerSeat: shouldRotate ? nextDealerSeat(state) : state.dealerSeat,
    settlement
  };
}

function nextDealerSeat(state: GameState): number {
  const offset = state.rules.dealerDirection === "clockwise" ? 1 : -1;
  return (state.dealerSeat + offset + state.players.length) % state.players.length;
}

function bidValue(bid: Bid, rules: RoomRules): number {
  return bid.value * (bid.blind ? rules.blindMultiplier : 1);
}

function getDealer(state: GameState): Player {
  return state.players.find((player) => player.seat === state.dealerSeat) ?? state.players[0];
}

function requireRound(state: GameState, playerId: string): PlayerRound {
  const round = state.rounds.find((item) => item.playerId === playerId);
  if (!round?.dreamHand) {
    throw new Error("找不到玩家本局牌型");
  }
  return round;
}

function assertPhase(state: GameState, phase: GamePhase): void {
  if (state.phase !== phase) {
    throw new Error(`当前阶段不能执行该操作：${state.phase}`);
  }
}
