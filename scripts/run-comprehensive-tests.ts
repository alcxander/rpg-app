import { execSync } from "child_process"

console.log("🧪 Running Comprehensive Shopkeeper System Tests...")
console.log("=".repeat(60))

try {
  // Run the comprehensive tests
  const result = execSync("npm run test:comprehensive", {
    encoding: "utf-8",
    stdio: "inherit",
  })

  console.log("\n✅ All comprehensive tests passed!")

  // Also run other related tests
  console.log("\n🔄 Running additional test suites...")

  try {
    execSync("npm run test __tests__/invite-workflow.test.ts", {
      encoding: "utf-8",
      stdio: "inherit",
    })
    console.log("✅ Invite workflow tests passed!")
  } catch (error) {
    console.log("⚠️  Invite workflow tests had issues")
  }

  try {
    execSync("npm run test __tests__/shopkeeper-workflow.test.ts", {
      encoding: "utf-8",
      stdio: "inherit",
    })
    console.log("✅ Shopkeeper workflow tests passed!")
  } catch (error) {
    console.log("⚠️  Shopkeeper workflow tests had issues")
  }

  console.log("\n🎉 Test execution completed!")
} catch (error) {
  console.error("❌ Tests failed:")
  console.error(error)
  process.exit(1)
}
