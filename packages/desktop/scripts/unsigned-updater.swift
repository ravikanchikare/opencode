import Foundation

let arguments = CommandLine.arguments
guard arguments.count == 5 else {
  FileHandle.standardError.write(Data("usage: opencode-unsigned-updater <pid> <app-path> <zip-path> <sha512-base64>\n".utf8))
  exit(2)
}

let pid = Int32(arguments[1]) ?? 0
let appPath = (arguments[2] as NSString).standardizingPath
let zipPath = (arguments[3] as NSString).standardizingPath
let expectedHash = arguments[4]

guard pid > 0, appPath.hasSuffix(".app"), zipPath.hasSuffix(".zip"), !expectedHash.isEmpty else {
  FileHandle.standardError.write(Data("invalid updater arguments\n".utf8))
  exit(2)
}

func fail(_ message: String) -> Never {
  FileHandle.standardError.write(Data("\(message)\n".utf8))
  exit(1)
}

func run(_ launchPath: String, _ args: [String]) {
  let task = Process()
  task.executableURL = URL(fileURLWithPath: launchPath)
  task.arguments = args
  do {
    try task.run()
  } catch {
    fail("failed to run \(launchPath): \(error)")
  }
  task.waitUntilExit()
  if task.terminationStatus != 0 {
    fail("\(launchPath) exited \(task.terminationStatus)")
  }
}

func sha512Base64(_ path: String) -> String {
  let task = Process()
  task.executableURL = URL(fileURLWithPath: "/usr/bin/openssl")
  task.arguments = ["dgst", "-sha512", "-binary", path]
  let pipe = Pipe()
  task.standardOutput = pipe
  do {
    try task.run()
  } catch {
    fail("failed to hash update: \(error)")
  }
  task.waitUntilExit()
  if task.terminationStatus != 0 {
    fail("openssl exited \(task.terminationStatus)")
  }
  return pipe.fileHandleForReading.readDataToEndOfFile().base64EncodedString()
}

if pid != getpid() {
  let deadline = Date().addingTimeInterval(30)
  while kill(pid, 0) == 0 {
    if Date() > deadline { fail("timed out waiting for pid \(pid) to exit") }
    Thread.sleep(forTimeInterval: 0.2)
  }
}

guard sha512Base64(zipPath) == expectedHash else {
  fail("update checksum mismatch")
}

let parent = (appPath as NSString).deletingLastPathComponent
let staging = (parent as NSString).appendingPathComponent(".\((appPath as NSString).lastPathComponent).next")
let backup = "\(appPath).old"
let fileManager = FileManager.default
try? fileManager.removeItem(atPath: staging)
try? fileManager.removeItem(atPath: backup)

run("/usr/bin/ditto", ["-xk", zipPath, staging])

let contents: [String]
do {
  contents = try fileManager.contentsOfDirectory(atPath: staging)
} catch {
  fail("failed to read extracted update: \(error)")
}
let extracted = contents.first(where: { $0.hasSuffix(".app") }).map { (staging as NSString).appendingPathComponent($0) }
guard let extracted else {
  fail("extracted update does not contain an app bundle")
}

do {
  try fileManager.moveItem(atPath: appPath, toPath: backup)
} catch {
  fail("failed to move current app aside: \(error)")
}

do {
  try fileManager.moveItem(atPath: extracted, toPath: appPath)
} catch {
  _ = try? fileManager.moveItem(atPath: backup, toPath: appPath)
  fail("failed to install update: \(error)")
}

run("/usr/bin/xattr", ["-dr", "com.apple.quarantine", appPath])
run("/usr/bin/open", ["-a", appPath])
try? fileManager.removeItem(atPath: backup)
try? fileManager.removeItem(atPath: staging)
try? fileManager.removeItem(atPath: zipPath)
