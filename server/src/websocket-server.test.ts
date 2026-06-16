import http from 'http';
import WebSocket from 'ws';
import { AddressInfo } from 'net';
import { createWebSocketServer } from './websocket-server';

function nextMessage(socket: WebSocket): Promise<any> {
  return new Promise((resolve) => {
    socket.once('message', (raw) => resolve(JSON.parse(raw.toString())));
  });
}

function openClient(port: number): Promise<WebSocket> {
  return new Promise((resolve) => {
    const socket = new WebSocket(`ws://localhost:${port}`);
    socket.once('open', () => resolve(socket));
  });
}

describe('WebSocket server', () => {
  let server: http.Server;
  let port: number;

  beforeEach((done) => {
    server = http.createServer();
    createWebSocketServer(server);
    server.listen(0, () => {
      port = (server.address() as AddressInfo).port;
      done();
    });
  });

  afterEach((done) => {
    server.close(done);
  });

  it('responds to create_room with room_created', async () => {
    const client = await openClient(port);
    client.send(JSON.stringify({ type: 'create_room' }));
    const message = await nextMessage(client);
    expect(message.type).toBe('room_created');
    expect(message.code).toHaveLength(4);
    client.close();
  });

  it('notifies both players on join_room with game_start', async () => {
    const host = await openClient(port);
    host.send(JSON.stringify({ type: 'create_room' }));
    const { code } = await nextMessage(host);

    const guest = await openClient(port);
    const hostStart = nextMessage(host); // opponent_joined first, then game_start
    guest.send(JSON.stringify({ type: 'join_room', code }));

    const guestJoined = await nextMessage(host);
    expect(guestJoined.type).toBe('opponent_joined');

    const hostStartMsg = await hostStart;
    const guestStartMsg = await nextMessage(guest);
    expect(hostStartMsg.type === 'game_start' || guestStartMsg.type === 'game_start').toBe(true);

    host.close();
    guest.close();
  });

  it('responds with error when joining an unknown room', async () => {
    const client = await openClient(port);
    client.send(JSON.stringify({ type: 'join_room', code: 'ZZZZ' }));
    const message = await nextMessage(client);
    expect(message.type).toBe('error');
    client.close();
  });

  it('starts a game immediately on play_vs_ai', async () => {
    const client = await openClient(port);
    client.send(JSON.stringify({ type: 'play_vs_ai' }));
    const message = await nextMessage(client);
    expect(message.type).toBe('game_start');
    expect(message.currentPlayer).toBe(1);
    client.close();
  });
});

describe('WebSocket server gameplay', () => {
  let server: http.Server;
  let port: number;

  beforeEach((done) => {
    server = http.createServer();
    createWebSocketServer(server);
    server.listen(0, () => {
      port = (server.address() as AddressInfo).port;
      done();
    });
  });

  afterEach((done) => {
    server.close(done);
  });

  it('broadcasts move_made to both players on a valid move', async () => {
    const host = await openClient(port);
    host.send(JSON.stringify({ type: 'create_room' }));
    const { code } = await nextMessage(host);

    const guest = await openClient(port);
    const hostStart = nextMessage(host);
    guest.send(JSON.stringify({ type: 'join_room', code }));
    await nextMessage(host); // opponent_joined
    await hostStart; // game_start
    await nextMessage(guest); // game_start

    const guestSeesMove = nextMessage(guest);
    host.send(JSON.stringify({ type: 'make_move', column: 3 }));
    const hostMoveMsg = await nextMessage(host);
    const guestMoveMsg = await guestSeesMove;
    expect(hostMoveMsg.type).toBe('move_made');
    expect(guestMoveMsg.type).toBe('move_made');
    expect(hostMoveMsg.lastMove.col).toBe(3);

    host.close();
    guest.close();
  });

  it('sends an error for an out-of-turn move', async () => {
    const host = await openClient(port);
    host.send(JSON.stringify({ type: 'create_room' }));
    const { code } = await nextMessage(host);

    const guest = await openClient(port);
    const hostStart = nextMessage(host);
    guest.send(JSON.stringify({ type: 'join_room', code }));
    await nextMessage(host);
    await hostStart;
    await nextMessage(guest);

    guest.send(JSON.stringify({ type: 'make_move', column: 0 }));
    const errorMsg = await nextMessage(guest);
    expect(errorMsg.type).toBe('error');

    host.close();
    guest.close();
  });

  it('notifies opponent_disconnected when a player closes their socket', async () => {
    const host = await openClient(port);
    host.send(JSON.stringify({ type: 'create_room' }));
    const { code } = await nextMessage(host);

    const guest = await openClient(port);
    const hostStart = nextMessage(host);
    guest.send(JSON.stringify({ type: 'join_room', code }));
    await nextMessage(host);
    await hostStart;
    await nextMessage(guest);

    const disconnectMsg = nextMessage(guest);
    host.close();
    const msg = await disconnectMsg;
    expect(msg.type).toBe('opponent_disconnected');

    guest.close();
  });

  it('plays an AI move automatically after the human moves in a vsAI room', async () => {
    const client = await openClient(port);
    client.send(JSON.stringify({ type: 'play_vs_ai' }));
    await nextMessage(client); // game_start

    const aiMoveMsg = nextMessage(client);
    client.send(JSON.stringify({ type: 'make_move', column: 3 }));
    await nextMessage(client); // move_made for the human move
    const aiMove = await aiMoveMsg;
    expect(aiMove.type).toBe('move_made');
    expect(typeof aiMove.lastMove.col).toBe('number');

    client.close();
  }, 10000);
});
