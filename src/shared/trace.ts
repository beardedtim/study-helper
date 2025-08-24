import Log from "./log";

export const traceFn = <T extends (...args: any[]) => any>(
  fn: T,
  name: string
): T => {
  const result = (...args: any[]) => {
    Log.trace({ name }, `${name} start`);

    const result = fn(...args);

    Log.trace({ name }, `${name} end`);

    return result;
  };

  return result as T;
};
