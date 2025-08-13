import { vi } from "vitest"

// Mock global Request and Response
global.Request = class MockRequest {
  constructor(
    public url: string,
    public init?: RequestInit,
  ) {}
  json() {
    return Promise.resolve({})
  }
  text() {
    return Promise.resolve("")
  }
} as any

global.Response = class MockResponse {
  constructor(
    public body?: any,
    public init?: ResponseInit,
  ) {}
  json() {
    return Promise.resolve(this.body)
  }
  text() {
    return Promise.resolve(String(this.body))
  }
  get ok() {
    return (this.init?.status || 200) < 400
  }
  get status() {
    return this.init?.status || 200
  }
} as any

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
}
