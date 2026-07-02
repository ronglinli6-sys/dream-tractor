const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const suits = [
  { id: "S", name: "黑桃", colorClass: "black" },
  { id: "H", name: "红心", colorClass: "red" },
  { id: "D", name: "方块", colorClass: "red" },
  { id: "C", name: "梅花", colorClass: "black" }
];
const rankValue = ranks.reduce((map, rank, index) => {
  map[rank] = index + 2;
  return map;
}, {});

Page({
  data: {
    phase: "dealerAction",
    phaseText: "待操作",
    statusText: "当前可点击闲家头像进行开牌",
    isDealerView: true,
    idlePhase: "",
    dealerName: "你",
    operationMode: "single",
    myCardVisible: false,
    myBid: 0,
    bidOptions: [1, 2, 3, 5, 8, 10],
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
    sweepCount: 0
  },

  onLoad(query) {
    const role = query.role === "idle" ? "idle" : "dealer";
    this.newRound(role, { resetDeck: true, dealerSeat: 0 });
  },

  newRound(role = this.data.isDealerView ? "dealer" : "idle", options = {}) {
    const isDealerView = role !== "idle";
    const playerNames = isDealerView
      ? ["你", "阿晨", "小林", "老周", "小夏", "阿杰"]
      : ["房主", "你", "小林", "老周", "小夏", "阿杰"];
    let dealerSeat = typeof options.dealerSeat === "number" ? options.dealerSeat : this.data.dealerSeat;
    let deck = options.resetDeck || !this.data.deck.length ? shuffle(createDeck()) : [...this.data.deck];
    const cardsNeeded = playerNames.length + 1;

    if (deck.length < cardsNeeded) {
      const oldDealer = playerNames[dealerSeat];
      dealerSeat = (dealerSeat + 1) % playerNames.length;
      const newDealer = playerNames[dealerSeat];
      wx.showModal({
        title: "牌不够，换庄洗牌",
        content: `剩余牌只有 ${deck.length} 张，不够给所有人和公共牌发牌。\n${oldDealer} 下庄，指定 ${newDealer} 当庄。`,
        showCancel: false
      });
      deck = shuffle(createDeck());
    }

    const publicCard = deck.pop();
    const players = playerNames.map((name, index) => {
      const privateCard = deck.pop();
      const hand = bestDreamHand(privateCard, publicCard);
      return decoratePlayer({
        id: `p${index + 1}`,
        name,
        initial: name.slice(0, 1),
        isDealer: index === dealerSeat,
        isMe: isDealerView ? index === dealerSeat : index === 1,
        bid: index === dealerSeat ? "-" : isDealerView ? 3 : 0,
        blind: index !== dealerSeat,
        looked: false,
        card: privateCard,
        hidden: index !== dealerSeat,
        opened: false,
        result: "",
        hand
      });
    });

    const me = players.find((player) => player.isMe) || players[0];

    this.setData({
      phase: isDealerView ? "dealerAction" : "idlePrepare",
      phaseText: isDealerView ? "待操作" : "看牌准备",
      statusText: isDealerView ? `当前庄家：${playerNames[dealerSeat]}，剩余牌 ${deck.length} 张` : `当前庄家：${playerNames[dealerSeat]}，点击底牌查看`,
      isDealerView,
      idlePhase: isDealerView ? "" : "prepare",
      operationMode: "single",
      myCardVisible: false,
      myBid: 0,
      deck,
      dealerSeat,
      remainingCards: deck.length,
      publicCard,
      myCard: me.card,
      myHand: me.hand,
      players,
      openedCount: 0,
      idleCount: players.length - 1,
      openedLogs: []
    });
  },

  setMode(event) {
    this.setData({
      operationMode: event.currentTarget.dataset.mode,
      statusText: "单开模式：点击未开闲家头像"
    });
  },

  toggleDealerCard() {
    this.toggleMyCard();
  },

  toggleMyCard() {
    const nextVisible = !this.data.myCardVisible;
    let players = this.data.players;
    let statusText = this.data.statusText;

    if (!this.data.isDealerView && nextVisible) {
      players = players.map((player) =>
        player.isMe ? decoratePlayer({ ...player, hidden: false, looked: true, blind: false }) : player
      );
      statusText = "你已看牌，庄家可看到你的状态为已看牌";
    }

    this.setData({ myCardVisible: nextVisible, players, statusText });
  },

  idleReady() {
    this.setData({
      idlePhase: "bid",
      phase: "idleBid",
      phaseText: "轮到你叫酒",
      statusText: "请选择本轮叫酒数，演示版不启用只升不降"
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
        this.setData({
          players,
          myBid: value,
          idlePhase: "waiting",
          phase: "idleWaiting",
          phaseText: "等待庄家",
          statusText: this.data.myCardVisible
            ? "你已看牌叫酒，等待庄家抉择"
            : "你未看牌，当前为蒙牌叫酒，等待庄家抉择"
        });
      }
    });
  },

  simulateDealerOpenMe() {
    const dealer = this.data.players.find((player) => player.isDealer);
    const me = this.data.players.find((player) => player.isMe);
    if (!dealer || !me) {
      return;
    }
    const dealerWins = compareHandText(dealer.hand, me.hand) >= 0;
    wx.showModal({
      title: dealerWins ? "你被开牌：你输了" : "你被开牌：你赢了",
      content: `庄家：${dealer.hand}\n你：${me.hand}\n${dealerWins ? `你喝 ${this.data.myBid || me.bid || 1} 杯` : `庄家喝 ${this.data.myBid || me.bid || 1} 杯`}`,
      showCancel: false
    });
    const players = this.data.players.map((player) =>
      player.isMe ? decoratePlayer({ ...player, hidden: false, opened: true, result: dealerWins ? "lose" : "win" }) : player
    );
    this.setData({
      players,
      statusText: "你已被庄家开牌，等待本轮结束",
      openedLogs: [
        ...this.data.openedLogs,
        { id: `idle-open-me-${Date.now()}`, text: dealerWins ? "庄家开你：你输了" : "庄家开你：你赢了" }
      ]
    });
  },

  simulateDealerOpenOther() {
    const target = this.data.players.find((player) => !player.isDealer && !player.isMe && !player.opened);
    if (!target) {
      return;
    }
    const players = this.data.players.map((player) =>
      player.id === target.id ? decoratePlayer({ ...player, hidden: false, opened: true, result: "lose" }) : player
    );
    this.setData({
      players,
      statusText: `庄家开了${target.name}，你继续等待`,
      openedLogs: [
        ...this.data.openedLogs,
        { id: `idle-open-other-${Date.now()}`, text: `庄家开${target.name}，${target.name}已开牌` }
      ]
    });
  },

  simulateOpenAll() {
    const dealer = this.data.players.find((player) => player.isDealer);
    if (!dealer) {
      return;
    }
    const challengers = this.data.players.filter((player) => !player.isDealer);
    const winners = challengers.filter((player) => compareHandText(dealer.hand, player.hand) < 0);
    const total = challengers.reduce((sum, player) => sum + Number(player.bid || 1), 0);
    wx.showModal({
      title: winners.length ? "庄家通开失败" : "庄家通杀",
      content: winners.length ? `有 ${winners.length} 位闲家大过庄家，庄家喝 ${total} 杯` : `庄家大过所有闲家，闲家合计喝 ${total} 杯`,
      showCancel: false
    });
    const players = this.data.players.map((player) =>
      player.isDealer
        ? player
        : decoratePlayer({ ...player, hidden: false, opened: true, result: compareHandText(dealer.hand, player.hand) < 0 ? "win" : "lose" })
    );
    this.setData({
      players,
      idlePhase: "ended",
      phaseText: "本轮结束",
      statusText: "通开结算完成，可等待下一轮",
      openedLogs: [
        ...this.data.openedLogs,
        { id: `idle-open-all-${Date.now()}`, text: winners.length ? "通开：庄家失败" : "通开：庄家通杀" }
      ]
    });
  },

  tapPlayer(event) {
    if (this.data.phase !== "dealerAction" || this.data.operationMode !== "single") {
      return;
    }
    const targetId = event.currentTarget.dataset.id;
    const target = this.data.players.find((player) => player.id === targetId);
    if (!target || target.isDealer || target.opened) {
      return;
    }
    this.openOne(target);
  },

  openOne(target) {
    this.setData({ phaseText: "正在对比中", statusText: `正在对比庄家和${target.name}...` });

    const dealer = this.data.players[0];
    const dealerWins = compareHandText(dealer.hand, target.hand) >= 0;
    const resultText = dealerWins
      ? `庄家赢，${target.name} 喝 ${target.bid} 杯`
      : `${target.name}赢，庄家喝 ${target.bid} 杯`;

    const players = this.data.players.map((player) => {
      if (player.id !== target.id) {
        return decoratePlayer(player);
      }
      return decoratePlayer({
        ...player,
        hidden: false,
        opened: true,
        result: dealerWins ? "lose" : "win"
      });
    });
    const openedCount = players.filter((player) => !player.isDealer && player.opened).length;
    const idleCount = players.filter((player) => !player.isDealer).length;
    const allOpened = openedCount >= idleCount;

    wx.showModal({
      title: dealerWins ? "庄家开牌获胜" : `${target.name}开牌获胜`,
      content: `庄家：${dealer.hand}\n${target.name}：${target.hand}\n${resultText}`,
      showCancel: false
    });

    this.setData({
      players,
      openedCount,
      idleCount,
      phaseText: allOpened ? "本轮已全部开完" : "待操作",
      statusText: allOpened ? "所有闲家已开完，可重新发牌" : "开牌完成，可继续点击其他闲家",
      openedLogs: [
        ...this.data.openedLogs,
        {
          id: `${target.id}-${Date.now()}`,
          text: `单开${target.name}：${resultText}`
        }
      ]
    });
  },

  openAll() {
    const dealer = this.data.players[0];
    const challengers = this.data.players.filter((player) => !player.isDealer && !player.opened);
    if (!challengers.length) {
      wx.showToast({ title: "已无可通开的闲家", icon: "none" });
      return;
    }

    const winners = challengers.filter((player) => compareHandText(dealer.hand, player.hand) < 0);
    const total = challengers.reduce((sum, player) => sum + Number(player.bid || 0), 0);
    const dealerSweep = winners.length === 0;
    const players = this.data.players.map((player) => {
      if (player.isDealer) {
        return decoratePlayer(player);
      }
      if (player.opened) {
        return decoratePlayer(player);
      }
      const challengerWins = compareHandText(dealer.hand, player.hand) < 0;
      return decoratePlayer({
        ...player,
        hidden: false,
        opened: true,
        result: challengerWins ? "win" : "lose"
      });
    });
    const openedCount = players.filter((player) => !player.isDealer && player.opened).length;
    const idleCount = players.filter((player) => !player.isDealer).length;
    const message = dealerSweep
      ? `庄家大于所有未开闲家，通杀成功。闲家合计喝 ${total} 杯`
      : `有 ${winners.length} 位闲家大于庄家，庄家喝 ${total} 杯`;

    wx.showModal({
      title: dealerSweep ? "通杀成功" : "通开失败",
      content: `庄家：${dealer.hand}\n${message}`,
      showCancel: false
    });

    this.setData({
      players,
      openedCount,
      idleCount,
      phaseText: "本轮已结束",
      statusText: "通开后本轮结束，可重新发牌",
      sweepCount: dealerSweep ? this.data.sweepCount + 1 : this.data.sweepCount,
      openedLogs: [
        ...this.data.openedLogs,
        {
          id: `open-all-${Date.now()}`,
          text: `通开：${message}`
        }
      ]
    });
  },

  selfPenalty() {
    wx.showModal({
      title: "庄家自罚",
      content: "庄家选择不开，自罚 1 杯，本轮结束。",
      showCancel: false
    });
    this.setData({
      phaseText: "本轮已结束",
      statusText: "庄家自罚 1 杯，可重新发牌",
      openedLogs: [
        ...this.data.openedLogs,
        {
          id: `self-${Date.now()}`,
          text: "自罚：庄家不开，喝 1 杯"
        }
      ]
    });
  },

  endSingleOpen() {
    const unopened = this.data.players.filter((player) => !player.isDealer && !player.opened).length;
    const text = unopened
      ? `结束单开：剩余 ${unopened} 位闲家未开，视为安全，本轮结束`
      : "结束单开：所有闲家已开完，本轮结束";
    wx.showModal({
      title: "结束本轮开牌",
      content: text,
      showCancel: false
    });
    this.setData({
      phaseText: "本轮已结束",
      statusText: "本轮已结束，可重新发牌",
      openedLogs: [
        ...this.data.openedLogs,
        {
          id: `end-${Date.now()}`,
          text
        }
      ]
    });
  },

  nextRound() {
    this.newRound();
  }
});

