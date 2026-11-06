/**
 * Minimal WebSocket (RFC 6455) server side, text messages only.
 * Kept dependency-free so the MCP bridge can be bundled as a single sidecar.
 */
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_PAYLOAD = 32 * 1024 * 1024;

/**
 * Completes the upgrade handshake on `socket`. Returns a connection, or null
 * (and destroys the socket) when the request is not a valid upgrade.
 */
export function acceptWebSocket(req, socket, { protocol } = {}) {
  const key = req.headers['sec-websocket-key'];
  if (!key || String(req.headers.upgrade).toLowerCase() !== 'websocket') {
    socket.destroy();
    return null;
  }
  const accept = crypto
    .createHash('sha1')
    .update(key + GUID)
    .digest('base64');
  const lines = [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${accept}`,
  ];
  if (protocol) lines.push(`Sec-WebSocket-Protocol: ${protocol}`);
  socket.write(lines.join('\r\n') + '\r\n\r\n');
  return new WsConnection(socket);
}

function encodeFrame(opcode, payload) {
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.from([0x80 | opcode, len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

class WsConnection extends EventEmitter {
  constructor(socket) {
    super();
    this.socket = socket;
    this.buffer = Buffer.alloc(0);
    this.fragments = [];
    this.fragmentSize = 0;
    this.fragmentOpcode = 0;
    this.closed = false;
    socket.on('data', chunk => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      while (!this.closed && this.parseFrame()) {
        // keep parsing complete frames
      }
    });
    socket.on('close', () => this.finish());
    socket.on('error', () => this.finish());
  }

  parseFrame() {
    const b = this.buffer;
    if (b.length < 2) return false;
    const fin = Boolean(b[0] & 0x80);
    const opcode = b[0] & 0x0f;
    const masked = Boolean(b[1] & 0x80);
    let length = b[1] & 0x7f;
    let offset = 2;
    if (length === 126) {
      if (b.length < 4) return false;
      length = b.readUInt16BE(2);
      offset = 4;
    } else if (length === 127) {
      if (b.length < 10) return false;
      const big = b.readBigUInt64BE(2);
      if (big > BigInt(MAX_PAYLOAD)) {
        this.close(1009);
        return false;
      }
      length = Number(big);
      offset = 10;
    }
    if (length > MAX_PAYLOAD) {
      this.close(1009);
      return false;
    }
    if (!masked) {
      // clients must mask every frame
      this.close(1002);
      return false;
    }
    if (b.length < offset + 4 + length) return false;
    const mask = b.subarray(offset, offset + 4);
    const payload = Buffer.from(b.subarray(offset + 4, offset + 4 + length));
    for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
    this.buffer = b.subarray(offset + 4 + length);
    this.handleFrame(fin, opcode, payload);
    return true;
  }

  handleFrame(fin, opcode, payload) {
    switch (opcode) {
      case 0x8:
        this.close(1000);
        return;
      case 0x9:
        this.write(0xa, payload);
        return;
      case 0xa:
        return;
      case 0x1:
      case 0x2:
        this.fragments = [payload];
        this.fragmentSize = payload.length;
        this.fragmentOpcode = opcode;
        break;
      case 0x0:
        if (!this.fragmentOpcode) {
          this.close(1002);
          return;
        }
        this.fragmentSize += payload.length;
        if (this.fragmentSize > MAX_PAYLOAD) {
          this.close(1009);
          return;
        }
        this.fragments.push(payload);
        break;
      default:
        this.close(1002);
        return;
    }
    if (!fin) return;
    const opcodeOfMessage = this.fragmentOpcode;
    const data = Buffer.concat(this.fragments);
    this.fragments = [];
    this.fragmentSize = 0;
    this.fragmentOpcode = 0;
    if (opcodeOfMessage === 0x2) {
      this.close(1003);
      return;
    }
    this.emit('message', data.toString('utf8'));
  }

  write(opcode, payload) {
    if (this.closed || this.socket.destroyed) return;
    this.socket.write(encodeFrame(opcode, payload));
  }

  send(text) {
    this.write(0x1, Buffer.from(text, 'utf8'));
  }

  ping() {
    this.write(0x9, Buffer.alloc(0));
  }

  close(code = 1000) {
    if (this.closed) return;
    const payload = Buffer.alloc(2);
    payload.writeUInt16BE(code, 0);
    this.write(0x8, payload);
    this.socket.end();
    this.finish();
  }

  finish() {
    if (this.closed) return;
    this.closed = true;
    this.emit('close');
  }
}
