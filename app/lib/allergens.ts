// Leitet Allergene automatisch aus den Zutaten einer Mahlzeit ab.
// Schluessel = normalisierter Zutatenname (klein, ohne Klammer-Zusatz wie "(gekocht)").
// Werte = Allergen-Schluessel wie im Onboarding (ALLERGIES). So bleibt das Filtern korrekt,
// ohne jedes der 120 Rezepte einzeln von Hand taggen zu muessen.
export const INGREDIENT_ALLERGENS: Record<string, string[]> = {
  // Getreide / Gluten (Weizen-basiert zusaetzlich 'wheat', Hefe-Gebaeck 'yeast')
  'haferflocken': ['gluten'],
  'müsli': ['gluten'],
  'granola': ['gluten', 'tree_nuts'],
  'vollkorntoast': ['gluten', 'wheat', 'yeast'],
  'vollkornbrot': ['gluten', 'wheat', 'yeast'],
  'vollkornbrötchen': ['gluten', 'wheat', 'yeast'],
  'croissant': ['gluten', 'wheat', 'yeast', 'milk', 'lactose'],
  'hartweizengrieß': ['gluten', 'wheat'],
  'vollkornnudeln': ['gluten', 'wheat'],
  'nudeln': ['gluten', 'wheat'],
  'spaghetti': ['gluten', 'wheat'],
  'couscous': ['gluten', 'wheat'],
  'lasagneplatten': ['gluten', 'wheat'],
  'paniermehl': ['gluten', 'wheat'],
  'mehl': ['gluten', 'wheat'],
  'tortilla': ['gluten', 'wheat'],
  'pita': ['gluten', 'wheat', 'yeast'],
  'waffeln': ['gluten', 'wheat', 'eggs', 'milk', 'lactose'],
  'croutons': ['gluten', 'wheat'],
  'vollkorncracker': ['gluten', 'wheat'],
  // Milch / Laktose
  'milch': ['milk', 'lactose'],
  'butter': ['milk', 'lactose'],
  'skyr': ['milk', 'lactose'],
  'joghurt': ['milk', 'lactose'],
  'naturjoghurt': ['milk', 'lactose'],
  'magerquark': ['milk', 'lactose'],
  'gouda': ['milk', 'lactose'],
  'parmesan': ['milk', 'lactose'],
  'käse': ['milk', 'lactose'],
  'sahne': ['milk', 'lactose'],
  'hüttenkäse': ['milk', 'lactose'],
  'feta': ['milk', 'lactose'],
  'mozzarella': ['milk', 'lactose'],
  'frischkäse': ['milk', 'lactose'],
  'béchamel': ['milk', 'lactose', 'gluten', 'wheat'],
  'tzatziki': ['milk', 'lactose'],
  'joghurt-soße': ['milk', 'lactose'],
  'proteinpulver': ['milk', 'lactose'],
  'proteinriegel': ['milk', 'lactose', 'soy'],
  // Soja
  'tofu': ['soy'],
  'räuchertofu': ['soy'],
  'soja-joghurt': ['soy'],
  'sojasoße': ['soy', 'gluten', 'wheat'],
  'edamame': ['soy', 'legumes'],
  // Eier
  'ei': ['eggs'],
  'eier': ['eggs'],
  'mayonnaise': ['eggs'],
  'caesar-dressing': ['eggs', 'fish'],
  // Fisch / Krebstiere
  'lachs': ['fish'],
  'räucherlachs': ['fish'],
  'thunfisch': ['fish'],
  'matjes': ['fish'],
  'garnelen': ['crustaceans'],
  // Nuesse (allgemein 'tree_nuts' + spezifisch)
  'mandeln': ['tree_nuts', 'almond'],
  'mandelmus': ['tree_nuts', 'almond'],
  'walnüsse': ['tree_nuts', 'walnut'],
  'studentenfutter': ['tree_nuts', 'peanuts'],
  'pesto': ['tree_nuts', 'milk', 'lactose'],
  // Erdnuss
  'erdnussbutter': ['peanuts'],
  'erdnüsse': ['peanuts'],
  // Sesam
  'sesam': ['sesame'],
  'hummus': ['sesame', 'legumes'],
  'tahini': ['sesame'],
  'falafel': ['legumes', 'sesame'],
  // Huelsenfruechte
  'linsen': ['legumes'],
  'kichererbsen': ['legumes'],
  'kidneybohnen': ['legumes'],
  'weiße bohnen': ['legumes'],
  'erbsen': ['legumes'],
  // Kokos
  'kokosmilch': ['coconut'],
  // Nachtschatten (Tomate, Paprika, Kartoffel, Aubergine)
  'tomate': ['nightshades'],
  'tomaten': ['nightshades'],
  'tomatensoße': ['nightshades'],
  'tomatensuppe': ['nightshades'],
  'kirschtomaten': ['nightshades'],
  'paprika': ['nightshades'],
  'kartoffeln': ['nightshades'],
  'aubergine': ['nightshades'],
  // Zitrus / Obst
  'orange': ['citrus'],
  'banane': ['banana'],
  'apfel': ['apple'],
  'erdbeeren': ['strawberry'],
  // Allium / Mais / Kakao
  'zwiebel': ['onion'],
  'mais': ['corn'],
  'kakao': ['cocoa'],
};

// "Reis (gekocht)" -> "reis", "Eier (ca. 3)" -> "eier"
function normIngredient(name: string): string {
  return name.toLowerCase().replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
}

export function allergensForIngredients(ingredients: { name: string }[]): string[] {
  const out = new Set<string>();
  for (const ing of ingredients) {
    const tags = INGREDIENT_ALLERGENS[normIngredient(ing.name)];
    if (tags) tags.forEach((t) => out.add(t));
  }
  return [...out];
}
