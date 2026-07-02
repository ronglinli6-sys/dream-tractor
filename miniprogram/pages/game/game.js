const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const suits = [
  { id: "S", name: "黑桃", colorClass: "black" },
  { id: "H", name: "红心", colorClass: "red" },
  { id: "D", name: "方块", colorClass: "red" },
  { id: "C", name: "梅花", colorClass: "black" }
];
const rankValue = {
  A: 1,
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
  K: 13
};
const bidOptions = [1, 2, 3, 5, 8, 10];
const defaultIdleBid = 3;

Page({
  data: {
    phase: "dealerAction",
    phaseText: "待操作",
    statusText: "当前可点击闲家头像进行开牌",
    isDealerView: true,
    idlePhase: "",
    operationMode: "single",
    myCardVisible: false,
    myBid: 0,
    bidOptions,
    deck: [],
    dealerSeat: 0,
    remainingCards: 0,
    openedCount: 0,
    idleCount: 0,
    publicCard: {},
    myCard: {},
    myHand: "",
    players: [],
    openedLogs: [],
    roundResolved: false
  },

  onLoad(query) {
    const role = query.role === "idle" ? "idle" : "dealer";
    this.newRound(role, { resetDeck: true, dealerSeat: 0 });
  },

  newRound(role = this.data.isDealerView ? "dealer" : "idle", options = {}) {
    const isDealerView = role !== "idle";
    const names = isDealerView
      ? ["你", "阿晨", "小林", "老周", "小夏", "阿杰"]
      : ["房主", "你", "小林", "老周", "小夏", "阿杰"];
    let dealerSeat = typeof options.dealerSeat === "number" ? options.dealerSeat : this.data.dealerSeat;
    let deck = options.resetDeck || !this.data.deck.length ? shuffle(createDeck()) : [...this.data.deck];
    let previousPlayers = options.resetDeck ? [] : this.data.players;
    const publicCardNeeded = options.keepPublicCard && this.data.publicCard?.rank ? 0 : 1;
    const needsNewCard = (index) => {
      const old = previousPlayers.find((player) => player.id === `p${index + 1}`);
      return index === dealerSeat || !old || old.opened || !old.card;
    };
    let cardsNeeded = publicCardNeeded;
    names.forEach((_, index) => {
      if (needsNewCard(index)) {
        cardsNeeded += 1;
      }
    });

    if (deck.length < cardsNeeded) {
      const oldDealer = names[dealerSeat];
      dealerSeat = (dealerSeat + 1) % names.length;
      const newDealer = names[dealerSeat];
      wx.showModal({
        title: "牌不够，换庄洗牌",
        content: `剩余牌只有 ${deck.length} 张，不够继续发牌。\n${oldDealer} 下庄，指定 ${newDealer} 当庄。`,
        showCancel: false
      });
      deck = shuffle(createDeck());
      previousPlayers = [];
    }

    const publicCard = publicCardNeeded ? deck.pop() : this.data.publicCard;
    const players = names.map((name, index) => {
      const old = previousPlayers.find((player) => player.id === `p${index + 1}`);
      const shouldDeal = index === dealerSeat || !old || old.opened || !old.card;
      const card = shouldDeal ? deck.pop() : old.card;
      const looked = shouldDeal ? false : Boolean(old.looked);
      const blind = !looked;
      const hand = bestDreamHand(card, publicCard);
      const isMe = isDealerView ? index === dealerSeat : index === 1;
      const hidden = index === dealerSeat ? !looked : isMe ? !looked : true;
      return decoratePlayer({
        id: `p${index + 1}`,
        name,
        initial: name.slice(0, 1),
        isDealer: index === dealerSeat,
        isMe,
        bid: index === dealerSeat ? "-" : defaultIdleBid,
        blind,
        looked,
        card,
        hidden,
        opened: false,
        result: "",
        hand
      });
    });
    const me = players.find((player) => player.isMe) || players[0];
    const nextBidder = nextSeat(dealerSeat, players.length);

    this.setData({
      phase: isDealerView ? "dealerAction" : "idlePrepare",
      phaseText: isDealerView ? "待操作" : "看牌准备",
      statusText: isDealerView
        ? `当前庄家：${players[dealerSeat].name}，剩余牌 ${deck.length} 张`
        : `当前庄家：${players[dealerSeat].name}，不看牌准备即为蒙牌`,
      isDealerView,
      idlePhase: isDealerView ? "" : "prepare",
      operationMode: "single",
      myCardVisible: Boolean(me.looked),
      myBid: me.isDealer ? 0 : Number(me.bid || 0),
      deck,
      dealerSeat,
      remainingCards: deck.length,
      publicCard,
      myCard: me.card,
      myHand: me.hand.text,
      players,
      openedCount: 0,
      idleCount: players.length - 1,
      currentBidderSeat: nextBidder,
      openedLogs: [],
      roundResolved: false
    });
  },

  setMode(event) {
    this.setData({
      operationMode: event.currentTarget.dataset.mode,
      statusText: "单开模式：点击未开闲家头像"
    });
  },

  toggleMyCard() {
    const nextVisible = !this.data.myCardVisible;
    let players = this.data.players;
    let statusText = this.data.statusText;
    if (nextVisible) {
      players = players.map((player) =>
        player.isMe ? decoratePlayer({ ...player, hidden: false, looked: true, blind: false }) : player
      );
      statusText = this.data.isDealerView ? "庄家已看牌，本轮庄家不再算蒙牌" : "你已看牌，本轮不能再算蒙牌";
    }
    this.setData({ myCardVisible: nextVisible, players, statusText });
  },

  idleReady() {
    this.setData({
      idlePhase: "bid",
      phase: "idleBid",
      phaseText: "轮到你叫酒",
      statusText: "从庄家下家开始顺时针叫酒；演示版当前轮到你"
    });
  },

  chooseBid(event) {
    const value = Number(event.currentTarget.dataset.value);
    wx.showModal({
      title: "确认叫酒",
      content: `确定叫 ${value} 杯吗？`,
      success: (result) => {
        if (!result.confirm) {
          return;
        }
        const players = this.data.players.map((player) =>
          player.isMe ? decoratePlayer({ ...player, bid: value }) : player
        );
        const me = players.find((player) => player.isMe);
        this.setData({
          players,
          myBid: value,
          idlePhase: "waiting",
          phase: "idleWaiting",
          phaseText: "等待庄家",
          statusText: me.blind ? "你未看牌，当前为蒙牌叫酒" : "你已看牌叫酒，等待庄家抉择"
        });
      }
    });
  },

  simulateDealerOpenMe() {
    const dealer = this.currentDealer();
    const me = this.data.players.find((player) => player.isMe);
    if (!dealer || !me || me.isDealer) {
      return;
    }
    const result = settlePair(dealer, me);
    wx.showModal({
      title: result.dealerWins ? "你被开牌：你输了" : "你被开牌：你赢了",
      content: result.detail,
      showCancel: false
    });
    const players = this.data.players.map((player) =>
      player.isMe ? decoratePlayer({ ...player, hidden: false, opened: true, result: result.dealerWins ? "lose" : "win" }) : player
    );
    this.setData({
      players,
      statusText: "你已被庄家开牌，等待本轮结束",
      openedLogs: [...this.data.openedLogs, { id: `idle-open-me-${Date.now()}`, text: result.summary }],
      roundResolved: true
    });
  },

  simulateDealerOpenOther() {
    const target = this.data.players.find((player) => !player.isDealer && !player.isMe && !player.opened);
    if (!target) {
      return;
    }
    const dealer = this.currentDealer();
    const result = settlePair(dealer, target);
    const players = this.data.players.map((player) =>
      player.id === target.id ? decoratePlayer({ ...player, hidden: false, opened: true, result: result.dealerWins ? "lose" : "win" }) : player
    );
    this.setData({
      players,
      statusText: `庄家开了${target.name}，你继续等待`,
      openedLogs: [...this.data.openedLogs, { id: `idle-open-other-${Date.now()}`, text: result.summary }],
      roundResolved: true
    });
  },

  simulateOpenAll() {
    this.openAll();
  },

  tapPlayer(event) {
    if (this.data.phase !== "dealerAction" || this.data.operationMode !== "single") {
      return;
    }
    const target = this.data.players.find((player) => player.id === event.currentTarget.dataset.id);
    if (!target || target.isDealer || target.opened) {
      return;
    }
    this.openOne(target);
  },

  openOne(target) {
    const dealer = this.currentDealer();
    const result = settlePair(dealer, target);
    const players = this.data.players.map((player) => {
      if (player.id !== target.id) {
        return decoratePlayer(player);
      }
      return decoratePlayer({
        ...player,
        hidden: false,
        opened: true,
        result: result.dealerWins ? "lose" : "win"
      });
    });
    const openedCount = players.filter((player) => !player.isDealer && player.opened).length;
    const allOpened = openedCount >= players.length - 1;
    wx.showModal({
      title: result.dealerWins ? "庄家开牌获胜" : `${target.name}开牌获胜`,
      content: result.detail,
      showCancel: false
    });
    this.setData({
      players,
      openedCount,
      phaseText: allOpened ? "本轮已全部开完" : "待操作",
      statusText: allOpened ? "所有闲家已开完，可继续从剩余牌堆发牌" : "开牌完成，可继续点击其他闲家",
      openedLogs: [...this.data.openedLogs, { id: `${target.id}-${Date.now()}`, text: result.summary }],
      roundResolved: true
    });
  },

  openAll() {
    const dealer = this.currentDealer();
    const challengers = this.data.players.filter((player) => !player.isDealer);
    const results = challengers.map((player) => settlePair(dealer, player));
    const players = this.data.players.map((player) => {
      if (player.isDealer) {
        return decoratePlayer(player);
      }
      const result = results.find((item) => item.targetId === player.id);
      return decoratePlayer({
        ...player,
        hidden: false,
        opened: true,
        result: result.dealerWins ? "lose" : "win"
      });
    });
    const dealerDrink = results.reduce((sum, item) => sum + (item.dealerWins ? 0 : item.drinks), 0);
    const idleDrink = results.reduce((sum, item) => sum + (item.dealerWins ? item.drinks : 0), 0);
    wx.showModal({
      title: dealerDrink ? "通开结算" : "庄家通杀",
      content: `逐个结算完成。\n庄家共喝 ${dealerDrink} 杯；闲家合计喝 ${idleDrink} 杯。`,
      showCancel: false
    });
    this.setData({
      players,
      openedCount: challengers.length,
      phaseText: "本轮已结束",
      statusText: "通开全体闲家后本轮结束，可继续从剩余牌堆发牌",
      openedLogs: [...this.data.openedLogs, ...results.map((item) => ({ id: `${item.targetId}-${Date.now()}`, text: item.summary }))],
      roundResolved: true
    });
  },

  selfPenalty() {
    const nextState = this.buildDealerSelfPenaltyState();
    if (!nextState) {
      return;
    }
    wx.showModal({
      title: "庄家自罚",
      content: "庄家选择不开，自罚 1 杯。系统已给庄家重发一张暗牌，公共牌不变，闲家未开牌继续保留。",
      showCancel: false
    });
    this.setData({
      ...nextState,
      openedLogs: [...this.data.openedLogs, { id: `self-${Date.now()}`, text: "自罚：庄家不开，喝 1 杯；庄家换暗牌，公共牌不变" }]
    });
  },

  endSingleOpen() {
    const opened = this.data.players.filter((player) => !player.isDealer && player.opened);
    const unopened = this.data.players.filter((player) => !player.isDealer && !player.opened);
    if (!opened.length) {
      wx.showModal({
        title: "还不能结束",
        content: "本轮还没有开任何闲家。如果庄家不想开牌，请点“自罚”。",
        showCancel: false
      });
      return;
    }
    const text = `结束本轮：已开 ${opened.length} 位已结算；未开 ${unopened.length} 位保留原牌，直到庄家以后开他。`;
    wx.showModal({
      title: "结束本轮开牌",
      content: text,
      showCancel: false
    });
    this.setData({
      phaseText: "本轮已结束",
      statusText: "未开闲家保留原牌，可继续从剩余牌堆发牌",
      openedLogs: [...this.data.openedLogs, { id: `end-${Date.now()}`, text }],
      roundResolved: true
    });
  },

  nextRound() {
    if (!this.data.roundResolved) {
      wx.showModal({
        title: "先完成本轮",
        content: "庄家至少开一家闲家，或者选择自罚后，才能进入下一轮换牌。",
        showCancel: false
      });
      return;
    }
    this.newRound();
  },

  currentDealer() {
    return this.data.players.find((player) => player.isDealer) || this.data.players[0];
  },

  buildDealerSelfPenaltyState() {
    let deck = [...this.data.deck];
    let dealerSeat = this.data.dealerSeat;
    const currentNames = this.data.players.map((player) => player.name);
    let publicCard = this.data.publicCard;
    let previousPlayers = this.data.players;
    let clearedRetainedCards = false;
    const cardsNeeded = previousPlayers.reduce((count, player) => {
      if (player.isDealer || player.opened || !player.card) {
        return count + 1;
      }
      return count;
    }, 0);

    if (deck.length < cardsNeeded) {
      const oldDealer = currentNames[dealerSeat];
      dealerSeat = nextSeat(dealerSeat, currentNames.length);
      const newDealer = currentNames[dealerSeat];
      wx.showModal({
        title: "牌不够，换庄洗牌",
        content: `剩余牌只有 ${deck.length} 张，不够继续发牌。\n${oldDealer} 下庄，指定 ${newDealer} 当庄，并清空所有保留牌。`,
        showCancel: false
      });
      deck = shuffle(createDeck());
      publicCard = deck.pop();
      previousPlayers = [];
      clearedRetainedCards = true;
    }

    const players = currentNames.map((name, index) => {
      const old = previousPlayers.find((player) => player.id === `p${index + 1}`);
      const isDealer = index === dealerSeat;
      const needsNewCard = clearedRetainedCards || isDealer || !old?.card || old.opened;
      const card = needsNewCard ? deck.pop() : old.card;
      const isMe = this.data.isDealerView ? isDealer : index === 1;
      const playerLooked = needsNewCard ? false : Boolean(old?.looked);
      const hidden = isDealer ? true : isMe ? !playerLooked : true;
      return decoratePlayer({
        id: `p${index + 1}`,
        name,
        initial: name.slice(0, 1),
        isDealer,
        isMe,
        bid: isDealer ? "-" : defaultIdleBid,
        blind: isDealer ? true : !playerLooked,
        looked: isDealer ? false : playerLooked,
        card,
        hidden,
        opened: false,
        result: "",
        hand: bestDreamHand(card, publicCard)
      });
    });
    const me = players.find((player) => player.isMe) || players[0];
    return {
      phase: this.data.isDealerView ? "dealerAction" : "idlePrepare",
      phaseText: this.data.isDealerView ? "待操作" : "看牌准备",
      statusText: `庄家已自罚并换暗牌，公共牌不变，剩余牌 ${deck.length} 张`,
      operationMode: "single",
      myCardVisible: Boolean(me.looked),
      myBid: me.isDealer ? 0 : Number(me.bid || 0),
      deck,
      dealerSeat,
      remainingCards: deck.length,
      publicCard,
      myCard: me.card,
      myHand: me.hand.text,
      players,
      openedCount: 0,
      idleCount: players.length - 1,
      currentBidderSeat: nextSeat(dealerSeat, players.length),
      roundResolved: false
    };
  }
});

