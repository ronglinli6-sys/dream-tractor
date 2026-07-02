import { WebSocketServer, WebSocket } from "ws";
import { nanoid } from "nanoid";

type ClientContext = {
  playerId: string;
  roomId: string;
};

type LobbyPlayer = {
  id: string;
  name: string;
  seat: number;
  connected: boolean;
  ready: boolean;
};

type LobbyRoom = {
  roomId: string;
  ownerId: string;
  targetCount: number;
  players: LobbyPlayer[];
  countdown: number;
  started: boolean;
  countdownTimer?: NodeJS.Timeout;
};

type ClientMessage =
  | { type: "create_room"; roomId: string; playerName: string; targetCount: number }
  | { type: "join_room"; roomId: string; playerName: string }
  | { type: "set_ready"; ready: boolean };

const rooms = new Map<string, LobbyRoom>();
const clients = new Map<WebSocket, ClientContext>();

const port = Number(process.env.PORT ?? 8787);
const wss = new WebSocketServer({ port });

wss.on("connection", (socket) => {
  socket.on("message", (raw) => {
    try {
      const message = JSON.parse(raw.toString()) as ClientMessage;
      handleMessage(socket, message);
    } catch (error) {
      send(socket, { type: "error", message: error instanceof Error ? error.message : "消息解析失败" });
    }
  });

  socket.on("close", () => {
    const context = clients.get(socket);
    clients.delete(socket);
    if (!context) {
      return;
    }
    const room = rooms.get(context.roomId);
    if (!room) {
      return;
    }
    room.players = room.players.map((player) =>
      player.id === context.playerId ? { ...player, connected: false, ready: false } : player
    );
    stopCountdown(room);
    broadcastRoom(room.roomId);
  });
});

console.log(`梦幻拖拉机 WebSocket 服务已启动：ws://localhost:${port}`);

function handleMessage(socket: WebSocket, message: ClientMessage): void {
  if (message.type === "create_room") {
    const roomId = normalizeRoomId(message.roomId);
    const targetCount = normalizeTargetCount(message.targetCount);
    const playerName = normalizeName(message.playerName, "房主");
    if (rooms.has(roomId)) {
      throw new Error("房间配对码已被占用");
    }
    const playerId = nanoid(10);
    const room: LobbyRoom = {
      roomId,
      ownerId: playerId,
      targetCount,
      players: [
        {
          id: playerId,
          name: playerName,
          seat: 0,
          connected: true,
          ready: false
        }
      ],
      countdown: 0,
      started: false
    };
    rooms.set(roomId, room);
    clients.set(socket, { playerId, roomId });
    send(socket, { type: "room_created", roomId, playerId });
    broadcastRoom(roomId);
    return;
  }

  if (message.type === "join_room") {
    const roomId = normalizeRoomId(message.roomId);
    const room = requireRoom(roomId);
    if (room.started) {
      throw new Error("房间已开始游戏");
    }
    if (room.players.filter((player) => player.connected).length >= room.targetCount) {
      throw new Error("房间人数已满");
    }
    const playerId = nanoid(10);
    const playerName = normalizeName(message.playerName, "玩家");
    room.players.push({
      id: playerId,
      name: playerName,
      seat: room.players.length,
      connected: true,
      ready: false
    });
    clients.set(socket, { playerId, roomId });
    send(socket, { type: "room_joined", roomId, playerId });
    stopCountdown(room);
    broadcastRoom(roomId);
    return;
  }

  const context = requireContext(socket);
  const room = requireRoom(context.roomId);
  if (message.type === "set_ready") {
    room.players = room.players.map((player) =>
      player.id === context.playerId ? { ...player, ready: Boolean(message.ready) } : player
    );
    updateCountdown(room);
    broadcastRoom(room.roomId);
    return;
  }

  throw new Error("未知操作");
}

function updateCountdown(room: LobbyRoom): void {
  if (room.started) {
    return;
  }
  const connectedPlayers = room.players.filter((player) => player.connected);
  const isFull = connectedPlayers.length === room.targetCount;
  const allReady = isFull && connectedPlayers.every((player) => player.ready);
  if (!allReady) {
    stopCountdown(room);
    return;
  }
  if (room.countdownTimer) {
    return;
  }
  room.countdown = 5;
  room.countdownTimer = setInterval(() => {
    room.countdown -= 1;
    if (room.countdown <= 0) {
      stopCountdown(room);
      room.started = true;
      broadcastRoom(room.roomId);
      broadcastStartGame(room);
      return;
    }
    broadcastRoom(room.roomId);
  }, 1000);
}

function stopCountdown(room: LobbyRoom): void {
  if (room.countdownTimer) {
    clearInterval(room.countdownTimer);
    room.countdownTimer = undefined;
  }
  room.countdown = 0;
}

function broadcastRoom(roomId: string): void {
  const room = requireRoom(roomId);
  for (const [socket, context] of clients) {
    if (context.roomId === roomId && socket.readyState === WebSocket.OPEN) {
      send(socket, {
        type: "room_state",
        playerId: context.playerId,
        room: publicRoom(room, context.playerId)
      });
    }
  }
}

function broadcastStartGame(room: LobbyRoom): void {
  for (const [socket, context] of clients) {
    if (context.roomId === room.roomId && socket.readyState === WebSocket.OPEN) {
      const role = context.playerId === room.ownerId ? "dealer" : "idle";
      send(socket, {
        type: "start_game",
        role,
        players: room.players.map((player) => ({
          id: player.id,
          name: player.name,
          isDealer: player.id === room.ownerId,
          isMe: player.id === context.playerId,
          ready: player.ready
        }))
      });
    }
  }
}

function publicRoom(room: LobbyRoom, viewerId: string) {
  const connectedPlayers = room.players.filter((player) => player.connected);
  const readyCount = connectedPlayers.filter((player) => player.ready).length;
  return {
    roomId: room.roomId,
    ownerId: room.ownerId,
    targetCount: room.targetCount,
    readyCount,
    countdown: room.countdown,
    started: room.started,
    players: connectedPlayers.map((player) => ({
      id: player.id,
      name: player.name,
      seat: player.seat,
      connected: player.connected,
      ready: player.ready,
      isDealer: player.id === room.ownerId,
      isMe: player.id === viewerId
    }))
  };
}

function send(socket: WebSocket, payload: unknown): void {
  socket.send(JSON.stringify(payload));
}

function requireContext(socket: WebSocket): ClientContext {
  const context = clients.get(socket);
  if (!context) {
    throw new Error("请先创建或加入房间");
  }
  return context;
}

function requireRoom(roomId: string): LobbyRoom {
  const room = rooms.get(roomId);
  if (!room) {
    throw new Error("房间不存在");
  }
  return room;
}

function normalizeRoomId(value: string): string {
  const roomId = String(value || "").replace(/\D/g, "").slice(0, 4);
  if (roomId.length !== 4) {
    throw new Error("房间配对码必须是4位数字");
  }
  return roomId;
}

function normalizeTargetCount(value: number): number {
  const targetCount = Number(value);
  if (!Number.isInteger(targetCount) || targetCount < 2 || targetCount > 10) {
    throw new Error("房间人数必须是2-10人");
  }
  return targetCount;
}

function normalizeName(value: string, fallback: string): string {
  const name = String(value || "").trim().slice(0, 12);
  if (!name) {
    throw new Error("请输入昵称");
  }
  return name || fallback;
}
