import { customAlphabet } from "nanoid";

export const nanoid = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 12);
export const apiKeyGen = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz", 32);
export const bookingId = () => "TF-" + customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 6)();