function decoratePlayer(player) {
  const stateText = player.looked ? "看牌" : "蒙牌";
  if (player.isDealer) {
    return { ...player, canOpen: false, statusText: `庄家${stateText}`, metaText: `庄家 · ${stateText}`, resultClass: "" };
  }
  if (player.opened) {
    return {
      ...player,
      canOpen: false,
      statusText: player.result === "win" ? "赢" : "输",
      metaText: `闲家 · ${stateText} · ${player.bid}杯`,
      resultClass: player.result === "win" ? "result-win" : "result-lose"
    };
  }
  return {
    ...player,
    canOpen: true,
    statusText: player.looked ? "已看牌" : "蒙牌",
    metaText: `闲家 · ${stateText} · ${player.bid}杯`,
    resultClass: player.looked ? "result-seen" : ""
  };
}

function settlePair(dealer, target) {
  const compare = compareDreamHands(dealer.hand, target.hand, dealer.isDealer);
  const dealerWins = compare >= 0;
  const baseBid = Number(target.bid || defaultIdleBid);
  const multiplier = !dealerWins && !dealer.blind && target.blind ? 2 : 1;
  const drinks = baseBid * multiplier;
  const special235Text = get235SpecialWinner(dealer.hand, target.hand)
    ? "（2和5补3，235吃豹子）"
    : "";
  const summary = dealerWins
    ? `开${target.name}：庄家赢${special235Text}，${target.name}喝 ${drinks} 杯`
    : `开${target.name}：${target.name}赢${special235Text}，庄家喝 ${drinks} 杯${multiplier === 2 ? "（闲家蒙牌翻倍）" : ""}`;
  return {
    targetId: target.id,
    dealerWins,
    drinks,
    summary,
    detail: `庄家：${dealer.hand.text}\n${target.name}：${target.hand.text}\n${summary}`
  };
}

