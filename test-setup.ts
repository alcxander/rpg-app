import { vi } from "vitest"

// Mock Next.js environment
process.env.NODE_ENV = "test"

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321"
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key"
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key"
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "test-clerk-key"
process.env.CLERK_SECRET_KEY = "test-clerk-secret"

// Global test utilities
global.fetch = vi.fn()

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}
