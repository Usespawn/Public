// Single controlled verification of the smoke-test METADATA CID via
// gateway.pinata.cloud. No retries, no uploads, no secrets printed.
const fs = require("fs");
const LOG = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/meta-verify.txt";
fs.writeFileSync(LOG, "");
const append = (s) => fs.appendFileSync(LOG, s + "\n");

const META_CID = "bafkreidga3g5tnvopyijkvamwevai3np324wdkgpgwtcdlq5hgjyjdfmzi";
const IMAGE_CID = "bafkreigectgq4icn5f2pon2ty7ri25ry46zwsg5ywgrlvnvslo375v6oo4";
const URL = `https://gateway.pinata.cloud/ipfs/${META_CID}`;

async function main() {
  append(`GET ${URL}`);
  let res;
  try {
    res = await fetch(URL, { signal: AbortSignal.timeout(30_000) });
  } catch (e) {
    append(`FETCH-FAILED: ${e.message || e}`);
    append("META-VERIFY-FAIL");
    return;
  }
  const ct = res.headers.get("content-type") || "(none)";
  append(`HTTP ${res.status} content-type=${ct}`);
  if (res.status !== 200) {
    const text = (await res.text()).slice(0, 200);
    append(`body: ${text}`);
    append("META-VERIFY-FAIL");
    return;
  }
  let json;
  try {
    json = JSON.parse(await res.text());
  } catch (e) {
    append(`JSON-PARSE-FAILED: ${e.message || e}`);
    append("META-VERIFY-FAIL");
    return;
  }
  append("valid JSON: true");
  append(`name: ${json.name}`);
  append(`symbol: ${json.symbol}`);
  append(`image field: ${json.image}`);
  append(
    json.image === `https://ipfs.io/ipfs/${IMAGE_CID}` || json.image === `ipfs://${IMAGE_CID}` || String(json.image).includes(IMAGE_CID)
      ? `image-field-links-image-cid: TRUE (${IMAGE_CID})`
      : "image-field-links-image-cid: FALSE"
  );
  append(`showName: ${json.showName} createdOn: ${json.createdOn}`);
  append("META-VERIFY-PASS");
}
main();