function createDeck() {
  const deck = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({
        suit: suit.id,
        suitName: suit.name,
        rank,
        colorClass: suit.colorClass,
        image: `/assets/cards/${rank}_${suit.id}.png`,
        joker: false
      });
    }
  }
  deck.push(
    { joker: true, jokerType: "small", rank: "小王", colorClass: "black", image: "/assets/cards/JOKER_SMALL.png" },
    { joker: true, jokerType: "big", rank: "大王", colorClass: "red", image: "/assets/cards/JOKER_BIG.png" }
  );
  return deck;
}

function shuffle(items) {
  const result = items.slice();
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function cardText(card) {
  if (card.joker) {
    return card.rank;
  }
  return `${card.suitName}${card.rank}`;
}

function bestDreamHand(privateCard, publicCard) {
  const candidates = [];
  for (const first of expandWild(privateCard)) {
    for (const second of expandWild(publicCard)) {
      for (const fantasy of allNormalCards()) {
        candidates.push(evaluate([first, second, fantasy], privateCard, publicCard));
      }
    }
  }
  candidates.sort(compareBaseHands);
  return candidates[candidates.length - 1];
}

function expandWild(card) {
  return card.joker ? allNormalCards() : [card];
}

function allNormalCards() {
  const cards = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      cards.push({
        suit: suit.id,
        suitName: suit.name,
        rank,
        colorClass: suit.colorClass,
        image: `/assets/cards/${rank}_${suit.id}.png`,
        joker: false
      });
    }
  }
  return cards;
}

