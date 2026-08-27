/** IO and logging operations available to application programs. */

import { perform } from "@/core/free.ts";

/** Ordinary console I/O operations. */
export const io = {
  readLine: (question: string) => perform<string>("io.readLine", { question }),
  writeLine: (text: string) => perform<void>("io.writeLine", { text }),
};

/** Logging remains a separate effect even when a runtime also uses the console. */
export const log = {
  info: (message: string) => perform<void>("log.info", { message }),
};
