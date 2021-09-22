// Source: https://stackoverflow.com/a/55200387/3243814
const byteToHex: Array<string> = [];
for (let n = 0; n <= 0xff; ++n) {
  const hexOctet = n.toString(16).padStart(2, "0");
  byteToHex.push(hexOctet);
}

export function randomHex(length: number): string {
  const chars = new Uint8Array(length);
  globalThis.crypto.getRandomValues(chars);

  const hex = new Array(length);
  for (let i = 0; i < length; i++) {
    hex[i] = byteToHex[chars[i]];
  }
  return hex.join("");
}
