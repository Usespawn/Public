const fs = require("fs");
const p = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/web/public/images/Spawnpad-banner.png";
try {
  const st = fs.statSync(p);
  const b = Buffer.alloc(8);
  const fd = fs.openSync(p, "r");
  fs.readSync(fd, b, 0, 8, 0);
  fs.closeSync(fd);
  console.log("size:", st.size, "bytes");
  console.log("header:", b.toString("hex"));
  console.log("isPNG:", b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47);
} catch (e) {
  console.log("ERR", e.message);
}