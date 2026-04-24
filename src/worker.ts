/**
 * A handle returned by {@link createDebouncedAnalysisScheduler} that exposes
 * the `cancel` method for clearing a pending analysis run.
 */
export type AnalysisSchedulerHandle = {
  /**
   * Cancels any pending analysis that has not yet started executing.
   * Safe to call even when no analysis is pending.
   */
  cancel: () => void
}

/**
 * The object returned by {@link createDebouncedAnalysisScheduler}.
 * Provides a `schedule` method to trigger a debounced analysis run
 * and a `cancel` method to abort any pending run.
 */
export type DebouncedAnalysisScheduler = AnalysisSchedulerHandle & {
  /** Triggers a debounced analysis run, resetting any pending timer. */
  schedule: () => void
}

/**
 * Creates a debounced analysis scheduler that delays executing the provided
 * async analysis function until the specified quiet period has elapsed without
 * another call to `schedule`. Subsequent calls within the quiet period reset
 * the timer, ensuring the analysis runs only once after a burst of rapid HMR updates.
 *
 * @param analysisFunction - The async function to invoke after the quiet period.
 * @param quietPeriodMs - Milliseconds to wait after the last `schedule` call before executing.
 * @returns An object with a `schedule` method to trigger the debounced run
 *          and a `cancel` method to abort a pending run.
 * @throws {RangeError} If `quietPeriodMs` is negative, `NaN`, or non-finite.
 *
 * @example
 * ```ts
 * const scheduler = createDebouncedAnalysisScheduler(runGraphAnalysis, 150)
 * // Call on every HMR update. Only the last one within 150 ms fires.
 * scheduler.schedule()
 * ```
 */
export function createDebouncedAnalysisScheduler(
  analysisFunction: () => Promise<void>,
  quietPeriodMs: number
): DebouncedAnalysisScheduler {
  if (!Number.isFinite(quietPeriodMs) || quietPeriodMs < 0) {
    throw new RangeError(`quietPeriodMs must be a non-negative finite number, received ${quietPeriodMs}`)
  }

  let pendingTimeoutId: ReturnType<typeof setTimeout> | null = null

  function schedule(): void {
    if (pendingTimeoutId !== null) {
      clearTimeout(pendingTimeoutId)
    }

    pendingTimeoutId = setTimeout(() => {
      pendingTimeoutId = null
      analysisFunction().catch((analysisError: unknown) => {
        console.error('[vite-plugin-safe-env] Dev analysis error:', analysisError)
      })
    }, quietPeriodMs)
  }

  function cancel(): void {
    if (pendingTimeoutId !== null) {
      clearTimeout(pendingTimeoutId)
      pendingTimeoutId = null
    }
  }

  return { schedule, cancel }
}
