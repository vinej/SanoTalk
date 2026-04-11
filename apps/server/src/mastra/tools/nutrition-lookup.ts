import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const FETCH_TIMEOUT = 10_000; // 10 seconds

function fetchWithTimeout(url: string, timeoutMs = FETCH_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

// ── Tool 1: lookupNutrition ───────────────────────────────────────────────
// Searches the USDA FoodData Central database for nutritional composition
// of a food item. Returns key nutrients per 100g serving.
// Uses the free DEMO_KEY (rate-limited to 30 req/hour) or a real key if set.

const USDA_API_KEY = process.env.USDA_API_KEY ?? "DEMO_KEY";

// Nutrients we care about for senior health / condition-based advice
const NUTRIENT_IDS: Record<number, string> = {
  1008: "calories_kcal",
  1003: "protein_g",
  1004: "total_fat_g",
  1005: "carbohydrates_g",
  1079: "fiber_g",
  2000: "sugars_g",
  1087: "calcium_mg",
  1089: "iron_mg",
  1090: "magnesium_mg",
  1091: "phosphorus_mg",
  1092: "potassium_mg",
  1093: "sodium_mg",
  1095: "zinc_mg",
  1106: "vitamin_A_mcg",
  1162: "vitamin_C_mg",
  1114: "vitamin_D_mcg",
  1109: "vitamin_E_mg",
  1183: "vitamin_K_mcg",
  1170: "vitamin_B6_mg",
  1178: "vitamin_B12_mcg",
  1177: "folate_mcg",
  1253: "cholesterol_mg",
  1258: "saturated_fat_g",
  1292: "monounsaturated_fat_g",
  1293: "polyunsaturated_fat_g",
};

export const lookupNutrition = createTool({
  id: "lookupNutrition",
  description:
    "Look up the nutritional composition of a food item using the USDA FoodData Central database. " +
    "Returns key nutrients per 100g serving including calories, protein, sodium, potassium, calcium, fiber, vitamins, etc. " +
    "Use this when a patient asks about the nutritional content of a specific food, or when you need exact nutrient values " +
    "to assess whether a food is appropriate for their condition (e.g., sodium content for hypertension, potassium for CKD, vitamin K for warfarin).",
  inputSchema: z.object({
    query: z.string().describe("The food item to look up (e.g., 'banana', 'chicken breast', 'canned tuna', 'white rice')"),
  }),
  execute: async ({ query }) => {
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${USDA_API_KEY}&query=${encodeURIComponent(query)}&pageSize=3&dataType=SR%20Legacy,Foundation`;

    let res: Response;
    try {
      res = await fetchWithTimeout(url);
    } catch {
      return { found: false, query, message: "Failed to reach USDA FoodData Central API." };
    }

    if (!res.ok) {
      return { found: false, query, message: `USDA API returned status ${res.status}.` };
    }

    const data = await res.json() as any;
    const foods = data?.foods;
    if (!Array.isArray(foods) || foods.length === 0) {
      return { found: false, query, message: `No food found for "${query}" in USDA database.` };
    }

    // Take the best match (first result from SR Legacy or Foundation)
    const food = foods[0];
    const nutrients: Record<string, number> = {};

    if (Array.isArray(food.foodNutrients)) {
      for (const n of food.foodNutrients) {
        const key = NUTRIENT_IDS[n.nutrientId as number];
        if (key && typeof n.value === "number") {
          nutrients[key] = Math.round(n.value * 100) / 100;
        }
      }
    }

    return {
      found: true,
      foodName: food.description ?? query,
      category: food.foodCategory ?? null,
      servingBasis: "per 100g",
      nutrients,
    };
  },
});

// ── Tool 2: searchRecipes ─────────────────────────────────────────────────
// Searches TheMealDB (free, no API key needed) for recipe suggestions.
// Returns meal names, categories, and instructions.

export const searchRecipes = createTool({
  id: "searchRecipes",
  description:
    "Search for recipe ideas by ingredient or meal name using a free recipe database. " +
    "Use this when a patient asks for meal suggestions, recipes, or what to cook with certain ingredients. " +
    "Returns recipe names, categories, and basic instructions.",
  inputSchema: z.object({
    query: z.string().describe("A food ingredient or meal name to search for (e.g., 'salmon', 'chicken', 'lentil')"),
  }),
  execute: async ({ query }) => {
    // Try searching by ingredient first (more results)
    const url = `https://www.themealdb.com/api/json/v1/1/filter.php?i=${encodeURIComponent(query)}`;

    let res: Response;
    try {
      res = await fetchWithTimeout(url);
    } catch {
      return { found: false, query, message: "Failed to reach recipe database." };
    }

    if (!res.ok) {
      return { found: false, query, message: `Recipe API returned status ${res.status}.` };
    }

    const data = await res.json() as any;
    const meals = data?.meals;

    if (!Array.isArray(meals) || meals.length === 0) {
      // Fallback: search by meal name
      const nameUrl = `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(query)}`;
      try {
        const nameRes = await fetchWithTimeout(nameUrl);
        if (nameRes.ok) {
          const nameData = await nameRes.json() as any;
          if (Array.isArray(nameData?.meals) && nameData.meals.length > 0) {
            return {
              found: true,
              query,
              recipes: nameData.meals.slice(0, 5).map((m: any) => ({
                name: m.strMeal,
                category: m.strCategory,
                area: m.strArea,
                instructions: m.strInstructions?.slice(0, 500) ?? null,
              })),
            };
          }
        }
      } catch { /* fall through */ }
      return { found: false, query, message: `No recipes found for "${query}".` };
    }

    // For ingredient search, we get names but need to fetch details for up to 3
    const topMeals = meals.slice(0, 3);
    const recipes = [];

    for (const meal of topMeals) {
      try {
        const detailUrl = `https://www.themealdb.com/api/json/v1/1/lookup.php?i=${meal.idMeal}`;
        const detailRes = await fetchWithTimeout(detailUrl);
        if (detailRes.ok) {
          const detailData = await detailRes.json() as any;
          const m = detailData?.meals?.[0];
          if (m) {
            recipes.push({
              name: m.strMeal,
              category: m.strCategory,
              area: m.strArea,
              instructions: m.strInstructions?.slice(0, 500) ?? null,
            });
          }
        }
      } catch { /* skip this recipe */ }
    }

    return {
      found: recipes.length > 0,
      query,
      recipes,
    };
  },
});
