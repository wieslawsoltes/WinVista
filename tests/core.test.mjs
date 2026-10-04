import test from "node:test";
import assert from "node:assert/strict";
import {
  VirtualFileSystem,
  ClipboardService,
  normalizePath,
  resolvePath,
  dirname,
  Settings,
  EventBus,
} from "../packages/core/index.js";

const fresh = () => {
  const fs = new VirtualFileSystem();
  fs.seed();
  return fs;
};
test("Windows paths resolve root, relative, drive, and parent segments", () => {
  assert.equal(
    normalizePath("c:\\Users\\User\\Documents\\..\\Pictures"),
    "C:/Users/User/Pictures",
  );
  assert.equal(resolvePath("\\Windows", "C:/Users/User"), "C:/Windows");
  assert.equal(
    resolvePath("..\\Pictures", "C:/Users/User/Documents"),
    "C:/Users/User/Pictures",
  );
  assert.equal(
    resolvePath("C:notes.txt", "C:/Users/User"),
    "C:/Users/User/notes.txt",
  );
  assert.equal(dirname("C:/Windows"), "C:/");
});
test("File identity survives case-insensitive reads and folder rename", () => {
  const fs = fresh();
  fs.mkdir("C:/Users/User/Documents/Work");
  const file = fs.write("C:/Users/User/Documents/Work/a.txt", "hello");
  fs.move("c:/users/user/documents/work", "C:/Users/User/Documents/Renamed");
  assert.equal(fs.byId(file.id).path, "C:/Users/User/Documents/Renamed/a.txt");
  assert.equal(fs.read("C:/USERS/USER/DOCUMENTS/RENAMED/A.TXT"), "hello");
});
test("Search respects directory boundaries", () => {
  const fs = fresh();
  fs.mkdir("C:/Users/User/Documents2");
  fs.write("C:/Users/User/Documents2/needle.txt", "");
  fs.write("C:/Users/User/Documents/needle.txt", "");
  assert.equal(fs.search("needle", "C:/Users/User/Documents").length, 1);
});
test("File transactions roll back partial moves and notifications", () => {
  const fs = fresh();
  let changes = 0;
  fs.on("change", () => changes++);
  const before = [...fs.entries];
  assert.throws(() =>
    fs.transaction(() => {
      fs.mkdir("C:/Users/User/Documents/Temporary");
      fs.move("C:/Users/User/Documents/Welcome.txt", "C:/missing/file.txt");
    }),
  );
  assert.deepEqual([...fs.entries], before);
  assert.equal(changes, 0);
});
test("Clipboard cut into the same folder is a no-op; nested selections copy once", () => {
  const fs = fresh(),
    clip = new ClipboardService();
  const path = "C:/Users/User/Documents/Welcome.txt",
    id = fs.stat(path).id;
  clip.setFiles([path], true);
  assert.deepEqual(clip.paste(fs, dirname(path)), [path]);
  assert.equal(fs.stat(path).id, id);
  assert.equal(clip.files.length, 0);
  fs.mkdir("C:/Users/User/Documents/Bundle");
  fs.write("C:/Users/User/Documents/Bundle/n.txt", "n");
  clip.setFiles([
    "C:/Users/User/Documents/Bundle",
    "C:/Users/User/Documents/Bundle/n.txt",
  ]);
  assert.equal(clip.paste(fs, "C:/Users/User/Desktop").length, 1);
  assert.equal(fs.read("C:/Users/User/Desktop/Bundle/n.txt"), "n");
});
test("Recycle restore keeps identity and handles name collisions", () => {
  const fs = fresh(),
    original = "C:/Users/User/Documents/Welcome.txt",
    id = fs.stat(original).id;
  fs.remove(original);
  fs.write(original, "replacement");
  const restored = fs.restore(fs.byId(id).path);
  assert.equal(restored, "C:/Users/User/Documents/Welcome (2).txt");
  assert.equal(fs.byId(id).path, restored);
  assert.equal(fs.read(original), "replacement");
});
test("Backups round-trip Unicode and binary files; invalid restores preserve existing data", async () => {
  const fs = fresh();
  fs.write("C:/Users/User/Documents/日本語.txt", "Hello 😀\nZażółć");
  fs.write(
    "C:/Users/User/Documents/data.bin",
    new Blob([new Uint8Array([0, 255, 128, 1])]),
    "application/octet-stream",
  );
  const backup = await fs.backup(),
    restored = fresh();
  await restored.restoreBackup(backup);
  assert.equal(
    restored.read("C:/Users/User/Documents/日本語.txt"),
    "Hello 😀\nZażółć",
  );
  assert.deepEqual(
    [
      ...new Uint8Array(
        await restored.read("C:/Users/User/Documents/data.bin").arrayBuffer(),
      ),
    ],
    [0, 255, 128, 1],
  );
  const before = restored.entries.size;
  await assert.rejects(
    restored.restoreBackup(
      new Blob(['{"format":"vista-vfs","version":1,"entries":[]}']),
    ),
  );
  assert.equal(restored.entries.size, before);
});
test("Settings tolerate unavailable storage and aborted subscriptions do not fire", () => {
  const settings = new Settings({
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("full");
    },
  });
  settings.set("theme", "basic");
  assert.equal(settings.get("theme"), "basic");
  const bus = new EventBus(),
    controller = new AbortController();
  controller.abort();
  bus.on("test", () => assert.fail("aborted listener ran"), controller.signal);
  bus.emit("test");
});
