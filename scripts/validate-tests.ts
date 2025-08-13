import { execSync } from "child_process"

console.log("🔍 Validating test setup...")

try {
  // Check if vitest is available
  execSync("npx vitest --version", { stdio: "pipe" })
  console.log("✅ Vitest is available")

  // Run a simple test to validate setup
  const result = execSync("npx vitest run __tests__/shopkeeper-comprehensive.test.ts --reporter=basic", {
    encoding: "utf-8",
    timeout: 30000,
  })

  console.log("Test output:")
  console.log(result)

  if (result.includes("failed")) {
    console.log("❌ Some tests are still failing")
    process.exit(1)
  } else {
    console.log("✅ All tests are passing!")
  }
} catch (error) {
  console.error("❌ Test validation failed:")
  console.error(error.toString())
  process.exit(1)
}
