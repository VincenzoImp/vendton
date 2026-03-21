import vm from "node:vm";

interface ExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  durationMs: number;
}

const TIMEOUT_MS = 10_000; // 10 second max execution time

export async function executeDVM(
  code: string,
  input: Record<string, unknown>,
): Promise<ExecutionResult> {
  const start = Date.now();

  try {
    // Create a sandbox with limited globals
    const sandbox: Record<string, unknown> = {
      input,
      fetch: globalThis.fetch,
      URL: globalThis.URL,
      URLSearchParams: globalThis.URLSearchParams,
      JSON,
      Math,
      Date,
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
      encodeURIComponent,
      decodeURIComponent,
      console: {
        log: (..._args: unknown[]) => { /* swallow logs */ },
        error: (..._args: unknown[]) => { /* swallow errors */ },
      },
      // The result holder
      __result: undefined as unknown,
    };

    vm.createContext(sandbox);

    const asyncWrapped = `
      (async () => {
        ${code}
      })()
    `;

    const script = new vm.Script(asyncWrapped);
    const promise = script.runInContext(sandbox, { timeout: TIMEOUT_MS });

    // Wait for the async result with a timeout
    const result = await Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Execution timed out")), TIMEOUT_MS)
      ),
    ]);

    return {
      success: true,
      data: result,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    };
  }
}
