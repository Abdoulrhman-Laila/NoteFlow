import { scrypt, randomBytes, timingSafeEqual, type ScryptOptions } from "node:crypto";

const SCRYPT_N = 32_768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const MAX_MEMORY = 64 * 1024 * 1024;

const HASH_PATTERN = /^scrypt\$(\d+)\$(\d+)\$(\d+)\$([A-Za-z0-9_-]+)\$([A-Za-z0-9_-]+)$/;

function deriveKey(password: string, salt: Buffer, keyLength: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, derivedKey) => {
      if (error !== null) {
        reject(error);
        return;
      }

      resolve(derivedKey);
    });
  });
}

function isSupportedCost(cost: number, blockSize: number, parallelization: number): boolean {
  return cost === SCRYPT_N && blockSize === SCRYPT_R && parallelization === SCRYPT_P;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derivedKey = await deriveKey(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: MAX_MEMORY,
  });

  return [
    "scrypt",
    String(SCRYPT_N),
    String(SCRYPT_R),
    String(SCRYPT_P),
    salt.toString("base64url"),
    derivedKey.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  const match = HASH_PATTERN.exec(passwordHash);
  if (match === null) return false;

  const cost = Number(match[1]);
  const blockSize = Number(match[2]);
  const parallelization = Number(match[3]);
  const saltPart = match[4];
  const keyPart = match[5];

  if (
    saltPart === undefined ||
    keyPart === undefined ||
    !Number.isInteger(cost) ||
    !Number.isInteger(blockSize) ||
    !Number.isInteger(parallelization) ||
    !isSupportedCost(cost, blockSize, parallelization)
  ) {
    return false;
  }

  const salt = Buffer.from(saltPart, "base64url");
  const expected = Buffer.from(keyPart, "base64url");
  if (salt.length !== SALT_LENGTH || expected.length !== KEY_LENGTH) return false;

  let derivedKey: Buffer;
  try {
    derivedKey = await deriveKey(password, salt, KEY_LENGTH, {
      N: cost,
      r: blockSize,
      p: parallelization,
      maxmem: MAX_MEMORY,
    });
  } catch {
    return false;
  }

  if (derivedKey.length !== expected.length) return false;
  return timingSafeEqual(derivedKey, expected);
}
