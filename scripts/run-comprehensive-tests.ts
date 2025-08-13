import { execSync } from "child_process"
import { exit } from "process"

console.log("🧪 Running Comprehensive Shopkeeper Tests...")

try {
  // Run the comprehensive test file
  execSync("npx vitest run __tests__/shopkeeper-comprehensive.test.ts --reporter=verbose", {
    stdio: "inherit",
    cwd: process.cwd(),
  })

  console.log("✅ All comprehensive tests passed!")

  // Also run the original workflow tests
  console.log("🧪 Running Original Workflow Tests...")
  execSync("npx vitest run __tests__/shopkeeper-workflow.test.ts --reporter=verbose", {
    stdio: "inherit",
    cwd: process.cwd(),
  })

  console.log("✅ All tests passed successfully!")
  exit(0)
} catch (error) {
  console.error("❌ Tests failed!")
  console.error(error)
  exit(1)
}
