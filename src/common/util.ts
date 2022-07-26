import { Buffer } from "buffer";


export function AsciiToBuffer(str: string): Buffer {
    return Buffer.from(str, "ascii");
}

export function HexToBuffer(str: string): Buffer {
    return Buffer.from(str, "hex");
}

export function BufferToAscii(buffer: Buffer): string {
    return buffer.toString('ascii');
}

export function BufferToHex(buffer: Buffer): string {
    return buffer.toString("hex");
}

export function AsciiToHex(str: string): string {
    return AsciiToBuffer(str).toString('hex');
}

export function HexToAscii(str: string): string {
    return HexToBuffer(str).toString("ascii");
}

export async function awaitTimeout(delay: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, delay));
}
