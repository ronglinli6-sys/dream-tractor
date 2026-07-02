const app = getApp();

Page({
  data: {
    roomId: "",
    isOwner: false,
    players: []
  },

  onLoad(query) {
    const name = app.globalData.playerName || "玩家";
    const demoPlayers = [
      { id: "p1", name, isDealer: true },
      { id: "p2", name: "阿晨", isDealer: false },
      { id: "p3", name: "小林", isDealer: false },
      { id: "p4", name: "老周", isDealer: false },
      { id: "p5", name: "小夏", isDealer: false },
      { id: "p6", name: "阿杰", isDealer: false }
    ];

    this.setData({
      roomId: app.globalData.roomId || "DEMO88",
      isOwner: query.owner === "1",
      players: demoPlayers
    });
  },

  startDealerDemo() {
    wx.navigateTo({ url: "/pages/game/game?role=dealer" });
  },

  startIdleDemo() {
    wx.navigateTo({ url: "/pages/game/game?role=idle" });
  }
});
