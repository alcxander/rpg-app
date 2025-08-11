import { type NextRequest, NextResponse } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"
import { generateShopkeeperImage } from "@/lib/token-image"

const ENEMY_FALLBACKS = [
  "/tokens/enemies/1.png",
  "/tokens/enemies/2.png",
  "/tokens/enemies/3.png",
  "/tokens/enemies/4.png",
  "/tokens/enemies/5.png",
]

const SHOP_TYPES = [
  "blacksmith",
  "general",
  "apothecary",
  "fletcher",
  "enchanter",
  "tavern",
  "bakery",
  "jeweler",
  "tailor",
  "weaponsmith",
  "armorsmith",
  "alchemist",
  "bookstore",
  "inn",
  "stable",
  "temple",
  "magic shop",
  "curiosities",
  "herbalist",
  "leatherworker",
  "carpenter",
  "mason",
  "tinker",
  "scribe",
  "cartographer",
  "fishmonger",
  "butcher",
  "grocer",
  "florist",
  "clockmaker",
] as const

const RACES = ["Human", "Elf", "Dwarf", "Halfling", "Tiefling", "Gnome"] as const
const ALIGNMENTS = ["LG", "NG", "CG", "LN", "N", "CN", "LE", "NE", "CE"] as const

function rid() {
  return Math.random().toString(36).slice(2, 8)
}

function rand<T>(arr: readonly T[]) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomName() {
  const first = ["Arin", "Borin", "Celia", "Doran", "Elia", "Fenn", "Garen", "Hilda", "Ilya", "Jora", "Kelm", "Lysa"]
  const last = ["Vale", "Rook", "Storm", "Stone", "Grove", "Thorn", "Reed", "Keen", "Forge", "Drift"]
  return `${rand(first)} ${rand(last)}`
}

function randomQuote() {
  const quotes = [
    "Quality you can trust.",
    "No hagglin', only fair deals.",
    "Fresh from the forge.",
    "Bring coin, leave happy.",
  ]
  return rand(quotes)
}

function randomItems(count: number) {
  const pool = [
    { item_name: "Iron Sword", rarity: "common", base_price: 15 },
    { item_name: "Health Potion", rarity: "common", base_price: 50 },
    { item_name: "Steel Shield", rarity: "uncommon", base_price: 120 },
    { item_name: "Elixir of Vigor", rarity: "rare", base_price: 450 },
    { item_name: "Enchanted Dagger", rarity: "rare", base_price: 600 },
    { item_name: "Arrows (20)", rarity: "common", base_price: 25 },
    { item_name: "Leather Armor", rarity: "common", base_price: 100 },
    { item_name: "Antidote", rarity: "uncommon", base_price: 80 },
  ]
  const items = []
  for (let i = 0; i < count; i++) {
    const base = rand(pool)
    const adj = Math.floor(Math.random() * 21) - 10 // -10..+10%
    const final = Math.max(1, Math.round(base.base_price * (1 + adj / 100)))
    items.push({
      item_name: base.item_name,
      rarity: base.rarity,
      base_price: base.base_price,
      price_adjustment_percent: adj,
      final_price: final,
      stock_quantity: Math.floor(Math.random() * 5) + 1,
    })
  }
  return items
}

export async function POST(req: NextRequest) {
  const reqId = rid()
  const t0 = Date.now()
  try {
    const { userId, sessionId } = getAuth(req)
    console.log("[api/shopkeepers.generate] start", { reqId, hasUser: !!userId, sessionId })
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { campaignId, count } = await req.json().catch(() => ({ campaignId: "", count: 0 }))
    const safeCount = Math.max(1, Math.min(20, Number(count) || 0))
    if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 })

    const supabase = createAdminClient()

    // Validate campaign and ownership
    const { data: camp, error: campErr } = await supabase
      .from("campaigns")
      .select("id,owner_id,access_enabled")
      .eq("id", campaignId)
      .single()
    if (campErr || !camp) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (camp.owner_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    // Count current active shopkeepers
    const { count: activeCount, error: cntErr } = await supabase
      .from("shopkeepers")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .or("removed.is.null,removed.eq.false")

    if (cntErr) {
      console.error("[api/shopkeepers.generate] count error", { reqId, error: cntErr.message })
      return NextResponse.json({ error: cntErr.message }, { status: 500 })
    }

    const missing = Math.max(0, safeCount - (activeCount ?? 0))
    console.log("[api/shopkeepers.generate] plan", {
      reqId,
      requested: safeCount,
      activeBefore: activeCount ?? 0,
      missing,
    })
    if (missing === 0) {
      return NextResponse.json({
        requested: safeCount,
        activeBefore: activeCount ?? 0,
        createdCount: 0,
        createdIds: [],
      })
    }

    const createdIds: string[] = []
    for (let i = 0; i < missing; i++) {
      const name = randomName()
      const shop_type = rand(SHOP_TYPES)
      const race = rand(RACES)
      const alignment = rand(ALIGNMENTS)
      const age = Math.floor(Math.random() * 40) + 18
      const quote = randomQuote()
      const description = `A ${race.toLowerCase()} ${shop_type} known for ${quote.toLowerCase()}`

      // Image prompt and generation (Stability)
      const image_prompt = `Fantasy portrait, ${name}, ${race} ${shop_type} shopkeeper, soft lighting, painterly`
      const { imageUrl, provider } = await generateShopkeeperImage(image_prompt).catch((e) => {
        console.warn("[api/shopkeepers.generate] image error", { reqId, idx: i, message: e?.message })
        return { imageUrl: null as string | null, provider: "fallback" }
      })

      // Insert shopkeeper
      const { data: sk, error: skErr } = await supabase
        .from("shopkeepers")
        .insert({
          campaign_id: campaignId,
          name,
          race,
          age,
          alignment,
          quote,
          description,
          shop_type,
          image_url: imageUrl, // may be null
          removed: false,
        })
        .select("id")
        .single()
      if (skErr || !sk?.id) {
        console.error("[api/shopkeepers.generate] shop insert error", { reqId, idx: i, error: skErr?.message || null })
        continue
      }

      const items = randomItems(Math.floor(Math.random() * 4) + 5) // 5-8 items
      const payload = items.map((it) => ({ ...it, shopkeeper_id: sk.id }))
      const { error: invErr } = await supabase.from("shopkeeper_inventory").insert(payload)
      if (invErr) {
        console.error("[api/shopkeepers.generate] inventory error", { reqId, idx: i, error: invErr.message })
      }

      createdIds.push(sk.id)
      console.log("[api/shopkeepers.generate] created", { reqId, idx: i, skId: sk.id, provider })
    }

    console.log("[api/shopkeepers.generate] done", {
      reqId,
      requested: safeCount,
      activeBefore: activeCount ?? 0,
      createdCount: createdIds.length,
      ms: Date.now() - t0,
    })

    return NextResponse.json({
      requested: safeCount,
      activeBefore: activeCount ?? 0,
      createdCount: createdIds.length,
      createdIds,
    })
  } catch (e: any) {
    console.error("[api/shopkeepers.generate] exception", { reqId, message: e?.message })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
