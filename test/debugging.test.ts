import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { Changes } from "../src/changes.js"
import type { ChangeEvent } from "../src/change-event.js"

describe("Debugging and Logging", () => {
  describe("Domain naming", () => {
    it("should generate default domain name with incrementing id", () => {
      const domain1 = Changes.create()
      const domain2 = Changes.create()

      assert.match(domain1.name, /^Domain#\d+$/)
      assert.match(domain2.name, /^Domain#\d+$/)
      assert.notEqual(domain1.name, domain2.name)
    })

    it("should use provided domain name", () => {
      const domain = Changes.create({ name: "MyApp" })

      assert.equal(domain.name, "MyApp")
    })
  })

  describe("Object naming", () => {
    it("should generate default object names", () => {
      const events: ChangeEvent[] = []
      const domainWithLogger = Changes.create({ logger: (e) => events.push(e) })

      const obj = domainWithLogger.enableChanges({})
      domainWithLogger.detectChanges(() => {
        void (obj as { x?: number }).x
      }, () => {})

      const refEvent = events.find((e) => e.type === "ChangeSourceReferenced")
      assert.ok(refEvent)
      assert.match(refEvent.source, /^Object#\d+\.x$/)
    })

    it("should use provided object name", () => {
      const events: ChangeEvent[] = []
      const domain = Changes.create({ logger: (e) => events.push(e) })

      const state = domain.enableChanges({ count: 0 }, "state")
      domain.detectChanges(() => {
        void state.count
      }, () => {})

      const refEvent = events.find((e) => e.type === "ChangeSourceReferenced")
      assert.ok(refEvent)
      assert.equal(refEvent.source, "state.count")
    })

    it("should use chained naming for nested objects", () => {
      const events: ChangeEvent[] = []
      const domain = Changes.create({ logger: (e) => events.push(e) })

      const app = domain.enableChanges({ user: { name: "Alice" } }, "app")
      domain.detectChanges(() => {
        void app.user.name
      }, () => {})

      const refEvents = events.filter((e) => e.type === "ChangeSourceReferenced")
      const sources = refEvents.map((e) => e.source)

      assert.ok(sources.includes("app.user"))
      assert.ok(sources.includes("app.user.name"))
    })
  })

  describe("Array naming", () => {
    it("should use bracket notation for array elements", () => {
      const events: ChangeEvent[] = []
      const domain = Changes.create({ logger: (e) => events.push(e) })

      const items = domain.enableChanges([{ value: 1 }], "items")
      domain.detectChanges(() => {
        void items[0].value
      }, () => {})

      const refEvents = events.filter((e) => e.type === "ChangeSourceReferenced")
      const sources = refEvents.map((e) => e.source)

      // Array source should be the array name
      assert.ok(sources.includes("items"))
      // Nested object should use bracket notation
      assert.ok(sources.includes("items[0].value"))
    })
  })

  describe("Map naming", () => {
    it("should use key naming for map entries", () => {
      const events: ChangeEvent[] = []
      const domain = Changes.create({ logger: (e) => events.push(e) })

      const cache = domain.enableChanges(new Map([["foo", { data: 1 }]]), "cache")
      domain.detectChanges(() => {
        void cache.get("foo")?.data
      }, () => {})

      const refEvents = events.filter((e) => e.type === "ChangeSourceReferenced")
      const sources = refEvents.map((e) => e.source)

      assert.ok(sources.includes("cache.foo"))
      assert.ok(sources.includes("cache.<clear>"))
    })

    it("should use has naming for map has checks", () => {
      const events: ChangeEvent[] = []
      const domain = Changes.create({ logger: (e) => events.push(e) })

      const cache = domain.enableChanges(new Map<string, number>(), "cache")
      domain.detectChanges(() => {
        cache.has("bar")
      }, () => {})

      const refEvents = events.filter((e) => e.type === "ChangeSourceReferenced")
      const sources = refEvents.map((e) => e.source)

      assert.ok(sources.includes("cache.has(bar)"))
    })
  })

  describe("Set naming", () => {
    it("should use has naming for set has checks", () => {
      const events: ChangeEvent[] = []
      const domain = Changes.create({ logger: (e) => events.push(e) })

      const tags = domain.enableChanges(new Set<string>(), "tags")
      domain.detectChanges(() => {
        tags.has("urgent")
      }, () => {})

      const refEvents = events.filter((e) => e.type === "ChangeSourceReferenced")
      const sources = refEvents.map((e) => e.source)

      assert.ok(sources.includes("tags.has(urgent)"))
    })

    it("should use size naming for set size", () => {
      const events: ChangeEvent[] = []
      const domain = Changes.create({ logger: (e) => events.push(e) })

      const tags = domain.enableChanges(new Set<string>(), "tags")
      domain.detectChanges(() => {
        void tags.size
      }, () => {})

      const refEvents = events.filter((e) => e.type === "ChangeSourceReferenced")
      const sources = refEvents.map((e) => e.source)

      assert.ok(sources.includes("tags.<size>"))
    })
  })

  describe("DetectChanges naming", () => {
    it("should generate default detectChanges name", () => {
      const events: ChangeEvent[] = []
      const domain = Changes.create({ logger: (e) => events.push(e) })

      const state = domain.enableChanges({ x: 0 })
      domain.detectChanges(() => { void state.x }, () => {})

      const enterEvent = events.find((e) => e.type === "DetectChangesEntered")
      assert.ok(enterEvent)
      assert.match(enterEvent.detectChanges, /^DetectChanges#\d+$/)
    })

    it("should use provided detectChanges name", () => {
      const events: ChangeEvent[] = []
      const domain = Changes.create({ logger: (e) => events.push(e) })

      const state = domain.enableChanges({ x: 0 })
      domain.detectChanges(() => { void state.x }, () => {}, "MyWatcher")

      const enterEvent = events.find((e) => e.type === "DetectChangesEntered")
      assert.ok(enterEvent)
      assert.match(enterEvent.detectChanges, /^MyWatcher#\d+$/)
    })
  })

  describe("CachedFunction naming", () => {
    it("should generate default cachedFunction name", () => {
      const events: ChangeEvent[] = []
      const domain = Changes.create({ logger: (e) => events.push(e) })

      const state = domain.enableChanges({ x: 1 })
      const cf = domain.createCachedFunction(() => state.x * 2)

      // Call the cached function inside detectChanges to trigger ChangeSourceReferenced
      domain.detectChanges(() => {
        cf.call()
      }, () => {})

      const refEvents = events.filter((e) => e.type === "ChangeSourceReferenced")
      const cfSource = refEvents.find((e) => e.source.startsWith("CachedFunction#"))
      assert.ok(cfSource)
    })

    it("should use provided cachedFunction name", () => {
      const events: ChangeEvent[] = []
      const domain = Changes.create({ logger: (e) => events.push(e) })

      const state = domain.enableChanges({ x: 1 })
      const total = domain.createCachedFunction(() => state.x * 2, "total")

      domain.detectChanges(() => {
        total.call()
      }, () => {})

      const refEvents = events.filter((e) => e.type === "ChangeSourceReferenced")
      const cfSource = refEvents.find((e) => e.source === "total")
      assert.ok(cfSource)
    })
  })

  describe("Transaction events", () => {
    it("should emit TransactionStarted and TransactionEnded", () => {
      const events: ChangeEvent[] = []
      const domain = Changes.create({ logger: (e) => events.push(e) })

      const state = domain.enableChanges({ x: 0 })
      state.x = 1

      const startEvent = events.find((e) => e.type === "TransactionStarted")
      const endEvent = events.find((e) => e.type === "TransactionEnded")

      assert.ok(startEvent)
      assert.ok(endEvent)
      assert.equal(startEvent.transaction, endEvent.transaction)
      assert.equal(startEvent.domain, domain.name)
    })

    it("should increment transaction ids", () => {
      const events: ChangeEvent[] = []
      const domain = Changes.create({ logger: (e) => events.push(e) })

      const state = domain.enableChanges({ x: 0 })
      state.x = 1
      state.x = 2

      const startEvents = events.filter((e) => e.type === "TransactionStarted")
      assert.equal(startEvents.length, 2)
      assert.equal(startEvents[0].transaction, 1)
      assert.equal(startEvents[1].transaction, 2)
    })
  })

  describe("Change notification events", () => {
    it("should emit BeforeChangeNotified and AfterChangeNotified", () => {
      const events: ChangeEvent[] = []
      const domain = Changes.create({ logger: (e) => events.push(e) })

      const state = domain.enableChanges({ x: 0 }, "state")
      domain.detectChanges(() => { void state.x }, () => {})

      // Clear events from detectChanges setup
      events.length = 0

      state.x = 1

      const beforeEvent = events.find((e) => e.type === "BeforeChangeNotified")
      const afterEvent = events.find((e) => e.type === "AfterChangeNotified")

      assert.ok(beforeEvent)
      assert.ok(afterEvent)
      assert.equal(beforeEvent.source, "state.x")
      assert.equal(afterEvent.source, "state.x")
    })
  })

  describe("DetectChanges suspend/resume events", () => {
    it("should emit suspend and resume for nested detectChanges", () => {
      const events: ChangeEvent[] = []
      const domain = Changes.create({ logger: (e) => events.push(e) })

      const state = domain.enableChanges({ x: 0, y: 0 })

      domain.detectChanges(
        () => {
          void state.x
          domain.detectChanges(
            () => { void state.y },
            () => {},
            "Inner",
          )
        },
        () => {},
        "Outer",
      )

      const suspendEvent = events.find((e) => e.type === "DetectChangesSuspended")
      const resumeEvent = events.find((e) => e.type === "DetectChangesResumed")

      assert.ok(suspendEvent)
      assert.ok(resumeEvent)
      assert.match(suspendEvent.detectChanges, /^Outer#\d+$/)
      assert.match(resumeEvent.detectChanges, /^Outer#\d+$/)
    })
  })

  describe("Zero overhead without logger", () => {
    it("should work without logger", () => {
      const domain = Changes.create()
      assert.equal(domain.logger, null)

      const state = domain.enableChanges({ x: 0 })
      let notified = false
      domain.detectChanges(
        () => { void state.x },
        () => { notified = true },
      )

      state.x = 1
      assert.equal(notified, true)
    })
  })
})
