import { randomBytes, randomUUID } from "node:crypto";

// Room codes: 4 uppercase letters/numbers, avoiding easily-confused chars.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function makeRoomCode(): string {
  const bytes = randomBytes(4);
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return code;
}

export function makeId(): string {
  return randomUUID();
}
