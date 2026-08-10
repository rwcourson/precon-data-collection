import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const developerCandidates = [
  process.env.DEVELOPER_DIR,
  "/Users/robert/Downloads/Xcode-beta.app/Contents/Developer",
  "/Applications/Xcode.app/Contents/Developer",
].filter(Boolean);
const developerDir = developerCandidates.find((candidate) =>
  fs.existsSync(path.join(candidate, "usr", "bin", "xcodebuild")),
);

if (!developerDir) {
  process.stderr.write("No usable Xcode developer directory was found.\n");
  process.exit(1);
}

const env = { ...process.env, DEVELOPER_DIR: developerDir };
const devices = spawnSync("xcrun", ["simctl", "list", "devices", "available", "--json"], {
  cwd: repoRoot,
  env,
  encoding: "utf8",
});
if (devices.status !== 0) {
  process.stderr.write(devices.stderr ?? "Unable to enumerate iOS simulators.\n");
  process.exit(devices.status ?? 1);
}

const runtimes = JSON.parse(devices.stdout).devices;
const iphones = Object.entries(runtimes)
  .filter(([runtime]) => runtime.includes("iOS"))
  .flatMap(([, entries]) => entries)
  .filter((device) => device.isAvailable && device.name.startsWith("iPhone"));
const simulator = iphones.find((device) => device.name === "iPhone 17 Pro") ?? iphones[0];
if (!simulator) {
  process.stderr.write("No available iPhone simulator was found.\n");
  process.exit(1);
}

process.stdout.write(`Xcode developer directory: ${developerDir}\n`);
process.stdout.write(`iOS test destination: ${simulator.name} (${simulator.udid})\n`);
const test = spawnSync(
  "xcodebuild",
  [
    "-project",
    "apps/ios/PreconNative.xcodeproj",
    "-scheme",
    "PreconNative",
    "-destination",
    `id=${simulator.udid}`,
    "CODE_SIGNING_ALLOWED=NO",
    "test",
  ],
  { cwd: repoRoot, env, stdio: "inherit" },
);
process.exit(test.status ?? 1);
