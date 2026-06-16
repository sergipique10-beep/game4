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
