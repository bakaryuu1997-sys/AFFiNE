#!/usr/bin/env python3
"""Draws the app icon (a small three-node diagram) and writes the PNG and ICO
files Tauri needs into src-tauri/icons. Pure Python, no imaging library."""
import math
import os
import struct
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'src-tauri', 'icons')
BASE = 1024  # drawn once at this size, then box-filtered down


def clamp(v, lo=0.0, hi=1.0):
    return max(lo, min(hi, v))


def dist_segment(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def rounded_rect_alpha(x, y, radius, px):
    # signed distance to a rounded square covering [0,1]
    qx = abs(x - 0.5) - (0.5 - radius)
    qy = abs(y - 0.5) - (0.5 - radius)
    d = math.hypot(max(qx, 0), max(qy, 0)) + min(max(qx, qy), 0) - radius
    return clamp(0.5 - d * px)


NODES = [(0.50, 0.30), (0.30, 0.64), (0.70, 0.64)]
EDGES = [(0, 1), (0, 2), (1, 2)]
NODE_R = 0.085
EDGE_W = 0.032


def render():
    size = BASE
    rows = []
    for j in range(size):
        y = (j + 0.5) / size
        row = bytearray()
        for i in range(size):
            x = (i + 0.5) / size
            a = rounded_rect_alpha(x, y, 0.22, size)
            if a <= 0:
                row += b'\x00\x00\x00\x00'
                continue
            t = (x + y) / 2
            r = int(79 + (14 - 79) * t)
            g = int(70 + (165 - 70) * t)
            b = int(229 + (233 - 229) * t)
            # white diagram: edges and nodes, antialiased by distance
            cover = 0.0
            for (ia, ib) in EDGES:
                ax, ay = NODES[ia]
                bx, by = NODES[ib]
                d = dist_segment(x, y, ax, ay, bx, by) - EDGE_W / 2
                cover = max(cover, clamp(0.5 - d * size))
            for (nx, ny) in NODES:
                d = math.hypot(x - nx, y - ny) - NODE_R
                cover = max(cover, clamp(0.5 - d * size))
            r = int(r + (255 - r) * cover)
            g = int(g + (255 - g) * cover)
            b = int(b + (255 - b) * cover)
            row += bytes((r, g, b, int(a * 255)))
        rows.append(row)
    return rows


def downscale(rows, target):
    factor = BASE // target
    out = []
    for j in range(target):
        row = bytearray()
        for i in range(target):
            acc = [0, 0, 0, 0]
            weight = 0
            for dj in range(factor):
                src = rows[j * factor + dj]
                for di in range(factor):
                    k = (i * factor + di) * 4
                    alpha = src[k + 3]
                    acc[0] += src[k] * alpha
                    acc[1] += src[k + 1] * alpha
                    acc[2] += src[k + 2] * alpha
                    acc[3] += alpha
                    weight += 1
            if acc[3] == 0:
                row += b'\x00\x00\x00\x00'
            else:
                row += bytes((acc[0] // acc[3], acc[1] // acc[3], acc[2] // acc[3], acc[3] // weight))
        out.append(row)
    return out


def png_bytes(rows):
    h, w = len(rows), len(rows[0]) // 4

    def chunk(tag, data):
        body = tag + data
        return struct.pack('>I', len(data)) + body + struct.pack('>I', zlib.crc32(body) & 0xFFFFFFFF)

    raw = b''.join(b'\x00' + bytes(r) for r in rows)
    return (b'\x89PNG\r\n\x1a\n'
            + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(raw, 9))
            + chunk(b'IEND', b''))


def ico_bytes(images):
    # images: list of (size, png bytes); PNG payloads are valid in ICO since Vista
    header = struct.pack('<HHH', 0, 1, len(images))
    offset = 6 + 16 * len(images)
    entries, data = b'', b''
    for size, png in images:
        entries += struct.pack('<BBBBHHII', size % 256, size % 256, 0, 0, 1, 32, len(png), offset)
        offset += len(png)
        data += png
    return header + entries + data


def main():
    os.makedirs(OUT, exist_ok=True)
    base = render()
    pngs = {s: png_bytes(downscale(base, s)) for s in (16, 32, 48, 128, 256, 512)}
    files = {
        '32x32.png': pngs[32],
        '128x128.png': pngs[128],
        '128x128@2x.png': pngs[256],
        'icon.png': pngs[512],
        'icon.ico': ico_bytes([(s, pngs[s]) for s in (16, 32, 48, 256)]),
    }
    for name, content in files.items():
        with open(os.path.join(OUT, name), 'wb') as f:
            f.write(content)
        print('wrote', name, len(content), 'bytes')


if __name__ == '__main__':
    main()
