import { useMemo } from "react";

const VERSION = 5;
const SIZE = 17 + VERSION * 4;
const DATA_CODEWORDS = 108;
const EC_CODEWORDS = 26;
const FORMAT_MASK = 0x5412;
const FORMAT_GENERATOR = 0x537;

type Matrix = boolean[][];

class BitBuffer {
  private readonly bits: number[] = [];

  append(value: number, length: number) {
    for (let i = length - 1; i >= 0; i -= 1) {
      this.bits.push((value >>> i) & 1);
    }
  }

  get length() {
    return this.bits.length;
  }

  toCodewords() {
    const result: number[] = [];
    for (let i = 0; i < this.bits.length; i += 8) {
      let byte = 0;
      for (let j = 0; j < 8; j += 1) {
        byte = (byte << 1) | (this.bits[i + j] ?? 0);
      }
      result.push(byte);
    }
    return result;
  }
}

function buildGfTables() {
  const exp = new Array<number>(512).fill(0);
  const log = new Array<number>(256).fill(0);
  let value = 1;

  for (let i = 0; i < 255; i += 1) {
    exp[i] = value;
    log[value] = i;
    value <<= 1;
    if (value & 0x100) value ^= 0x11d;
  }

  for (let i = 255; i < 512; i += 1) {
    exp[i] = exp[i - 255];
  }

  return { exp, log };
}

const GF = buildGfTables();

function gfMultiply(a: number, b: number) {
  if (a === 0 || b === 0) return 0;
  return GF.exp[GF.log[a] + GF.log[b]];
}

function polyMultiply(a: number[], b: number[]) {
  const result = new Array<number>(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i += 1) {
    for (let j = 0; j < b.length; j += 1) {
      result[i + j] ^= gfMultiply(a[i], b[j]);
    }
  }
  return result;
}

function reedSolomonGenerator(degree: number) {
  let generator = [1];
  for (let i = 0; i < degree; i += 1) {
    generator = polyMultiply(generator, [1, GF.exp[i]]);
  }
  return generator;
}

const RS_GENERATOR = reedSolomonGenerator(EC_CODEWORDS);

function reedSolomon(data: number[]) {
  const result = new Array<number>(EC_CODEWORDS).fill(0);
  for (const byte of data) {
    const factor = byte ^ result.shift()!;
    result.push(0);
    for (let i = 0; i < EC_CODEWORDS; i += 1) {
      result[i] ^= gfMultiply(RS_GENERATOR[i + 1], factor);
    }
  }
  return result;
}

function encodeData(value: string) {
  const bytes = Array.from(new TextEncoder().encode(value));
  if (bytes.length > DATA_CODEWORDS - 2) {
    throw new Error("Certificate verification URL is too long for the QR template.");
  }

  const buffer = new BitBuffer();
  buffer.append(0b0100, 4);
  buffer.append(bytes.length, 8);
  bytes.forEach((byte) => buffer.append(byte, 8));

  const capacityBits = DATA_CODEWORDS * 8;
  const terminatorLength = Math.min(4, capacityBits - buffer.length);
  if (terminatorLength > 0) buffer.append(0, terminatorLength);
  while (buffer.length % 8 !== 0) buffer.append(0, 1);

  const data = buffer.toCodewords();
  for (let padIndex = 0; data.length < DATA_CODEWORDS; padIndex += 1) {
    data.push(padIndex % 2 === 0 ? 0xec : 0x11);
  }

  return [...data, ...reedSolomon(data)];
}

function createEmptyMatrix() {
  return {
    modules: Array.from({ length: SIZE }, () => new Array<boolean>(SIZE).fill(false)),
    reserved: Array.from({ length: SIZE }, () => new Array<boolean>(SIZE).fill(false)),
  };
}

function setModule(
  modules: Matrix,
  reserved: Matrix,
  row: number,
  col: number,
  dark: boolean,
  reserve = true,
) {
  if (row < 0 || row >= SIZE || col < 0 || col >= SIZE) return;
  modules[row][col] = dark;
  if (reserve) reserved[row][col] = true;
}

function placeFinder(modules: Matrix, reserved: Matrix, row: number, col: number) {
  for (let y = -1; y <= 7; y += 1) {
    for (let x = -1; x <= 7; x += 1) {
      const targetRow = row + y;
      const targetCol = col + x;
      if (targetRow < 0 || targetRow >= SIZE || targetCol < 0 || targetCol >= SIZE) {
        continue;
      }

      const isSeparator = x === -1 || x === 7 || y === -1 || y === 7;
      const isDark =
        !isSeparator &&
        (x === 0 ||
          x === 6 ||
          y === 0 ||
          y === 6 ||
          (x >= 2 && x <= 4 && y >= 2 && y <= 4));
      setModule(modules, reserved, targetRow, targetCol, isDark);
    }
  }
}

function placeAlignment(modules: Matrix, reserved: Matrix, row: number, col: number) {
  for (let y = -2; y <= 2; y += 1) {
    for (let x = -2; x <= 2; x += 1) {
      const distance = Math.max(Math.abs(x), Math.abs(y));
      setModule(modules, reserved, row + y, col + x, distance === 2 || distance === 0);
    }
  }
}

