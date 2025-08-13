import { vi, beforeEach } from "vitest"

// Mock Next.js environment
process.env.NODE_ENV = "test"

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co"
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key"
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key"

// Global test setup
beforeEach(() => {
  vi.clearAllMocks()
})
