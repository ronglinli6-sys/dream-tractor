const app = getApp();

Page({
  data: {
    roomId: "",
    isOwner: false,
    targetCount: 6,
    players: [],
    readyCount: 0,
    isFull: false,
    allReady: false,
    myReady: false,
    countdown: 0,
    connected: false,
    statusText: "正在连接房间服务"
  },

  socketOpen: false,

  onLoad(query) {
    const isOwner = query.owner === "1";
    this.setData({
      roomId: app.globalData.roomId || "0000",
      isOwner,
      targetCount: clampCount(app.globalData.playerCount || 6)
    });
    this.connectRoomSocket();
  },

  onUnload() {
    this.socketOpen = false;
    wx.closeSocket({ code: 1000, reason: "leave room" });
  },

  connectRoomSocket() {
    wx.connectSocket({ url: app.globalData.serverUrl });

    wx.onSocketOpen(() => {
      this.socketOpen = true;
      this.setData({ connected: true, statusText: "已连接，正在进入房间" });
      this.sendRoomEnterMessage();
    });

    wx.onSocketMessage((event) => {
      this.handleSocketMessage(event.data);
    });

    wx.onSocketClose(() => {
      this.socketOpen = false;
      this.setData({ connected: false, statusText: "连接已断开，请返回重试" });
    });

    wx.onSocketError(() => {
      this.setData({ connected: false, statusText: "连接失败，请确认后端服务已启动" });
      wx.showToast({ title: "连接房间服务失败", icon: "none" });
    });
  },

  sendRoomEnterMessage() {
    const playerName = app.globalData.playerName || "";
    const roomId = app.globalData.roomId || "";
    if (this.data.isOwner) {
      this.sendSocketMessage({
        type: "create_room",
        roomId,
        playerName,
        targetCount: this.data.targetCount
      });
      return;
    }
    this.sendSocketMessage({
      type: "join_room",
      roomId,
      playerName
    });
  },

  handleSocketMessage(rawData) {
    let message;
    try {
      message = JSON.parse(rawData);
    } catch (error) {
      return;
    }

    if (message.type === "error") {
      wx.showToast({ title: message.message || "房间错误", icon: "none" });
      this.setData({ statusText: message.message || "房间错误" });
      return;
    }

    if (message.type === "room_state") {
      this.applyRoomState(message.room);
      return;
    }

    if (message.type === "start_game") {
      this.startGame(message.role, message.players || []);
    }
  },

  applyRoomState(room) {
    const players = (room.players || []).map((player) => ({
      ...player,
      initial: String(player.name || "?").slice(0, 1)
    }));
    const readyCount = Number(room.readyCount || 0);
    const targetCount = Number(room.targetCount || this.data.targetCount);
    const isFull = players.length === targetCount;
    const allReady = isFull && readyCount === targetCount;
    const myReady = Boolean(players.find((player) => player.isMe)?.ready);
    const countdown = Number(room.countdown || 0);
    let statusText = `等待玩家加入：${players.length}/${targetCount}`;

    if (isFull && !allReady) {
      statusText = `人数已满，等待准备：${readyCount}/${targetCount}`;
    }
    if (countdown > 0) {
      statusText = `全员已准备，${countdown}秒后开始游戏`;
    }

    this.setData({
      roomId: room.roomId,
      targetCount,
      players,
      readyCount,
      isFull,
      allReady,
      myReady,
      countdown,
      statusText
    });
  },

  toggleReady() {
    if (!this.socketOpen) {
      wx.showToast({ title: "房间服务未连接", icon: "none" });
      return;
    }
    this.sendSocketMessage({ type: "set_ready", ready: !this.data.myReady });
  },

  sendSocketMessage(message) {
    if (!this.socketOpen) {
      return;
    }
    wx.sendSocketMessage({ data: JSON.stringify(message) });
  },

  startGame(role, players) {
    app.globalData.playerCount = this.data.targetCount;
    app.globalData.roomPlayers = players.map((player) => ({
      ...player,
      initial: String(player.name || "?").slice(0, 1)
    }));
    wx.navigateTo({ url: `/pages/game/game?role=${role}` });
  }
});

function clampCount(value) {
  const count = Number(value);
  if (!Number.isInteger(count)) {
    return 6;
  }
  return Math.min(10, Math.max(2, count));
}
