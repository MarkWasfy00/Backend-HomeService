// Our primary keys are BigInt, and `JSON.stringify` throws on BigInt values:
//   TypeError: Do not know how to serialize a BigInt
// Teaching BigInt how to serialize itself turns that crash into a JSON string,
// which is also the correct wire format (BigInt ids do not fit in a JS number).
//
// This is a safety net only. Each module still has a mapper that decides the
// exact response shape - see modules/users/users.mapper.ts.
declare global {
  interface BigInt {
    toJSON(): string;
  }
}

BigInt.prototype.toJSON = function () {
  return this.toString();
};

export {};
