import { WebSocketServer, WebSocket } from "ws";
import { nanoid } from "nanoid";
import {
  GameState,
  addPlayer,
  createInitialState,
  dealerOpenAll,
  dealerOpenOne,
  dealerPass,
  placeBid,
  publicStateForPlayer,
  startRound
} from "../shared/game.js";

type ClientContext = {
  playerId: string;
  roomId: string;
};

type ClientMessage =
  | { type: "create_room"; playerName: string }
  | { type: "join_room"; roomId: string; playerName: string }
  | { type: "start_round" }
  | { type: "bid"; value: number; blind?: boolean }
  | { type: "dealer_pass" }
  | { type: "dealer_open_one"; targetPlayerId: string }
  | { type: "dealer_open_all" };

const rooms = new Map<string, GameState>();
const clients = new Map<WebSocket, ClientContext>();

const wss = new WebSocketServer({ port: Number(process.env.PORT ?? 8787) });

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
    const state = rooms.get(context.roomId);
    if (!state) {
      return;
    }
    rooms.set(context.roomId, {
      ...state,
      players: state.players.map((player) =>
        player.id === context.playerId ? { ...player, connected: false } : player
      )
    });
    broadcastRoom(context.roomId);
  });
});

console.log("梦幻拖拉机 WebSocket 服务已启动：ws://localhost:8787");

function handleMessage(socket: WebSocket, message: ClientMessage): void {
  if (message.type === "create_room") {
    const playerId = nanoid(10);
    const roomId = nanoid(6).toUpperCase();
    const state = createInitialState(roomId, { id: playerId, name: message.playerName || "房主" });
    rooms.set(roomId, state);
    clients.set(socket, { playerId, roomId });
    send(socket, { type: "room_created", roomId, playerId });
    broadcastRoom(roomId);
    return;
  }

  if (message.type === "join_room") {
    const state = requireRoom(message.roomId);
    const playerId = nanoid(10);
    const nextState = addPlayer(state, { id: playerId, name: message.playerName || "玩家" });
    rooms.set(message.roomId, nextState);
    clients.set(socket, { playerId, roomId: message.roomId });
    send(socket, { type: "room_joined", roomId: message.roomId, playerId });
    broadcastRoom(message.roomId);
    return;
  }

  const context = requireContext(socket);
  const state = requireRoom(context.roomId);
  let nextState: GameState;

  switch (message.type) {
    case "start_round":
      assertOwner(state, context.playerId);
      nextState = startRound(state);
      break;
    case "bid":
      nextState = placeBid(state, context.playerId, message.value, Boolean(message.blind));
      break;
    case "dealer_pass":
      nextState = dealerPass(state);
      break;
    case "dealer_open_one":
      nextState = dealerOpenOne(state, message.targetPlayerId);
      break;
    case "dealer_open_all":
      nextState = dealerOpenAll(state);
      break;
    default:
      throw new Error("未知操作");
  }

  rooms.set(context.roomId, nextState);
  broadcastRoom(context.roomId);
}

function broadcastRoom(roomId: string): void {
  const state = requireRoom(roomId);
  for (const [socket, context] of clients) {
    if (context.roomId === roomId && socket.readyState === WebSocket.OPEN) {
      send(socket, { type: "game_state", state: publicStateForPlayer(state, context.playerId) });
    }
  }
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

function requireRoom(roomId: string): GameState {
  const state = rooms.get(roomId);
  if (!state) {
    throw new Error("房间不存在");
  }
  return state;
}

function assertOwner(state: GameState, playerId: string): void {
  if (state.ownerId !== playerId) {
    throw new Error("只有房主可以开始游戏");
  }
}
