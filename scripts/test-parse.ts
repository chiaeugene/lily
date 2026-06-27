// Offline test round for the deterministic matcher + heuristic parser.
// Run: npx tsx scripts/test-parse.ts
import { SEED_PRODUCTS } from "../lib/catalog";
import { matchProduct } from "../lib/productMatch";

let pass = 0, fail = 0;
function check(label: string, got: string | null, expectId: string | null) {
  const ok = got === expectId;
  console.log(`  ${ok ? "✓" : "✗"} ${label.padEnd(46)} -> ${got ?? "(no match)"}${ok ? "" : `   EXPECTED ${expectId}`}`);
  ok ? pass++ : fail++;
}

console.log("── matchProduct: shorthand → SKU ──");
const m = (q: string) => matchProduct(q, SEED_PRODUCTS)?.product.id ?? null;
check("5740",                         m("5740"),                         "th-57x40");
check("57x40 thermal",               m("57x40 thermal"),                "th-57x40");
check("57 x 60",                     m("57 x 60"),                      "th-57x60");
check("thermal 80x80",               m("thermal 80x80"),                "th-80x80");
check("80 thermal roll",             m("80 thermal roll"),              "th-80x80"); // only-80 → first 80; fine
check("coreless 57",                 m("coreless 57x38x12"),            "coreless-57-38-12");
check("cordless 57x38",              m("cordless 57 x 38"),             "coreless-57-38-12");
check("cocktail 2ply 23x23",         m("cocktail 2ply 23x23"),          "nap-cocktail-2ply");
check("cocktail 1 ply",              m("cocktail 1 ply"),               "nap-cocktail-1ply");
check("luncheon napkin 2ply",        m("lucheon napkin 2ply"),          "nap-luncheon-2ply");
check("dinner napkin 1ply",          m("dinner napkin 1ply"),           "nap-dinner-1ply");
check("jrt 2ply",                    m("jrt 2ply"),                     "jrt-2ply");
check("serviette 80g",               m("serviette 80g"),                "serviette-80g");
check("76 2ply carbonless",          m("76x65 2ply carbonless"),        "cr-76x65-2ply");
check("76 woodfree 1ply",            m("76x65 woodfree 1ply"),          "cr-76x65-1ply");
check("48gsm 225mm jumbo",           m("thermal 48gsm 225mm"),          "tp-48-225");
check("printed thermal",             m("printed thermal roll"),         "th-printed");
check("45x85 roll",                  m("paper roll 45x85"),             "roll-45x85");
check("gibberish",                   m("hello there"),                  null);

console.log(`\n${fail === 0 ? "ALL PASS ✅" : `${fail} FAILED ❌`}  (${pass}/${pass + fail})`);
if (fail) process.exit(1);