function evaluate(cards, privateCard = null, publicCard = null) {
  const sorted = cards.slice().sort((a, b) => rankValue[b.rank] - rankValue[a.rank]);
  const values = sorted.map((card) => rankValue[card.rank]);
  const rankSet = new Set(sorted.map((card) => card.rank));
  const suitSet = new Set(sorted.map((card) => card.suit));
  const isTriple = rankSet.size === 1;
  const isFlush = suitSet.size === 1;
  const straightValues = getStraightValues(values);
  const isStraight = Boolean(straightValues);
  const canUse235AgainstTriple = canMake235AgainstTriple(privateCard, publicCard);

  let type = 1;
  let name = "单张";
  if (isTriple) {
    type = 5;
    name = "豹子";
  } else if (isStraight && isFlush) {
    type = 4;
    name = "同花顺";
  } else if (isStraight) {
    type = 3;
    name = "顺子";
  } else if (isFlush) {
    type = 2;
    name = "同花";
  }

  return {
    type,
    name,
    canUse235AgainstTriple,
    values: straightValues || values,
    text: `${name}：${sorted.map(cardText).join("、")}`
  };
}

function canMake235AgainstTriple(privateCard, publicCard) {
  if (!privateCard || !publicCard || privateCard.joker || publicCard.joker) {
    return false;
  }
  const realRanks = [privateCard.rank, publicCard.rank].sort().join(",");
  return realRanks === "2,5";
}

