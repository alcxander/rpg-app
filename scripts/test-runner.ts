import { spawn } from "child_process"

async function runTests() {
  console.log("🧪 Starting comprehensive test suite...")

  const testProcess = spawn("npm", ["run", "test:comprehensive"], {
    stdio: "inherit",
    shell: true,
  })

  testProcess.on("close", (code) => {
    if (code === 0) {
      console.log("✅ All tests passed!")
    } else {
      console.log(`❌ Tests failed with code ${code}`)
      process.exit(code)
    }
  })

  testProcess.on("error", (error) => {
    console.error("❌ Test execution error:", error)
    process.exit(1)
  })
}

runTests()
