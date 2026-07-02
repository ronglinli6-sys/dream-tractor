const app = getApp();

Page({
  data: {
    playerName: "",
    createCode: "",
    joinCode: "",
    playerCount: 6,
    serverUrl: app.globalData.serverUrl || "ws://127.0.0.1:8787"
  },

  onNameInput(event) {
    this.setData({ playerName: event.detail.value });
  },

  onCreateCodeInput(event) {
    this.setData({ createCode: onlyDigits(event.detail.value).slice(0, 4) });
  },

  onJoinCodeInput(event) {
    this.setData({ joinCode: onlyDigits(event.detail.value).slice(0, 4) });
  },

  onPlayerCountInput(event) {
    this.setData({ playerCount: event.detail.value });
  },

  onServerUrlInput(event) {
    this.setData({ serverUrl: event.detail.value });
  },

  createRoom() {
    const playerName = normalizeName(this.data.playerName);
    const roomId = normalizeRoomCode(this.data.createCode);
    const playerCount = Number(this.data.playerCount);
    if (!playerName) {
      wx.showToast({ title: "请输入你的昵称", icon: "none" });
      return;
    }
    if (!roomId) {
      wx.showToast({ title: "请输入4位数字房间码", icon: "none" });
      return;
    }
    if (!Number.isInteger(playerCount) || playerCount < 2 || playerCount > 10) {
      wx.showToast({ title: "人数需为2-10人", icon: "none" });
      return;
    }
    app.globalData.playerName = playerName;
    app.globalData.roomId = roomId;
    app.globalData.playerCount = playerCount;
    app.globalData.serverUrl = normalizeServerUrl(this.data.serverUrl);
    app.globalData.roomPlayers = [];
    wx.navigateTo({ url: "/pages/room/room?owner=1" });
  },

  joinRoom() {
    const playerName = normalizeName(this.data.playerName);
    const roomId = normalizeRoomCode(this.data.joinCode);
    const playerCount = Number(this.data.playerCount);
    if (!playerName) {
      wx.showToast({ title: "请输入你的昵称", icon: "none" });
      return;
    }
    if (!roomId) {
      wx.showToast({ title: "请输入4位数字房间码", icon: "none" });
      return;
    }
    if (!Number.isInteger(playerCount) || playerCount < 2 || playerCount > 10) {
      wx.showToast({ title: "人数需为2-10人", icon: "none" });
      return;
    }
    app.globalData.playerName = playerName;
    app.globalData.roomId = roomId;
    app.globalData.playerCount = playerCount;
    app.globalData.serverUrl = normalizeServerUrl(this.data.serverUrl);
    wx.navigateTo({ url: "/pages/room/room?owner=0" });
  }
});

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeRoomCode(value) {
  const code = onlyDigits(value).slice(0, 4);
  return code.length === 4 ? code : "";
}

function normalizeName(value) {
  return String(value || "").trim().slice(0, 12);
}

function normalizeServerUrl(value) {
  const url = String(value || "").trim();
  return url || "ws://127.0.0.1:8787";
}
