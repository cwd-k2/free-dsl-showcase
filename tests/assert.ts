/**
 * Dependency-free assertion helpers sufficient for this showcase's structural and error checks.
 *
 * @module
 */

/** Narrow an unknown value after checking that it is truthy. */
export function assert(condition: unknown, message = "assertion failed"): asserts condition {
  if (!condition) throw new Error(message);
}

/** Compare JSON-shaped values structurally and report both serialized forms on failure. */
export function assertEquals(actual: unknown, expected: unknown): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`expected ${expectedJson}, received ${actualJson}`);
  }
}

/** Assert that a function throws an Error containing the expected message fragment. */
export function assertThrows(fn: () => unknown, message: string): void {
  try {
    fn();
  } catch (error) {
    if (error instanceof Error && error.message.includes(message)) return;
    throw error;
  }
  throw new Error(`expected function to throw an error containing: ${message}`);
}
