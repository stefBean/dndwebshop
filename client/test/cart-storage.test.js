import assert from "node:assert/strict";
import test from "node:test";
import {
  CART_STORAGE_KEY,
  parseCart,
  readCart,
  sanitizeCart,
  writeCart,
} from "../src/lib/cart-storage.js";
function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    entries: () => [...values.entries()],
  };
}
test("existing carts load from the unchanged storage key", () => {
  const stored = [
    { product_id: 1, quantity: 2 },
    { product_id: 6, quantity: 1 },
  ];
  const storage = memoryStorage({
    "dice-and-lore.cart.v1": JSON.stringify(stored),
  });
  assert.equal(CART_STORAGE_KEY, "dice-and-lore.cart.v1");
  assert.deepEqual(readCart(storage), stored);
});
test("cart edits survive reload and clearing preserves unrelated storage", () => {
  const storage = memoryStorage({ preferences: "keep me" });
  assert.deepEqual(readCart(storage), []);
  assert.equal(writeCart([{ product_id: 2, quantity: 3 }], storage), true);
  const reloaded = readCart(storage);
  assert.deepEqual(reloaded, [{ product_id: 2, quantity: 3 }]);
  reloaded[0].quantity = 4;
  writeCart(reloaded, storage);
  assert.deepEqual(readCart(storage), [{ product_id: 2, quantity: 4 }]);
  writeCart([], storage);
  assert.deepEqual(readCart(storage), []);
  assert.equal(storage.getItem("preferences"), "keep me");
  assert.deepEqual(
    storage
      .entries()
      .map(([key]) => key)
      .sort(),
    [CART_STORAGE_KEY, "preferences"].sort(),
  );
});
test("invalid JSON and non-array data produce an empty cart", () => {
  for (const value of [
    null,
    undefined,
    "",
    "{",
    "null",
    "{}",
    '"cart"',
    "12",
    "true",
  ])
    assert.deepEqual(parseCart(value), [], String(value));
  assert.deepEqual(
    readCart(memoryStorage({ [CART_STORAGE_KEY]: "{bad json" })),
    [],
  );
});
test("malformed entries do not discard valid neighboring items", () => {
  const mixed = [
    null,
    false,
    "bad",
    [],
    5,
    {},
    { product_id: 2 },
    { product_id: 1, quantity: 2 },
    { quantity: 3 },
    { product_id: 3, quantity: 1 },
  ];
  assert.deepEqual(parseCart(JSON.stringify(mixed)), [
    { product_id: 1, quantity: 2 },
    { product_id: 3, quantity: 1 },
  ]);
});
test("only positive integer IDs and whole quantities from 1 to 99 are retained", () => {
  const ids = [
    0,
    -1,
    1.5,
    "1",
    null,
    true,
    Number.MAX_SAFE_INTEGER + 1,
    Infinity,
    NaN,
  ];
  const quantities = [0, -1, 1.5, 100, "2", null, true, Infinity, NaN];
  assert.deepEqual(
    sanitizeCart([
      ...ids.map((product_id) => ({ product_id, quantity: 1 })),
      ...quantities.map((quantity) => ({ product_id: 1, quantity })),
      { product_id: 2, quantity: 1 },
      { product_id: 3, quantity: 99 },
    ]),
    [
      { product_id: 2, quantity: 1 },
      { product_id: 3, quantity: 99 },
    ],
  );
});
test("duplicate IDs retain the latest valid quantity and a single line", () => {
  assert.deepEqual(
    sanitizeCart([
      { product_id: 3, quantity: 1 },
      { product_id: 2, quantity: 2 },
      { product_id: 3, quantity: 5 },
      { product_id: 2, quantity: -1 },
    ]),
    [
      { product_id: 3, quantity: 5 },
      { product_id: 2, quantity: 2 },
    ],
  );
});
test("prices, product details, identities and credentials are stripped on read and write", () => {
  const contaminated = [
    {
      product_id: 4,
      quantity: 2,
      name: "Do not persist",
      price_cents: 1,
      total_cents: 2,
      user: { id: 10, email: "customer@example.test" },
      password: "Do not persist",
      token: "Do not persist",
      session: "Do not persist",
    },
  ];
  const expected = [{ product_id: 4, quantity: 2 }];
  const storage = memoryStorage({
    [CART_STORAGE_KEY]: JSON.stringify(contaminated),
  });
  assert.deepEqual(readCart(storage), expected);
  assert.equal(writeCart(contaminated, storage), true);
  assert.deepEqual(JSON.parse(storage.getItem(CART_STORAGE_KEY)), expected);
});
test("persisted carts cannot exceed the API's 100 distinct product limit", () => {
  const entries = Array.from({ length: 110 }, (_, i) => ({
    product_id: i + 1,
    quantity: 1,
  }));
  const storage = memoryStorage();
  writeCart(entries, storage);
  assert.equal(readCart(storage).length, 100);
  assert.equal(readCart(storage).at(-1).product_id, 100);
});
test("storage failures leave the in-memory cart intact", () => {
  const storage = {
    getItem() {
      throw new Error("Access denied");
    },
    setItem() {
      throw new Error("Quota exceeded");
    },
  };
  const cart = [{ product_id: 1, quantity: 2 }];
  assert.deepEqual(readCart(storage), []);
  assert.equal(writeCart(cart, storage), false);
  assert.deepEqual(cart, [{ product_id: 1, quantity: 2 }]);
  assert.deepEqual(readCart(null), []);
  assert.equal(writeCart(cart, null), false);
});
test("a blocked browser storage getter does not crash the app", (t) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw new Error("Storage is blocked");
    },
  });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else delete globalThis.localStorage;
  });
  assert.deepEqual(readCart(), []);
  assert.equal(writeCart([{ product_id: 1, quantity: 1 }]), false);
});
