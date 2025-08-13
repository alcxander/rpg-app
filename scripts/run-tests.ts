import { execSync } from "child_process"
import { exit } from "process"

console.log("🧪 Running Shopkeeper Workflow Tests...")

try {
  // Run the specific test file
  execSync("npm run test:shopkeeper", {
    stdio: "inherit",
    cwd: process.cwd(),
  })

  console.log("✅ All tests passed!")
  exit(0)
} catch (error) {
  console.error("❌ Tests failed!")
  console.error(error)
  exit(1)
}