function decoratePlayer(player) {
  if (player.isDealer) {
    return { ...player, canOpen: false, statusText: "庄家", resultClass: "" };
  }
  if (player.opened) {
    return {
      ...player,
      canOpen: false,
      statusText: player.result === "win" ? "赢" : "输",
      resultClass: player.result === "win" ? "result-win" : "result-lose"
    };
  }
  return {
    ...player,
    canOpen: true,
    statusText: player.looked ? "已看牌" : "蒙牌",
    resultClass: player.looked ? "result-seen" : ""
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
    const item = result[index];
    result[index] = result[swapIndex];
    result[swapIndex] = item;
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
  const normals = createDeck().filter((card) => !card.joker);
  for (const fantasy of normals) {
    candidates.push(evaluate([normalize(privateCard), normalize(publicCard), fantasy]));
  }
  candidates.sort(compareHands);
  return candidates[candidates.length - 1].text;
}

function normalize(card) {
  if (!card.joker) {
    return card;
  }
  return {
    suit: "S",
    suitName: "黑桃",
    rank: "A",
    colorClass: "black",
    image: "/assets/cards/A_S.png",
    joker: false
  };
}

function evaluate(cards) {
  const sorted = cards.slice().sort((a, b) => rankValue[b.rank] - rankValue[a.rank]);
  const values = sorted.map((card) => rankValue[card.rank]);
  const sameRank = new Set(sorted.map((card) => card.rank)).size === 1;
  const sameSuit = new Set(sorted.map((card) => card.suit)).size === 1;
  const straight = values[0] - values[1] === 1 && values[1] - values[2] === 1;
  const special235 = values.slice().sort((a, b) => a - b).join(",") === "2,3,5";

  let type = 1;
  let name = "单张";
  if (special235) {
    type = 6;
    name = "235吃豹子";
  } else if (sameRank) {
    type = 5;
    name = "豹子";
  } else if (straight && sameSuit) {
    type = 4;
    name = "同花顺";
  } else if (straight) {
    type = 3;
    name = "拖拉机";
  } else if (sameSuit) {
    type = 2;
    name = "同花";
  }

  return {
    type,
    values,
    text: `${name}：${sorted.map(cardText).join("、")}`
  };
}

function compareHands(a, b) {
  if (a.type !== b.type) {
    return a.type - b.type;
  }
  for (let index = 0; index < a.values.length; index += 1) {
    if (a.values[index] !== b.values[index]) {
      return a.values[index] - b.values[index];
    }
  }
  return 0;
}

function compareHandText(a, b) {
  const power = ["单张", "同花", "拖拉机", "同花顺", "豹子", "235吃豹子"];
  const aPower = power.findIndex((name) => a.indexOf(name) === 0);
  const bPower = power.findIndex((name) => b.indexOf(name) === 0);
  return aPower - bPower;
}
