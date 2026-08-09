/** Vitest stub for next/headers cookies/headers used by getCurrentUser outside ALS. */

const store = new Map<string, string>();

export async function cookies() {
  return {
    get(name: string) {
      const v = store.get(name);
      return v === undefined ? undefined : { name, value: v };
    },
    set(name: string, value: string) {
      store.set(name, value);
    },
    delete(name: string) {
      store.delete(name);
    },
  };
}

export async function headers() {
  return new Headers();
}