function reserveFormatAreas(modules: Matrix, reserved: Matrix) {
  for (let i = 0; i <= 8; i += 1) {
    if (i !== 6) {
      setModule(modules, reserved, 8, i, false);
      setModule(modules, reserved, i, 8, false);
    }
  }

  for (let i = 0; i < 8; i += 1) {
    setModule(modules, reserved, SIZE - 1 - i, 8, false);
    setModule(modules, reserved, 8, SIZE - 1 - i, false);
  }
}

function placeFunctionPatterns(modules: Matrix, reserved: Matrix) {
  placeFinder(modules, reserved, 0, 0);
  placeFinder(modules, reserved, 0, SIZE - 7);
  placeFinder(modules, reserved, SIZE - 7, 0);
  placeAlignment(modules, reserved, 30, 30);

  for (let i = 8; i < SIZE - 8; i += 1) {
    const dark = i % 2 === 0;
    setModule(modules, reserved, 6, i, dark);
    setModule(modules, reserved, i, 6, dark);
  }

  setModule(modules, reserved, VERSION * 4 + 9, 8, true);
  reserveFormatAreas(modules, reserved);
}

function formatBits(mask: number) {
  const data = (0b01 << 3) | mask;
  let bits = data << 10;
  for (let i = 14; i >= 10; i -= 1) {
    if (((bits >>> i) & 1) !== 0) {
      bits ^= FORMAT_GENERATOR << (i - 10);
    }
  }
  return ((data << 10) | bits) ^ FORMAT_MASK;
}

function placeFormatBits(modules: Matrix, reserved: Matrix, mask: number) {
  const bits = formatBits(mask);
  const isDark = (index: number) => ((bits >>> index) & 1) !== 0;

  for (let i = 0; i <= 5; i += 1) setModule(modules, reserved, 8, i, isDark(i));
  setModule(modules, reserved, 8, 7, isDark(6));
  setModule(modules, reserved, 8, 8, isDark(7));
  setModule(modules, reserved, 7, 8, isDark(8));
  for (let i = 9; i < 15; i += 1) setModule(modules, reserved, 14 - i, 8, isDark(i));

  for (let i = 0; i < 8; i += 1) setModule(modules, reserved, SIZE - 1 - i, 8, isDark(i));
  for (let i = 8; i < 15; i += 1) {
    setModule(modules, reserved, 8, SIZE - 15 + i, isDark(i));
  }
}

function shouldMask(row: number, col: number) {
  return (row + col) % 2 === 0;
}

function createQrMatrix(value: string) {
  const { modules, reserved } = createEmptyMatrix();
  placeFunctionPatterns(modules, reserved);

  const codewords = encodeData(value);
  const bits = codewords.flatMap((byte) =>
    Array.from({ length: 8 }, (_, index) => (byte >>> (7 - index)) & 1),
  );

  let bitIndex = 0;
  let upward = true;
  for (let right = SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1;
    for (let vertical = 0; vertical < SIZE; vertical += 1) {
      const row = upward ? SIZE - 1 - vertical : vertical;
      for (let offset = 0; offset < 2; offset += 1) {
        const col = right - offset;
        if (reserved[row][col]) continue;

        let bit = bits[bitIndex] ?? 0;
        bitIndex += 1;
        if (shouldMask(row, col)) bit ^= 1;
        modules[row][col] = bit === 1;
      }
    }
    upward = !upward;
  }

  placeFormatBits(modules, reserved, 0);
  return modules;
}

type CertificateQrCodeProps = {
  value: string;
  title?: string;
};

export default function CertificateQrCode({ value, title = "QR de vérification" }: CertificateQrCodeProps) {
  const matrix = useMemo(() => {
    try {
      return createQrMatrix(value || "https://academie-des-creatifs.local/certificat");
    } catch {
      return createQrMatrix("https://academie-des-creatifs.local/certificat");
    }
  }, [value]);

  const logoBackdropSize = 9.4;
  const logoSize = 5.4;
  const logoBackdropX = (SIZE - logoBackdropSize) / 2;
  const logoBackdropY = (SIZE - logoBackdropSize) / 2;
  const logoX = (SIZE - logoSize) / 2;
  const logoY = (SIZE - logoSize) / 2;

  return (
    <svg
      className="cert-qr__svg"
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label={title}
      shapeRendering="crispEdges"
    >
      <rect width={SIZE} height={SIZE} fill="#fff" />
      {matrix.map((row, rowIndex) =>
        row.map((dark, colIndex) =>
          dark ? (
            <rect
              key={`${rowIndex}-${colIndex}`}
              x={colIndex}
              y={rowIndex}
              width="1"
              height="1"
              fill="#0b3a45"
            />
          ) : null,
        ),
      )}
      <rect
        x={logoBackdropX}
        y={logoBackdropY}
        width={logoBackdropSize}
        height={logoBackdropSize}
        rx="2.2"
        fill="#ffffff"
        stroke="#d5e2e3"
        strokeWidth="0.65"
      />
      <image
        href="/logo_ico_hd.png"
        x={logoX}
        y={logoY}
        width={logoSize}
        height={logoSize}
        preserveAspectRatio="xMidYMid meet"
      />
    </svg>
  );
}
