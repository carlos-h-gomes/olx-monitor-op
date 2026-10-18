import test from "node:test";
import assert from "node:assert/strict";

// chrome.storage.local em memoria, so o que o store usa.
const data = {};
globalThis.chrome = {
  storage: {
    local: {
      async get(key) {
        return key in data ? { [key]: structuredClone(data[key]) } : {};
      },
      async set(obj) {
        Object.assign(data, structuredClone(obj));
      },
      async remove(key) {
        delete data[key];
      },
    },
  },
};

const store = await import("../extension/lib/store.js");

test("remove um achado pela chave e mantem os outros", async () => {
  await store.addFinds([{ key: "s1:1", title: "A" }, { key: "s1:2", title: "B" }, { key: "s2:3", title: "C" }]);
  await store.removeFind("s1:2");
  assert.deepEqual((await store.getFinds()).map((f) => f.key), ["s1:1", "s2:3"]);
  await store.removeFind("nao-existe");
  assert.equal((await store.getFinds()).length, 2);
});

test("busca nova aceita palavras obrigatorias iniciais", () => {
  assert.deepEqual(store.newSearch({ url: "u", name: "n", site: "olx", required: ["switch"] }).required, ["switch"]);
  assert.deepEqual(store.newSearch({ url: "u", name: "n", site: "olx" }).required, []);
});
