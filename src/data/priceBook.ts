// DEMO PRICE BOOK — SYNTHETIC PLACEHOLDER PRICES.
// These are NOT live market prices and NOT quotes from any retailer.
// They exist so the app can be demonstrated immediately. Replace them with your own
// supplier pricing, receipts, or (in a later phase) a price integration.

export interface PriceBookItem {
  key: string;
  name: string;
  unit: string;
  unitCost: number;
  wastePct?: number;
  category: string;
}

export const PRICE_BOOK_AS_OF = "2026-10-01";

export const PRICE_BOOK: PriceBookItem[] = [
  // Fasteners & consumables
  { key: "screws_assorted", name: "Assorted screws & fasteners", unit: "job", unitCost: 8, category: "Consumables" },
  { key: "anchors_heavy", name: "Heavy-duty wall anchors (pack)", unit: "pack", unitCost: 12, category: "Consumables" },
  { key: "toggle_bolts", name: "Toggle bolts (pack)", unit: "pack", unitCost: 9, category: "Consumables" },
  { key: "consumables", name: "Misc. consumables (tape, rags, blades)", unit: "job", unitCost: 10, category: "Consumables" },
  { key: "caulk_silicone", name: "Silicone caulk, kitchen & bath", unit: "tube", unitCost: 9, wastePct: 0.1, category: "Consumables" },
  { key: "caulk_paintable", name: "Paintable acrylic caulk", unit: "tube", unitCost: 5, wastePct: 0.1, category: "Consumables" },
  { key: "caulk_exterior", name: "Exterior sealant", unit: "tube", unitCost: 11, wastePct: 0.1, category: "Consumables" },
  { key: "construction_adhesive", name: "Construction adhesive", unit: "tube", unitCost: 7, category: "Consumables" },
  { key: "shims", name: "Wood shims (bundle)", unit: "bundle", unitCost: 5, category: "Consumables" },
  { key: "drop_cloth", name: "Plastic sheeting / drop cloth", unit: "each", unitCost: 6, category: "Consumables" },
  { key: "tile_bit", name: "Diamond/carbide tile drill bit", unit: "each", unitCost: 16, category: "Consumables" },
  { key: "wood_glue", name: "Wood glue", unit: "bottle", unitCost: 6, category: "Consumables" },
  { key: "sandpaper", name: "Sandpaper assortment", unit: "pack", unitCost: 8, category: "Consumables" },
  { key: "plumbers_tape", name: "Thread seal tape / pipe dope", unit: "each", unitCost: 4, category: "Plumbing" },
  { key: "wire_nuts", name: "Wire connectors (pack)", unit: "pack", unitCost: 6, category: "Electrical" },

  // Drywall & paint
  { key: "drywall_sheet", name: "Drywall 1/2\" 4x8 sheet", unit: "sheet", unitCost: 16, wastePct: 0.15, category: "Drywall" },
  { key: "drywall_patch_kit", name: "Drywall patch kit (small hole)", unit: "each", unitCost: 9, category: "Drywall" },
  { key: "joint_compound", name: "Joint compound, premixed", unit: "bucket", unitCost: 18, category: "Drywall" },
  { key: "drywall_tape", name: "Drywall tape", unit: "roll", unitCost: 5, category: "Drywall" },
  { key: "texture_spray", name: "Wall texture spray", unit: "can", unitCost: 15, category: "Drywall" },
  { key: "primer_gal", name: "Primer", unit: "gallon", unitCost: 28, wastePct: 0.1, category: "Paint" },
  { key: "paint_interior_gal", name: "Interior paint (mid-grade)", unit: "gallon", unitCost: 42, wastePct: 0.1, category: "Paint" },
  { key: "paint_exterior_gal", name: "Exterior paint (mid-grade)", unit: "gallon", unitCost: 52, wastePct: 0.1, category: "Paint" },
  { key: "stain_gal", name: "Exterior stain / sealer", unit: "gallon", unitCost: 45, wastePct: 0.1, category: "Paint" },
  { key: "paint_sundries", name: "Paint sundries (rollers, tape, brushes)", unit: "job", unitCost: 22, category: "Paint" },

  // Lumber & carpentry
  { key: "fence_board", name: "Fence picket, 6' pressure-treated", unit: "board", unitCost: 4.5, wastePct: 0.1, category: "Lumber" },
  { key: "fence_rail", name: "Fence rail 2x4x8 PT", unit: "each", unitCost: 9, wastePct: 0.05, category: "Lumber" },
  { key: "fence_post", name: "Fence post 4x4x8 PT", unit: "each", unitCost: 16, category: "Lumber" },
  { key: "concrete_bag", name: "Fast-setting concrete, 50 lb", unit: "bag", unitCost: 8, category: "Masonry" },
  { key: "deck_board", name: "Deck board 5/4x6x12 PT", unit: "board", unitCost: 15, wastePct: 0.1, category: "Lumber" },
  { key: "deck_screws", name: "Exterior deck screws (box)", unit: "box", unitCost: 35, category: "Consumables" },
  { key: "joist_2x8", name: "Joist 2x8x12 PT", unit: "each", unitCost: 22, category: "Lumber" },
  { key: "joist_hanger", name: "Joist hanger", unit: "each", unitCost: 3, category: "Hardware" },
  { key: "stair_tread", name: "Stair tread 2x12 PT", unit: "each", unitCost: 24, category: "Lumber" },
  { key: "trim_casing", name: "Door/window casing, primed (7')", unit: "piece", unitCost: 11, wastePct: 0.1, category: "Trim" },
  { key: "baseboard", name: "Baseboard, primed MDF (8')", unit: "piece", unitCost: 12, wastePct: 0.1, category: "Trim" },
  { key: "shelf_board", name: "Shelf board 1x12 (6')", unit: "each", unitCost: 18, category: "Lumber" },
  { key: "shelf_brackets", name: "Shelf brackets (pair)", unit: "pair", unitCost: 14, category: "Hardware" },
  { key: "plywood_sheet", name: "Plywood 3/4\" 4x8", unit: "sheet", unitCost: 55, category: "Lumber" },
  { key: "wood_filler", name: "Exterior wood filler / epoxy", unit: "each", unitCost: 14, category: "Consumables" },
  { key: "blocking_2x6", name: "2x6 blocking lumber", unit: "each", unitCost: 8, category: "Lumber" },

  // Doors & hardware
  { key: "interior_door_prehung", name: "Interior prehung door (hollow core)", unit: "each", unitCost: 145, category: "Doors" },
  { key: "interior_door_slab", name: "Interior door slab", unit: "each", unitCost: 85, category: "Doors" },
  { key: "exterior_door_prehung", name: "Exterior prehung steel door", unit: "each", unitCost: 420, category: "Doors" },
  { key: "storm_door", name: "Storm door, mid-grade", unit: "each", unitCost: 260, category: "Doors" },
  { key: "door_hinges", name: "Door hinges (set of 3)", unit: "set", unitCost: 15, category: "Hardware" },
  { key: "passage_lever", name: "Lever-style passage set", unit: "each", unitCost: 28, category: "Hardware" },
  { key: "entry_lockset", name: "Entry lockset + deadbolt", unit: "each", unitCost: 75, category: "Hardware" },
  { key: "weatherstrip_kit", name: "Door weatherstrip kit", unit: "kit", unitCost: 22, category: "Hardware" },
  { key: "door_sweep", name: "Door sweep", unit: "each", unitCost: 14, category: "Hardware" },
  { key: "threshold", name: "Threshold / transition strip", unit: "each", unitCost: 32, category: "Hardware" },
  { key: "cabinet_hinge", name: "Cabinet hinge", unit: "each", unitCost: 6, category: "Hardware" },
  { key: "cabinet_pull", name: "Cabinet pull/knob", unit: "each", unitCost: 4, category: "Hardware" },
  { key: "fence_gate_hardware", name: "Gate hinge & latch kit", unit: "kit", unitCost: 38, category: "Hardware" },

  // Bathroom / plumbing fixtures
  { key: "grab_bar_24", name: "Grab bar 24\" stainless", unit: "each", unitCost: 38, category: "Safety" },
  { key: "grab_bar_36", name: "Grab bar 36\" stainless", unit: "each", unitCost: 46, category: "Safety" },
  { key: "grab_bar_anchor", name: "Grab bar wall anchor (hollow wall)", unit: "each", unitCost: 14, category: "Safety" },
  { key: "toilet_comfort", name: "Comfort-height toilet (customer-grade)", unit: "each", unitCost: 260, category: "Plumbing" },
  { key: "wax_ring", name: "Toilet wax ring + bolts", unit: "each", unitCost: 9, category: "Plumbing" },
  { key: "supply_line", name: "Braided supply line", unit: "each", unitCost: 10, category: "Plumbing" },
  { key: "toilet_fill_valve", name: "Toilet fill valve + flapper kit", unit: "kit", unitCost: 24, category: "Plumbing" },
  { key: "faucet_bath", name: "Bathroom faucet (mid-grade)", unit: "each", unitCost: 95, category: "Plumbing" },
  { key: "faucet_kitchen", name: "Kitchen faucet (mid-grade)", unit: "each", unitCost: 165, category: "Plumbing" },
  { key: "handheld_shower", name: "Handheld shower head w/ slide bar", unit: "each", unitCost: 85, category: "Safety" },
  { key: "toilet_safety_frame", name: "Toilet safety frame / rails", unit: "each", unitCost: 55, category: "Safety" },
  { key: "garbage_disposal", name: "Garbage disposal 1/2 HP", unit: "each", unitCost: 135, category: "Plumbing" },
  { key: "anti_slip_treatment", name: "Anti-slip floor/tub treatment kit", unit: "kit", unitCost: 35, category: "Safety" },

  // Electrical-adjacent fixtures (replacement only)
  { key: "light_fixture", name: "Light fixture, standard", unit: "each", unitCost: 65, category: "Electrical" },
  { key: "ceiling_fan", name: "Ceiling fan (standard)", unit: "each", unitCost: 145, category: "Electrical" },
  { key: "motion_light", name: "LED motion-sensor light", unit: "each", unitCost: 45, category: "Electrical" },
  { key: "night_light_led", name: "Plug-in LED night lights (pack)", unit: "pack", unitCost: 18, category: "Safety" },
  { key: "smoke_co_detector", name: "Smoke/CO combination detector", unit: "each", unitCost: 48, category: "Safety" },
  { key: "fan_brace_box", name: "Fan-rated brace box", unit: "each", unitCost: 22, category: "Electrical" },

  // Mounting / misc
  { key: "tv_mount", name: "TV wall mount (customer may supply)", unit: "each", unitCost: 55, category: "Mounting" },
  { key: "cable_cover", name: "Cord-cover raceway kit", unit: "kit", unitCost: 18, category: "Mounting" },
  { key: "handrail", name: "Handrail, 8' wood w/ brackets", unit: "each", unitCost: 62, category: "Safety" },
  { key: "handrail_exterior", name: "Exterior metal handrail section", unit: "each", unitCost: 95, category: "Safety" },
  { key: "handrail_bracket", name: "Handrail bracket", unit: "each", unitCost: 7, category: "Safety" },
  { key: "ramp_kit", name: "Modular aluminum ramp section (per ft)", unit: "ft", unitCost: 85, category: "Accessibility" },
  { key: "offset_hinges", name: "Offset (swing-clear) hinges, set", unit: "set", unitCost: 42, category: "Accessibility" },
  { key: "gutter_section", name: "Gutter section 10' + hangers", unit: "each", unitCost: 24, category: "Exterior" },
  { key: "gutter_sealant", name: "Gutter sealant", unit: "tube", unitCost: 9, category: "Exterior" },
  { key: "window_screen_kit", name: "Window screen rescreen kit", unit: "each", unitCost: 18, category: "Exterior" },
  { key: "hvac_filter", name: "HVAC filter (standard)", unit: "each", unitCost: 14, category: "Maintenance" },
  { key: "dryer_vent_kit", name: "Dryer vent cleaning supplies", unit: "job", unitCost: 12, category: "Maintenance" },
  { key: "furniture_hardware", name: "Misc. assembly hardware", unit: "job", unitCost: 5, category: "Consumables" },
  { key: "mirror_hanging_kit", name: "Heavy mirror/picture hanging kit", unit: "kit", unitCost: 15, category: "Mounting" },
  { key: "closet_shelving_kit", name: "Wire closet shelving kit (6')", unit: "kit", unitCost: 75, category: "Carpentry" },
  { key: "backsplash_tile", name: "Backsplash tile", unit: "sq ft", unitCost: 9, wastePct: 0.12, category: "Tile" },
  { key: "thinset_grout", name: "Thinset + grout (small job)", unit: "job", unitCost: 38, category: "Tile" },
];

// Demo default amounts for common "other direct costs" so a quick estimate isn't missing them.
// SYNTHETIC placeholders — edit per job. Permits are intentionally 0: never assume a permit fee.
export const OTHER_COST_DEFAULTS: Record<string, number> = {
  DISPOSAL: 25,
  EQUIPMENT: 90,
  PERMIT: 0,
  PARKING: 0,
  TOLLS: 0,
  DELIVERY: 0,
  SPECIAL_ORDER: 0,
  OTHER: 0,
};
