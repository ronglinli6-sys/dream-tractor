const app = getApp();

Page({
  data: {
    playerName: "玩家"
  },

  onNameInput(event) {
    this.setData({ playerName: event.detail.value });
  },

  createRoom() {
    app.globalData.playerName = this.data.playerName || "房主";
    app.globalData.roomId = `D${Math.floor(10000 + Math.random() * 89999)}`;
    wx.navigateTo({ url: "/pages/room/room?owner=1" });
  },

  joinRoom() {
    app.globalData.playerName = this.data.playerName || "玩家";
    app.globalData.roomId = "DEMO88";
    wx.navigateTo({ url: "/pages/room/room?owner=0" });
  }
});
