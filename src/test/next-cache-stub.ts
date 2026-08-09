/** Vitest stub for next/cache — revalidatePath is a no-op outside Next runtime. */
export function revalidatePath(_path?: string, _type?: string): void {
  // no-op
}

export function revalidateTag(_tag?: string): void {
  // no-op
}

export function unstable_cache<T extends (...args: never[]) => unknown>(fn: T): T {
  return fn;
}
