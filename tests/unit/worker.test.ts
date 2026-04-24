import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import { createDebouncedAnalysisScheduler } from '#worker'

describe('createDebouncedAnalysisScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('executes the analysis function after the quiet period', async () => {
    const analysisFn = vi.fn().mockResolvedValue(undefined)
    const scheduler = createDebouncedAnalysisScheduler(analysisFn, 100)

    scheduler.schedule()
    expect(analysisFn).not.toHaveBeenCalled()

    await vi.runAllTimersAsync()

    expect(analysisFn).toHaveBeenCalledOnce()
  })

  it('does not execute the analysis function before the quiet period elapses', () => {
    const analysisFn = vi.fn().mockResolvedValue(undefined)
    const scheduler = createDebouncedAnalysisScheduler(analysisFn, 100)

    scheduler.schedule()
    vi.advanceTimersByTime(50)

    expect(analysisFn).not.toHaveBeenCalled()
  })

  it('resets the timer when schedule is called again within the quiet period', async () => {
    const analysisFn = vi.fn().mockResolvedValue(undefined)
    const scheduler = createDebouncedAnalysisScheduler(analysisFn, 100)

    scheduler.schedule()
    vi.advanceTimersByTime(50)
    scheduler.schedule()
    vi.advanceTimersByTime(50)

    expect(analysisFn).not.toHaveBeenCalled()

    await vi.runAllTimersAsync()

    expect(analysisFn).toHaveBeenCalledOnce()
  })

  it('executes the analysis function only once after a burst of schedule calls', async () => {
    const analysisFn = vi.fn().mockResolvedValue(undefined)
    const scheduler = createDebouncedAnalysisScheduler(analysisFn, 100)

    scheduler.schedule()
    scheduler.schedule()
    scheduler.schedule()
    scheduler.schedule()

    await vi.runAllTimersAsync()

    expect(analysisFn).toHaveBeenCalledOnce()
  })

  it('cancels a pending execution when cancel is called', async () => {
    const analysisFn = vi.fn().mockResolvedValue(undefined)
    const scheduler = createDebouncedAnalysisScheduler(analysisFn, 100)

    scheduler.schedule()
    scheduler.cancel()

    await vi.runAllTimersAsync()

    expect(analysisFn).not.toHaveBeenCalled()
  })

  it('does not throw when cancel is called with no pending execution', () => {
    const analysisFn = vi.fn().mockResolvedValue(undefined)
    const scheduler = createDebouncedAnalysisScheduler(analysisFn, 100)

    expect(() => scheduler.cancel()).not.toThrow()
  })

  it('allows rescheduling after a cancel', async () => {
    const analysisFn = vi.fn().mockResolvedValue(undefined)
    const scheduler = createDebouncedAnalysisScheduler(analysisFn, 100)

    scheduler.schedule()
    scheduler.cancel()
    scheduler.schedule()

    await vi.runAllTimersAsync()

    expect(analysisFn).toHaveBeenCalledOnce()
  })

  it('does not throw when the analysis function rejects, and logs the error', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const analysisFn = vi.fn().mockRejectedValue(new Error('analysis failed'))
    const scheduler = createDebouncedAnalysisScheduler(analysisFn, 100)

    scheduler.schedule()
    await vi.runAllTimersAsync()

    expect(consoleErrorSpy).toHaveBeenCalledOnce()
    expect(consoleErrorSpy.mock.calls[0][0]).toContain('vite-plugin-safe-env')
    consoleErrorSpy.mockRestore()
  })
})

describe('createDebouncedAnalysisScheduler input validation', () => {
  it('throws a RangeError when quietPeriodMs is negative', () => {
    expect(() => createDebouncedAnalysisScheduler(vi.fn().mockResolvedValue(undefined), -1)).toThrow(RangeError)
  })

  it('throws a RangeError when quietPeriodMs is NaN', () => {
    expect(() => createDebouncedAnalysisScheduler(vi.fn().mockResolvedValue(undefined), NaN)).toThrow(RangeError)
  })
})