function getStraightValues(values) {
  const ascending = values.slice().sort((a, b) => a - b);
  const key = ascending.join(",");
  if (key === "1,12,13") {
    return [14, 13, 12];
  }
  if (key === "1,2,3") {
    return [3, 2, 1];
  }
  if (ascending[1] - ascending[0] === 1 && ascending[2] - ascending[1] === 1) {
    return ascending.slice().reverse();
  }
  return null;
}

function compareBaseHands(a, b) {
  if (a.type !== b.type) {
    return a.type - b.type;
  }
  for (let index = 0; index < a.values.length; index += 1) {
    const diff = (a.values[index] || 0) - (b.values[index] || 0);
    if (diff) {
      return diff;
    }
  }
  return 0;
}

function compareDreamHands(dealerHand, targetHand) {
  const specialWinner = get235SpecialWinner(dealerHand, targetHand);
  if (specialWinner) {
    return specialWinner === "dealer" ? 1 : -1;
  }
  return compareBaseHands(dealerHand, targetHand);
}

function get235SpecialWinner(dealerHand, targetHand) {
  if (dealerHand.type === 5 && targetHand.canUse235AgainstTriple) {
    return "target";
  }
  if (dealerHand.canUse235AgainstTriple && targetHand.type === 5) {
    return "dealer";
  }
  return "";
}

function nextSeat(seat, count) {
  return (seat + 1) % count;
}
