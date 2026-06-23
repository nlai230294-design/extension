// Sinh icon PNG đặc một màu (đúng màu badge #aa3bff đang dùng trong
// serviceWorker.js) để manifest có icon hợp lệ ngay từ giờ. Đây chỉ là
// placeholder — cần thay bằng logo thiết kế thật trước khi nộp lên Chrome
// Web Store.
import { deflateSync } from "zlib";
import { writeFileSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "../public/icons");
const SIZES = [16, 32, 48, 128];
const COLOR = [0xaa, 0x3b, 0xff, 0xff]; // R,G,B,A của #aa3bff

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function makePng(size) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0); // width
  ihdrData.writeUInt32BE(size, 4); // height
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = chunk("IHDR", ihdrData);

  const row = Buffer.alloc(1 + size * 4);
  for (let x = 0; x < size; x += 1) row.set(COLOR, 1 + x * 4);
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  const idat = chunk("IDAT", deflateSync(raw));

  const iend = chunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of SIZES) {
  const path = resolve(OUT_DIR, `icon-${size}.png`);
  writeFileSync(path, makePng(size));
  console.log(`Generated ${path}`);
}
