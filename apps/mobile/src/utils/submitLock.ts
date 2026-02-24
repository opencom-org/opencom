type SubmitTask<T> = () => Promise<T>;

export interface SubmitLock {
  current: boolean;
}

export function createSubmitLock(): SubmitLock {
  return { current: false };
}

export async function runWithSubmitLock<T>(
  lock: SubmitLock,
  task: SubmitTask<T>
): Promise<{ started: boolean; result?: T }> {
  if (lock.current) {
    return { started: false };
  }

  lock.current = true;
  try {
    const result = await task();
    return { started: true, result };
  } finally {
    lock.current = false;
  }
}
