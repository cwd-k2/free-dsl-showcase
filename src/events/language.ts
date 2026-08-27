/** Pull/publish vocabulary for generator programs hosted by an event runtime. */

import { perform } from "../free.ts";

export type Event = Readonly<{ type: string }>;

export const events = {
  /** Suspend until the runtime supplies the next event; null marks a finite replay's end. */
  next: <E extends Event>() => perform<E | null>("events.next"),
  /** Publish a derived event without coupling the program to a broker implementation. */
  publish: <E extends Event>(event: E) => perform<void>("events.publish", { event }),
};
