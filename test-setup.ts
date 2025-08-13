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

// Mock fetch globally
global.fetch = vi.fn()

// Mock Request constructor
global.Request = vi.fn().mockImplementation((url, options) => ({
  url,
  method: options?.method || "GET",
  headers: options?.headers || {},
  body: options?.body,
  json: () => Promise.resolve(JSON.parse(options?.body || "{}")),
}))

// Mock Response constructor
global.Response = vi.fn().mockImplementation((body, options) => ({
  ok: !options?.status || options.status < 400,
  status: options?.status || 200,
  json: () => Promise.resolve(typeof body === "string" ? JSON.parse(body) : body),
}))
