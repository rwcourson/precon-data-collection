/** Vitest stub for next/cache — revalidatePath is a no-op outside Next runtime. */
export function revalidatePath(path?: string, type?: string): void {
  void path;
  void type;
}

export function revalidateTag(tag?: string): void {
  void tag;
}

export function unstable_cache<T extends (...args: never[]) => unknown>(
  fn: T
): T {
  return fn;
}
