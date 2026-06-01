// Mahlzeiten-Bibliothek + Generator für den Tages-Ernährungsplan.
// Reine Logik (kein UI/DB). Allergen-Tags nutzen dieselben Schlüssel wie das Onboarding.

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type Ingredient = { name: string; g: number };

export type MealTemplate = {
  name: string;
  type: MealType;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  allergens: string[];
  ingredients: Ingredient[]; // Mengen fuer 1 Standardportion (portion = 1)
};

export type PlannedMeal = {
  type: MealType;
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  portion: number; // Portionsfaktor (1 = Standardportion)
};

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Frühstück',
  lunch: 'Mittagessen',
  dinner: 'Abendessen',
  snack: 'Snack',
};

// Kalorien-Verteilung über den Tag
const SHARE: Record<MealType, number> = { breakfast: 0.25, lunch: 0.35, dinner: 0.3, snack: 0.1 };
const ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

const MEALS: MealTemplate[] = [
  // Frühstück
  { name: 'Haferflocken mit Banane & Beeren', type: 'breakfast', kcal: 420, protein: 14, carbs: 72, fat: 8, allergens: ['gluten'],
    ingredients: [{ name: 'Haferflocken', g: 60 }, { name: 'Banane', g: 100 }, { name: 'Beeren', g: 80 }, { name: 'Milch', g: 200 }] },
  { name: 'Rührei mit Vollkorntoast', type: 'breakfast', kcal: 380, protein: 24, carbs: 30, fat: 18, allergens: ['eggs', 'gluten'],
    ingredients: [{ name: 'Eier (ca. 3)', g: 150 }, { name: 'Vollkorntoast', g: 60 }, { name: 'Butter', g: 5 }] },
  { name: 'Skyr mit Honig & Nüssen', type: 'breakfast', kcal: 350, protein: 28, carbs: 30, fat: 12, allergens: ['milk', 'lactose', 'tree_nuts'],
    ingredients: [{ name: 'Skyr', g: 250 }, { name: 'Honig', g: 15 }, { name: 'Mandeln', g: 25 }] },
  { name: 'Smoothie-Bowl mit Soja-Joghurt', type: 'breakfast', kcal: 360, protein: 12, carbs: 60, fat: 8, allergens: ['soy'],
    ingredients: [{ name: 'Soja-Joghurt', g: 200 }, { name: 'Banane', g: 100 }, { name: 'Beeren', g: 80 }, { name: 'Haferflocken', g: 30 }] },
  { name: 'Reiswaffeln mit Erdnussbutter & Banane', type: 'breakfast', kcal: 400, protein: 14, carbs: 55, fat: 16, allergens: ['peanuts'],
    ingredients: [{ name: 'Reiswaffeln', g: 30 }, { name: 'Erdnussbutter', g: 30 }, { name: 'Banane', g: 100 }] },
  { name: 'Frischer Obstsalat', type: 'breakfast', kcal: 260, protein: 4, carbs: 55, fat: 2, allergens: [],
    ingredients: [{ name: 'Apfel', g: 120 }, { name: 'Banane', g: 100 }, { name: 'Orange', g: 130 }, { name: 'Beeren', g: 80 }] },
  // Mittagessen
  { name: 'Hähnchen mit Reis & Gemüse', type: 'lunch', kcal: 550, protein: 45, carbs: 60, fat: 12, allergens: [],
    ingredients: [{ name: 'Hähnchenbrust', g: 150 }, { name: 'Reis (gekocht)', g: 200 }, { name: 'Gemüse', g: 150 }] },
  { name: 'Lachs mit Kartoffeln & Brokkoli', type: 'lunch', kcal: 600, protein: 40, carbs: 45, fat: 25, allergens: ['fish'],
    ingredients: [{ name: 'Lachs', g: 150 }, { name: 'Kartoffeln', g: 250 }, { name: 'Brokkoli', g: 150 }] },
  { name: 'Vollkornnudeln mit Tomatensoße', type: 'lunch', kcal: 520, protein: 18, carbs: 90, fat: 10, allergens: ['gluten'],
    ingredients: [{ name: 'Vollkornnudeln (gekocht)', g: 250 }, { name: 'Tomatensoße', g: 150 }, { name: 'Parmesan', g: 15 }] },
  { name: 'Linsen-Curry mit Reis', type: 'lunch', kcal: 500, protein: 22, carbs: 80, fat: 10, allergens: ['legumes'],
    ingredients: [{ name: 'Linsen (gekocht)', g: 200 }, { name: 'Reis (gekocht)', g: 150 }, { name: 'Kokosmilch', g: 50 }, { name: 'Gemüse', g: 100 }] },
  { name: 'Rindfleisch-Wrap', type: 'lunch', kcal: 580, protein: 35, carbs: 50, fat: 22, allergens: ['gluten'],
    ingredients: [{ name: 'Rindfleisch', g: 120 }, { name: 'Tortilla', g: 80 }, { name: 'Gemüse', g: 100 }, { name: 'Joghurt-Soße', g: 30 }] },
  { name: 'Quinoa-Bowl mit Gemüse', type: 'lunch', kcal: 520, protein: 18, carbs: 78, fat: 14, allergens: [],
    ingredients: [{ name: 'Quinoa (gekocht)', g: 200 }, { name: 'Gemüse', g: 200 }, { name: 'Kichererbsen', g: 80 }, { name: 'Olivenöl', g: 10 }] },
  // Abendessen
  { name: 'Pute mit Süßkartoffel & Salat', type: 'dinner', kcal: 500, protein: 42, carbs: 45, fat: 14, allergens: [],
    ingredients: [{ name: 'Putenbrust', g: 150 }, { name: 'Süßkartoffel', g: 200 }, { name: 'Salat', g: 100 }] },
  { name: 'Tofu-Pfanne mit Reis', type: 'dinner', kcal: 480, protein: 28, carbs: 60, fat: 14, allergens: ['soy'],
    ingredients: [{ name: 'Tofu', g: 150 }, { name: 'Reis (gekocht)', g: 180 }, { name: 'Gemüse', g: 150 }, { name: 'Sojasoße', g: 10 }] },
  { name: 'Omelett mit Gemüse & Salat', type: 'dinner', kcal: 420, protein: 30, carbs: 12, fat: 26, allergens: ['eggs'],
    ingredients: [{ name: 'Eier (ca. 3)', g: 150 }, { name: 'Gemüse', g: 120 }, { name: 'Salat', g: 80 }, { name: 'Öl', g: 5 }] },
  { name: 'Garnelen mit Zucchininudeln', type: 'dinner', kcal: 380, protein: 35, carbs: 18, fat: 16, allergens: ['crustaceans'],
    ingredients: [{ name: 'Garnelen', g: 150 }, { name: 'Zucchini', g: 250 }, { name: 'Olivenöl', g: 10 }] },
  { name: 'Hähnchensalat mit Avocado', type: 'dinner', kcal: 450, protein: 38, carbs: 18, fat: 26, allergens: [],
    ingredients: [{ name: 'Hähnchenbrust', g: 120 }, { name: 'Avocado', g: 80 }, { name: 'Salat', g: 120 }, { name: 'Olivenöl', g: 10 }] },
  { name: 'Gemüsepfanne mit Reis', type: 'dinner', kcal: 400, protein: 10, carbs: 70, fat: 9, allergens: [],
    ingredients: [{ name: 'Reis (gekocht)', g: 180 }, { name: 'Gemüse', g: 250 }, { name: 'Olivenöl', g: 10 }] },
  // Snack
  { name: 'Apfel & eine Handvoll Mandeln', type: 'snack', kcal: 220, protein: 6, carbs: 25, fat: 12, allergens: ['tree_nuts'],
    ingredients: [{ name: 'Apfel', g: 150 }, { name: 'Mandeln', g: 25 }] },
  { name: 'Magerquark mit Beeren', type: 'snack', kcal: 180, protein: 25, carbs: 15, fat: 2, allergens: ['milk', 'lactose'],
    ingredients: [{ name: 'Magerquark', g: 200 }, { name: 'Beeren', g: 80 }] },
  { name: 'Reiswaffeln mit Hummus', type: 'snack', kcal: 200, protein: 6, carbs: 30, fat: 6, allergens: ['legumes'],
    ingredients: [{ name: 'Reiswaffeln', g: 20 }, { name: 'Hummus', g: 60 }] },
  { name: 'Banane & Reiscracker', type: 'snack', kcal: 200, protein: 3, carbs: 45, fat: 2, allergens: [],
    ingredients: [{ name: 'Banane', g: 120 }, { name: 'Reiscracker', g: 25 }] },
  { name: 'Gemüsesticks mit Guacamole', type: 'snack', kcal: 180, protein: 3, carbs: 18, fat: 12, allergens: [],
    ingredients: [{ name: 'Gemüsesticks', g: 150 }, { name: 'Guacamole', g: 60 }] },

  // ---- Weitere Frühstücke ----
  { name: 'Porridge mit Apfel & Zimt', type: 'breakfast', kcal: 390, protein: 12, carbs: 68, fat: 8, allergens: ['gluten', 'milk', 'lactose'],
    ingredients: [{ name: 'Haferflocken', g: 60 }, { name: 'Milch', g: 200 }, { name: 'Apfel', g: 120 }, { name: 'Zimt', g: 1 }] },
  { name: 'Vollkornbrot mit Frischkäse & Gurke', type: 'breakfast', kcal: 320, protein: 14, carbs: 42, fat: 10, allergens: ['gluten', 'milk', 'lactose'],
    ingredients: [{ name: 'Vollkornbrot', g: 90 }, { name: 'Frischkäse', g: 40 }, { name: 'Gurke', g: 80 }] },
  { name: 'Quark mit Beeren & Leinsamen', type: 'breakfast', kcal: 300, protein: 28, carbs: 20, fat: 10, allergens: ['milk', 'lactose'],
    ingredients: [{ name: 'Magerquark', g: 250 }, { name: 'Beeren', g: 80 }, { name: 'Leinsamen', g: 10 }] },
  { name: 'Müsli mit Milch & Banane', type: 'breakfast', kcal: 430, protein: 15, carbs: 70, fat: 10, allergens: ['gluten', 'milk', 'lactose'],
    ingredients: [{ name: 'Müsli', g: 70 }, { name: 'Milch', g: 200 }, { name: 'Banane', g: 100 }] },
  { name: 'Pancakes mit Beeren', type: 'breakfast', kcal: 450, protein: 18, carbs: 60, fat: 14, allergens: ['gluten', 'eggs', 'milk', 'lactose'],
    ingredients: [{ name: 'Mehl', g: 80 }, { name: 'Ei', g: 50 }, { name: 'Milch', g: 120 }, { name: 'Beeren', g: 80 }] },
  { name: 'Avocado-Brot mit Ei', type: 'breakfast', kcal: 420, protein: 18, carbs: 32, fat: 24, allergens: ['gluten', 'eggs'],
    ingredients: [{ name: 'Vollkornbrot', g: 80 }, { name: 'Avocado', g: 70 }, { name: 'Ei', g: 50 }] },
  { name: 'Chia-Pudding mit Mango', type: 'breakfast', kcal: 340, protein: 10, carbs: 40, fat: 14, allergens: ['coconut'],
    ingredients: [{ name: 'Chiasamen', g: 30 }, { name: 'Kokosmilch', g: 100 }, { name: 'Mango', g: 120 }] },
  { name: 'Grießbrei mit Beeren', type: 'breakfast', kcal: 380, protein: 14, carbs: 62, fat: 8, allergens: ['gluten', 'milk', 'lactose'],
    ingredients: [{ name: 'Hartweizengrieß', g: 60 }, { name: 'Milch', g: 250 }, { name: 'Beeren', g: 80 }] },
  { name: 'Bircher Müsli', type: 'breakfast', kcal: 400, protein: 12, carbs: 66, fat: 9, allergens: ['gluten', 'milk', 'lactose'],
    ingredients: [{ name: 'Haferflocken', g: 50 }, { name: 'Apfel', g: 100 }, { name: 'Joghurt', g: 150 }, { name: 'Rosinen', g: 20 }] },
  { name: 'Rührtofu mit Vollkornbrot', type: 'breakfast', kcal: 360, protein: 22, carbs: 34, fat: 14, allergens: ['soy', 'gluten'],
    ingredients: [{ name: 'Tofu', g: 150 }, { name: 'Vollkornbrot', g: 60 }, { name: 'Öl', g: 5 }] },
  { name: 'Joghurt mit Granola', type: 'breakfast', kcal: 380, protein: 14, carbs: 52, fat: 12, allergens: ['gluten', 'milk', 'lactose', 'tree_nuts'],
    ingredients: [{ name: 'Naturjoghurt', g: 200 }, { name: 'Granola', g: 60 }] },
  { name: 'Erdbeer-Quark-Brötchen', type: 'breakfast', kcal: 350, protein: 18, carbs: 50, fat: 8, allergens: ['gluten', 'milk', 'lactose'],
    ingredients: [{ name: 'Vollkornbrötchen', g: 80 }, { name: 'Magerquark', g: 100 }, { name: 'Erdbeeren', g: 100 }] },
  { name: 'Omelett mit Käse', type: 'breakfast', kcal: 360, protein: 26, carbs: 4, fat: 26, allergens: ['eggs', 'milk', 'lactose'],
    ingredients: [{ name: 'Eier (ca. 3)', g: 150 }, { name: 'Gouda', g: 30 }, { name: 'Butter', g: 5 }] },
  { name: 'Haferflocken-Smoothie', type: 'breakfast', kcal: 350, protein: 20, carbs: 50, fat: 7, allergens: ['gluten', 'milk', 'lactose'],
    ingredients: [{ name: 'Haferflocken', g: 40 }, { name: 'Milch', g: 250 }, { name: 'Banane', g: 100 }, { name: 'Proteinpulver', g: 15 }] },
  { name: 'Vollkorn-Croissant mit Marmelade', type: 'breakfast', kcal: 380, protein: 8, carbs: 52, fat: 16, allergens: ['gluten', 'milk', 'lactose'],
    ingredients: [{ name: 'Croissant', g: 60 }, { name: 'Marmelade', g: 30 }] },
  { name: 'Shakshuka', type: 'breakfast', kcal: 320, protein: 18, carbs: 18, fat: 18, allergens: ['eggs', 'nightshades'],
    ingredients: [{ name: 'Eier', g: 100 }, { name: 'Tomaten', g: 200 }, { name: 'Paprika', g: 80 }, { name: 'Öl', g: 8 }] },
  { name: 'Proteinpfannkuchen', type: 'breakfast', kcal: 380, protein: 30, carbs: 30, fat: 12, allergens: ['eggs', 'milk', 'lactose'],
    ingredients: [{ name: 'Ei', g: 100 }, { name: 'Haferflocken', g: 40 }, { name: 'Proteinpulver', g: 30 }, { name: 'Banane', g: 80 }] },
  { name: 'Quinoa-Frühstücksbowl', type: 'breakfast', kcal: 400, protein: 14, carbs: 62, fat: 11, allergens: ['tree_nuts'],
    ingredients: [{ name: 'Quinoa (gekocht)', g: 200 }, { name: 'Apfel', g: 100 }, { name: 'Mandeln', g: 20 }] },
  { name: 'Vollkorntoast mit Honig & Banane', type: 'breakfast', kcal: 360, protein: 9, carbs: 68, fat: 6, allergens: ['gluten'],
    ingredients: [{ name: 'Vollkorntoast', g: 80 }, { name: 'Honig', g: 20 }, { name: 'Banane', g: 100 }] },
  { name: 'Hüttenkäse mit Ananas', type: 'breakfast', kcal: 280, protein: 26, carbs: 20, fat: 8, allergens: ['milk', 'lactose'],
    ingredients: [{ name: 'Hüttenkäse', g: 200 }, { name: 'Ananas', g: 120 }] },
  { name: 'Beeren-Smoothie mit Hafer', type: 'breakfast', kcal: 330, protein: 8, carbs: 60, fat: 5, allergens: ['gluten'],
    ingredients: [{ name: 'Beeren', g: 150 }, { name: 'Banane', g: 100 }, { name: 'Haferflocken', g: 30 }, { name: 'Wasser', g: 150 }] },
  { name: 'Vollkornwaffeln mit Joghurt', type: 'breakfast', kcal: 420, protein: 14, carbs: 58, fat: 14, allergens: ['gluten', 'eggs', 'milk', 'lactose'],
    ingredients: [{ name: 'Waffeln', g: 90 }, { name: 'Naturjoghurt', g: 100 }, { name: 'Beeren', g: 60 }] },
  { name: 'Erdnussbutter-Porridge', type: 'breakfast', kcal: 440, protein: 16, carbs: 58, fat: 16, allergens: ['gluten', 'peanuts', 'milk', 'lactose'],
    ingredients: [{ name: 'Haferflocken', g: 60 }, { name: 'Milch', g: 200 }, { name: 'Erdnussbutter', g: 25 }, { name: 'Banane', g: 80 }] },
  { name: 'Käsebrot mit Tomate', type: 'breakfast', kcal: 340, protein: 16, carbs: 38, fat: 14, allergens: ['gluten', 'milk', 'lactose', 'nightshades'],
    ingredients: [{ name: 'Vollkornbrot', g: 90 }, { name: 'Gouda', g: 30 }, { name: 'Tomate', g: 80 }] },

  // ---- Weitere Mittagessen ----
  { name: 'Putengeschnetzeltes mit Nudeln', type: 'lunch', kcal: 560, protein: 42, carbs: 62, fat: 12, allergens: ['gluten', 'milk', 'lactose'],
    ingredients: [{ name: 'Putenbrust', g: 150 }, { name: 'Nudeln (gekocht)', g: 200 }, { name: 'Champignons', g: 100 }, { name: 'Sahne', g: 30 }] },
  { name: 'Gemüse-Reispfanne mit Ei', type: 'lunch', kcal: 480, protein: 18, carbs: 72, fat: 12, allergens: ['eggs', 'soy'],
    ingredients: [{ name: 'Reis (gekocht)', g: 200 }, { name: 'Gemüse', g: 200 }, { name: 'Ei', g: 100 }, { name: 'Sojasoße', g: 10 }] },
  { name: 'Spaghetti Bolognese', type: 'lunch', kcal: 620, protein: 32, carbs: 80, fat: 18, allergens: ['gluten', 'nightshades'],
    ingredients: [{ name: 'Spaghetti (gekocht)', g: 250 }, { name: 'Rinderhackfleisch', g: 120 }, { name: 'Tomatensoße', g: 150 }] },
  { name: 'Hähnchen-Caesar-Salat', type: 'lunch', kcal: 480, protein: 40, carbs: 18, fat: 26, allergens: ['gluten', 'milk', 'lactose', 'eggs', 'fish'],
    ingredients: [{ name: 'Hähnchenbrust', g: 150 }, { name: 'Romanasalat', g: 120 }, { name: 'Croutons', g: 30 }, { name: 'Parmesan', g: 20 }, { name: 'Caesar-Dressing', g: 30 }] },
  { name: 'Gefüllte Paprika mit Hack & Reis', type: 'lunch', kcal: 520, protein: 30, carbs: 50, fat: 18, allergens: ['nightshades'],
    ingredients: [{ name: 'Paprika', g: 200 }, { name: 'Rinderhackfleisch', g: 120 }, { name: 'Reis (gekocht)', g: 120 }] },
  { name: 'Kartoffel-Gemüse-Auflauf', type: 'lunch', kcal: 500, protein: 18, carbs: 60, fat: 18, allergens: ['milk', 'lactose'],
    ingredients: [{ name: 'Kartoffeln', g: 250 }, { name: 'Gemüse', g: 150 }, { name: 'Käse', g: 40 }, { name: 'Sahne', g: 40 }] },
  { name: 'Hähnchen-Curry mit Reis', type: 'lunch', kcal: 580, protein: 40, carbs: 70, fat: 14, allergens: ['coconut'],
    ingredients: [{ name: 'Hähnchenbrust', g: 150 }, { name: 'Reis (gekocht)', g: 200 }, { name: 'Kokosmilch', g: 60 }, { name: 'Gemüse', g: 100 }] },
  { name: 'Thunfisch-Nudelsalat', type: 'lunch', kcal: 520, protein: 34, carbs: 60, fat: 14, allergens: ['gluten', 'fish', 'eggs'],
    ingredients: [{ name: 'Nudeln (gekocht)', g: 200 }, { name: 'Thunfisch', g: 120 }, { name: 'Mais', g: 60 }, { name: 'Mayonnaise', g: 20 }] },
  { name: 'Falafel mit Couscous', type: 'lunch', kcal: 540, protein: 20, carbs: 72, fat: 18, allergens: ['gluten', 'legumes', 'sesame'],
    ingredients: [{ name: 'Falafel', g: 120 }, { name: 'Couscous (gekocht)', g: 200 }, { name: 'Hummus', g: 50 }] },
  { name: 'Rindersteak mit Süßkartoffelpommes', type: 'lunch', kcal: 620, protein: 45, carbs: 50, fat: 24, allergens: [],
    ingredients: [{ name: 'Rindersteak', g: 180 }, { name: 'Süßkartoffel', g: 250 }, { name: 'Olivenöl', g: 10 }] },
  { name: 'Gemüselasagne', type: 'lunch', kcal: 520, protein: 22, carbs: 58, fat: 20, allergens: ['gluten', 'milk', 'lactose'],
    ingredients: [{ name: 'Lasagneplatten', g: 100 }, { name: 'Gemüse', g: 200 }, { name: 'Béchamel', g: 100 }, { name: 'Käse', g: 40 }] },
  { name: 'Reis mit Kidneybohnen & Mais', type: 'lunch', kcal: 500, protein: 18, carbs: 90, fat: 8, allergens: ['legumes'],
    ingredients: [{ name: 'Reis (gekocht)', g: 200 }, { name: 'Kidneybohnen', g: 120 }, { name: 'Mais', g: 80 }] },
  { name: 'Hähnchen-Gyros mit Tzatziki', type: 'lunch', kcal: 560, protein: 42, carbs: 40, fat: 24, allergens: ['gluten', 'milk', 'lactose'],
    ingredients: [{ name: 'Hähnchenbrust', g: 160 }, { name: 'Pita', g: 70 }, { name: 'Tzatziki', g: 60 }] },
  { name: 'Lachs-Bowl mit Quinoa', type: 'lunch', kcal: 580, protein: 38, carbs: 50, fat: 24, allergens: ['fish'],
    ingredients: [{ name: 'Lachs', g: 140 }, { name: 'Quinoa (gekocht)', g: 180 }, { name: 'Avocado', g: 60 }, { name: 'Gemüse', g: 100 }] },
  { name: 'Chili con Carne', type: 'lunch', kcal: 560, protein: 36, carbs: 56, fat: 18, allergens: ['legumes', 'nightshades'],
    ingredients: [{ name: 'Rinderhackfleisch', g: 120 }, { name: 'Kidneybohnen', g: 120 }, { name: 'Tomaten', g: 150 }, { name: 'Mais', g: 60 }, { name: 'Reis (gekocht)', g: 100 }] },
  { name: 'Vegetarische Buddha-Bowl', type: 'lunch', kcal: 500, protein: 18, carbs: 70, fat: 16, allergens: ['legumes', 'sesame'],
    ingredients: [{ name: 'Süßkartoffel', g: 150 }, { name: 'Kichererbsen', g: 100 }, { name: 'Quinoa (gekocht)', g: 120 }, { name: 'Tahini', g: 15 }] },
  { name: 'Pasta mit Pesto & Hähnchen', type: 'lunch', kcal: 620, protein: 40, carbs: 66, fat: 22, allergens: ['gluten', 'tree_nuts', 'milk', 'lactose'],
    ingredients: [{ name: 'Nudeln (gekocht)', g: 200 }, { name: 'Hähnchenbrust', g: 130 }, { name: 'Pesto', g: 30 }] },
  { name: 'Reispfanne mit Garnelen', type: 'lunch', kcal: 520, protein: 34, carbs: 70, fat: 10, allergens: ['crustaceans', 'soy'],
    ingredients: [{ name: 'Reis (gekocht)', g: 200 }, { name: 'Garnelen', g: 140 }, { name: 'Gemüse', g: 120 }, { name: 'Sojasoße', g: 10 }] },
  { name: 'Kartoffelsalat mit Würstchen', type: 'lunch', kcal: 600, protein: 22, carbs: 50, fat: 34, allergens: ['eggs'],
    ingredients: [{ name: 'Kartoffeln', g: 250 }, { name: 'Würstchen', g: 100 }, { name: 'Mayonnaise', g: 30 }] },
  { name: 'Hühnerfrikassee mit Reis', type: 'lunch', kcal: 540, protein: 38, carbs: 58, fat: 14, allergens: ['milk', 'lactose'],
    ingredients: [{ name: 'Hähnchenbrust', g: 150 }, { name: 'Reis (gekocht)', g: 180 }, { name: 'Erbsen', g: 60 }, { name: 'Sahne', g: 30 }] },
  { name: 'Gemüse-Couscous mit Feta', type: 'lunch', kcal: 500, protein: 18, carbs: 70, fat: 16, allergens: ['gluten', 'milk', 'lactose'],
    ingredients: [{ name: 'Couscous (gekocht)', g: 200 }, { name: 'Gemüse', g: 180 }, { name: 'Feta', g: 50 }] },
  { name: 'Putenschnitzel mit Kartoffeln', type: 'lunch', kcal: 560, protein: 44, carbs: 52, fat: 16, allergens: ['gluten', 'eggs'],
    ingredients: [{ name: 'Putenschnitzel', g: 150 }, { name: 'Kartoffeln', g: 250 }, { name: 'Paniermehl', g: 20 }] },
  { name: 'Vegane Gemüsepfanne mit Tofu', type: 'lunch', kcal: 480, protein: 26, carbs: 50, fat: 18, allergens: ['soy'],
    ingredients: [{ name: 'Tofu', g: 150 }, { name: 'Gemüse', g: 200 }, { name: 'Reis (gekocht)', g: 120 }, { name: 'Sojasoße', g: 10 }] },
  { name: 'Wrap mit Hähnchen & Avocado', type: 'lunch', kcal: 560, protein: 38, carbs: 46, fat: 24, allergens: ['gluten'],
    ingredients: [{ name: 'Tortilla', g: 80 }, { name: 'Hähnchenbrust', g: 130 }, { name: 'Avocado', g: 60 }, { name: 'Gemüse', g: 80 }] },

  // ---- Weitere Abendessen ----
  { name: 'Vollkornbrot mit Lachs & Frischkäse', type: 'dinner', kcal: 420, protein: 28, carbs: 36, fat: 18, allergens: ['gluten', 'fish', 'milk', 'lactose'],
    ingredients: [{ name: 'Vollkornbrot', g: 90 }, { name: 'Räucherlachs', g: 80 }, { name: 'Frischkäse', g: 30 }] },
  { name: 'Gemüsesuppe mit Vollkornbrot', type: 'dinner', kcal: 340, protein: 12, carbs: 50, fat: 9, allergens: ['gluten'],
    ingredients: [{ name: 'Gemüsesuppe', g: 350 }, { name: 'Vollkornbrot', g: 60 }] },
  { name: 'Caprese mit Mozzarella & Tomate', type: 'dinner', kcal: 380, protein: 20, carbs: 12, fat: 26, allergens: ['milk', 'lactose', 'nightshades'],
    ingredients: [{ name: 'Mozzarella', g: 100 }, { name: 'Tomate', g: 150 }, { name: 'Olivenöl', g: 12 }, { name: 'Basilikum', g: 5 }] },
  { name: 'Hähnchenspieße mit Salat', type: 'dinner', kcal: 420, protein: 40, carbs: 12, fat: 22, allergens: [],
    ingredients: [{ name: 'Hähnchenbrust', g: 160 }, { name: 'Salat', g: 150 }, { name: 'Olivenöl', g: 12 }] },
  { name: 'Rührei mit Spinat', type: 'dinner', kcal: 360, protein: 26, carbs: 6, fat: 26, allergens: ['eggs'],
    ingredients: [{ name: 'Eier (ca. 3)', g: 150 }, { name: 'Spinat', g: 120 }, { name: 'Öl', g: 8 }] },
  { name: 'Linsensalat mit Feta', type: 'dinner', kcal: 440, protein: 22, carbs: 44, fat: 18, allergens: ['legumes', 'milk', 'lactose'],
    ingredients: [{ name: 'Linsen (gekocht)', g: 200 }, { name: 'Feta', g: 50 }, { name: 'Gemüse', g: 100 }, { name: 'Olivenöl', g: 10 }] },
  { name: 'Gebratener Lachs mit Spargel', type: 'dinner', kcal: 460, protein: 38, carbs: 10, fat: 30, allergens: ['fish'],
    ingredients: [{ name: 'Lachs', g: 150 }, { name: 'Spargel', g: 200 }, { name: 'Olivenöl', g: 12 }] },
  { name: 'Hüttenkäse-Bowl mit Gemüse', type: 'dinner', kcal: 360, protein: 30, carbs: 24, fat: 14, allergens: ['milk', 'lactose', 'gluten'],
    ingredients: [{ name: 'Hüttenkäse', g: 200 }, { name: 'Gemüse', g: 150 }, { name: 'Vollkornbrot', g: 40 }] },
  { name: 'Zucchini-Auflauf mit Hackfleisch', type: 'dinner', kcal: 460, protein: 34, carbs: 18, fat: 28, allergens: ['milk', 'lactose'],
    ingredients: [{ name: 'Rinderhackfleisch', g: 150 }, { name: 'Zucchini', g: 200 }, { name: 'Käse', g: 40 }] },
  { name: 'Gefüllte Süßkartoffel mit Quark', type: 'dinner', kcal: 420, protein: 24, carbs: 56, fat: 10, allergens: ['milk', 'lactose'],
    ingredients: [{ name: 'Süßkartoffel', g: 250 }, { name: 'Magerquark', g: 150 }, { name: 'Schnittlauch', g: 5 }] },
  { name: 'Tomatensuppe mit Brot', type: 'dinner', kcal: 320, protein: 9, carbs: 46, fat: 11, allergens: ['nightshades', 'gluten'],
    ingredients: [{ name: 'Tomatensuppe', g: 350 }, { name: 'Vollkornbrot', g: 50 }] },
  { name: 'Hähnchen-Gemüse-Spieße mit Reis', type: 'dinner', kcal: 520, protein: 40, carbs: 56, fat: 12, allergens: [],
    ingredients: [{ name: 'Hähnchenbrust', g: 150 }, { name: 'Gemüse', g: 150 }, { name: 'Reis (gekocht)', g: 150 }] },
  { name: 'Vegetarische Frittata', type: 'dinner', kcal: 400, protein: 24, carbs: 14, fat: 28, allergens: ['eggs', 'milk', 'lactose'],
    ingredients: [{ name: 'Eier (ca. 3)', g: 150 }, { name: 'Gemüse', g: 150 }, { name: 'Käse', g: 30 }] },
  { name: 'Putenstreifen mit Wokgemüse', type: 'dinner', kcal: 440, protein: 40, carbs: 24, fat: 20, allergens: ['soy'],
    ingredients: [{ name: 'Putenbrust', g: 160 }, { name: 'Wokgemüse', g: 200 }, { name: 'Sojasoße', g: 10 }, { name: 'Öl', g: 8 }] },
  { name: 'Griechischer Salat mit Ei', type: 'dinner', kcal: 400, protein: 18, carbs: 16, fat: 30, allergens: ['milk', 'lactose', 'eggs', 'nightshades'],
    ingredients: [{ name: 'Gemüse', g: 200 }, { name: 'Feta', g: 60 }, { name: 'Ei', g: 50 }, { name: 'Oliven', g: 30 }, { name: 'Olivenöl', g: 10 }] },
  { name: 'Kürbissuppe mit Kürbiskernen', type: 'dinner', kcal: 340, protein: 8, carbs: 40, fat: 16, allergens: ['coconut'],
    ingredients: [{ name: 'Kürbis', g: 300 }, { name: 'Kokosmilch', g: 40 }, { name: 'Kürbiskerne', g: 15 }] },
  { name: 'Räuchertofu-Salat', type: 'dinner', kcal: 420, protein: 26, carbs: 26, fat: 22, allergens: ['soy', 'sesame'],
    ingredients: [{ name: 'Räuchertofu', g: 150 }, { name: 'Gemüse', g: 150 }, { name: 'Sesam', g: 10 }, { name: 'Olivenöl', g: 10 }] },
  { name: 'Hähnchenbrust mit Ofengemüse', type: 'dinner', kcal: 480, protein: 42, carbs: 30, fat: 20, allergens: [],
    ingredients: [{ name: 'Hähnchenbrust', g: 160 }, { name: 'Ofengemüse', g: 250 }, { name: 'Olivenöl', g: 12 }] },
  { name: 'Spinat-Feta-Omelett', type: 'dinner', kcal: 400, protein: 28, carbs: 8, fat: 28, allergens: ['eggs', 'milk', 'lactose'],
    ingredients: [{ name: 'Eier (ca. 3)', g: 150 }, { name: 'Spinat', g: 100 }, { name: 'Feta', g: 40 }, { name: 'Öl', g: 6 }] },
  { name: 'Bohnen-Gemüse-Eintopf', type: 'dinner', kcal: 420, protein: 20, carbs: 58, fat: 10, allergens: ['legumes'],
    ingredients: [{ name: 'Weiße Bohnen', g: 180 }, { name: 'Gemüse', g: 200 }, { name: 'Kartoffeln', g: 100 }] },
  { name: 'Matjes mit Pellkartoffeln', type: 'dinner', kcal: 480, protein: 28, carbs: 40, fat: 22, allergens: ['fish'],
    ingredients: [{ name: 'Matjes', g: 120 }, { name: 'Kartoffeln', g: 250 }, { name: 'Zwiebel', g: 30 }] },
  { name: 'Gemüse-Frikadellen mit Quark-Dip', type: 'dinner', kcal: 420, protein: 22, carbs: 36, fat: 20, allergens: ['eggs', 'milk', 'lactose', 'gluten'],
    ingredients: [{ name: 'Gemüse-Frikadellen', g: 180 }, { name: 'Magerquark', g: 100 }, { name: 'Vollkornbrot', g: 40 }] },
  { name: 'Tofu-Gemüse-Curry', type: 'dinner', kcal: 460, protein: 24, carbs: 44, fat: 20, allergens: ['soy', 'coconut'],
    ingredients: [{ name: 'Tofu', g: 150 }, { name: 'Gemüse', g: 200 }, { name: 'Kokosmilch', g: 60 }, { name: 'Reis (gekocht)', g: 80 }] },
  { name: 'Caprese-Sandwich', type: 'dinner', kcal: 440, protein: 20, carbs: 44, fat: 20, allergens: ['gluten', 'milk', 'lactose', 'nightshades'],
    ingredients: [{ name: 'Vollkornbrot', g: 90 }, { name: 'Mozzarella', g: 80 }, { name: 'Tomate', g: 80 }, { name: 'Basilikum', g: 5 }] },

  // ---- Weitere Snacks ----
  { name: 'Proteinriegel', type: 'snack', kcal: 230, protein: 20, carbs: 22, fat: 8, allergens: ['milk', 'lactose', 'soy'],
    ingredients: [{ name: 'Proteinriegel', g: 60 }] },
  { name: 'Skyr mit Honig', type: 'snack', kcal: 200, protein: 20, carbs: 22, fat: 1, allergens: ['milk', 'lactose'],
    ingredients: [{ name: 'Skyr', g: 200 }, { name: 'Honig', g: 15 }] },
  { name: 'Handvoll Studentenfutter', type: 'snack', kcal: 250, protein: 7, carbs: 22, fat: 16, allergens: ['tree_nuts'],
    ingredients: [{ name: 'Studentenfutter', g: 40 }] },
  { name: 'Vollkornbrot mit Käse', type: 'snack', kcal: 240, protein: 12, carbs: 26, fat: 10, allergens: ['gluten', 'milk', 'lactose'],
    ingredients: [{ name: 'Vollkornbrot', g: 60 }, { name: 'Gouda', g: 30 }] },
  { name: 'Joghurt-Granola-Becher', type: 'snack', kcal: 240, protein: 9, carbs: 32, fat: 8, allergens: ['gluten', 'milk', 'lactose', 'tree_nuts'],
    ingredients: [{ name: 'Naturjoghurt', g: 150 }, { name: 'Granola', g: 40 }] },
  { name: 'Protein-Shake mit Banane', type: 'snack', kcal: 250, protein: 28, carbs: 28, fat: 3, allergens: ['milk', 'lactose'],
    ingredients: [{ name: 'Proteinpulver', g: 30 }, { name: 'Milch', g: 250 }, { name: 'Banane', g: 80 }] },
  { name: 'Käsewürfel mit Trauben', type: 'snack', kcal: 220, protein: 12, carbs: 16, fat: 12, allergens: ['milk', 'lactose'],
    ingredients: [{ name: 'Gouda', g: 40 }, { name: 'Trauben', g: 120 }] },
  { name: 'Edamame', type: 'snack', kcal: 180, protein: 16, carbs: 14, fat: 8, allergens: ['soy'],
    ingredients: [{ name: 'Edamame', g: 150 }, { name: 'Salz', g: 1 }] },
  { name: 'Apfel mit Erdnussbutter', type: 'snack', kcal: 250, protein: 8, carbs: 28, fat: 13, allergens: ['peanuts'],
    ingredients: [{ name: 'Apfel', g: 150 }, { name: 'Erdnussbutter', g: 25 }] },
  { name: 'Hüttenkäse mit Gurke', type: 'snack', kcal: 160, protein: 22, carbs: 8, fat: 4, allergens: ['milk', 'lactose'],
    ingredients: [{ name: 'Hüttenkäse', g: 200 }, { name: 'Gurke', g: 100 }] },
  { name: 'Beeren-Smoothie', type: 'snack', kcal: 180, protein: 4, carbs: 38, fat: 1, allergens: [],
    ingredients: [{ name: 'Beeren', g: 150 }, { name: 'Banane', g: 100 }, { name: 'Wasser', g: 100 }] },
  { name: 'Trockenobst-Mix', type: 'snack', kcal: 230, protein: 3, carbs: 52, fat: 2, allergens: [],
    ingredients: [{ name: 'Datteln', g: 40 }, { name: 'Rosinen', g: 30 }, { name: 'Aprikosen (getrocknet)', g: 20 }] },
  { name: 'Vollkorncracker mit Frischkäse', type: 'snack', kcal: 220, protein: 8, carbs: 28, fat: 9, allergens: ['gluten', 'milk', 'lactose'],
    ingredients: [{ name: 'Vollkorncracker', g: 40 }, { name: 'Frischkäse', g: 40 }] },
  { name: 'Energiekugeln (Datteln & Hafer)', type: 'snack', kcal: 240, protein: 6, carbs: 40, fat: 8, allergens: ['gluten', 'tree_nuts'],
    ingredients: [{ name: 'Datteln', g: 40 }, { name: 'Haferflocken', g: 30 }, { name: 'Mandeln', g: 15 }] },
  { name: 'Karotten mit Hummus', type: 'snack', kcal: 180, protein: 6, carbs: 20, fat: 8, allergens: ['legumes', 'sesame'],
    ingredients: [{ name: 'Karotten', g: 150 }, { name: 'Hummus', g: 50 }] },
  { name: 'Naturjoghurt mit Walnüssen', type: 'snack', kcal: 220, protein: 10, carbs: 16, fat: 13, allergens: ['milk', 'lactose', 'tree_nuts'],
    ingredients: [{ name: 'Naturjoghurt', g: 200 }, { name: 'Walnüsse', g: 20 }] },
  { name: 'Banane mit Mandelmus', type: 'snack', kcal: 240, protein: 5, carbs: 36, fat: 10, allergens: ['tree_nuts'],
    ingredients: [{ name: 'Banane', g: 120 }, { name: 'Mandelmus', g: 25 }] },
  { name: 'Mini-Mozzarella mit Tomaten', type: 'snack', kcal: 200, protein: 16, carbs: 8, fat: 12, allergens: ['milk', 'lactose', 'nightshades'],
    ingredients: [{ name: 'Mozzarella', g: 80 }, { name: 'Kirschtomaten', g: 120 }] },
  { name: 'Proteinpudding', type: 'snack', kcal: 200, protein: 20, carbs: 20, fat: 4, allergens: ['milk', 'lactose'],
    ingredients: [{ name: 'Magerquark', g: 150 }, { name: 'Proteinpulver', g: 15 }, { name: 'Kakao', g: 5 }] },
  { name: 'Vollkornbrot mit Avocado', type: 'snack', kcal: 240, protein: 6, carbs: 28, fat: 13, allergens: ['gluten'],
    ingredients: [{ name: 'Vollkornbrot', g: 60 }, { name: 'Avocado', g: 70 }] },
  { name: 'Obst-Quark', type: 'snack', kcal: 200, protein: 18, carbs: 24, fat: 2, allergens: ['milk', 'lactose'],
    ingredients: [{ name: 'Magerquark', g: 150 }, { name: 'Apfel', g: 100 }, { name: 'Honig', g: 10 }] },
  { name: 'Edamame & Reiscracker', type: 'snack', kcal: 220, protein: 14, carbs: 26, fat: 8, allergens: ['soy'],
    ingredients: [{ name: 'Edamame', g: 120 }, { name: 'Reiscracker', g: 20 }] },
  { name: 'Käse-Schinken-Röllchen', type: 'snack', kcal: 200, protein: 20, carbs: 2, fat: 12, allergens: ['milk', 'lactose'],
    ingredients: [{ name: 'Kochschinken', g: 80 }, { name: 'Gouda', g: 40 }] },
  { name: 'Smoothie mit Spinat & Banane', type: 'snack', kcal: 190, protein: 5, carbs: 38, fat: 2, allergens: [],
    ingredients: [{ name: 'Spinat', g: 50 }, { name: 'Banane', g: 120 }, { name: 'Apfel', g: 100 }, { name: 'Wasser', g: 100 }] },
  { name: 'Erdnüsse (Handvoll)', type: 'snack', kcal: 250, protein: 11, carbs: 7, fat: 21, allergens: ['peanuts'],
    ingredients: [{ name: 'Erdnüsse', g: 40 }] },
];

// Erstellt einen Tagesplan: pro Mahlzeit eine allergikersichere Option,
// portioniert auf den jeweiligen Kalorien-Anteil des Tagesziels.
export function generateMealPlan(targetKcal: number, allergies: string[]): PlannedMeal[] {
  const out: PlannedMeal[] = [];
  for (const type of ORDER) {
    const safe = MEALS.filter((m) => m.type === type && !m.allergens.some((a) => allergies.includes(a)));
    if (safe.length === 0) continue; // keine sichere Option -> Mahlzeit auslassen
    const pick = safe[Math.floor(Math.random() * safe.length)];
    const mealTarget = targetKcal * SHARE[type];
    let portion = mealTarget / pick.kcal;
    portion = Math.max(0.5, Math.min(2.5, Math.round(portion * 10) / 10));
    out.push({
      type,
      name: pick.name,
      kcal: Math.round(pick.kcal * portion),
      protein: Math.round(pick.protein * portion),
      carbs: Math.round(pick.carbs * portion),
      fat: Math.round(pick.fat * portion),
      portion,
    });
  }
  return out;
}

// ----------------------------------------------------------------------------
//  Mahlzeiten-Tracking (Essens-Tagebuch) – teilt sich MealType + Labels oben
// ----------------------------------------------------------------------------
export const MEAL_ICONS: Record<MealType, string> = {
  breakfast: '🌅', lunch: '🍽️', dinner: '🌙', snack: '🍎',
};

// Reihenfolge + Icons fuer die Tagebuch-Abschnitte
export const TRACKER_MEALS: { key: MealType; label: string; icon: string }[] =
  ORDER.map((k) => ({ key: k, label: MEAL_TYPE_LABELS[k], icon: MEAL_ICONS[k] }));

// Vorschlag der Mahlzeit anhand der Uhrzeit.
export function mealByHour(d: Date = new Date()): MealType {
  const h = d.getHours();
  if (h < 11) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 21) return 'dinner';
  return 'snack';
}

// Unbekanntes/NULL -> 'snack', damit nichts verloren geht.
export function normalizeMeal(key: string | null | undefined): MealType {
  return ORDER.find((k) => k === key) ?? 'snack';
}

// Rezept (Zutaten + Mengen) zu einem geplanten Gericht. Skaliert die Standardportion
// auf die tatsaechlichen Kalorien des Plan-Eintrags (portion = kcal / Vorlagen-kcal).
export function recipeFor(name: string, kcal: number): Ingredient[] {
  const tpl = MEALS.find((m) => m.name === name);
  if (!tpl || !tpl.ingredients?.length) return [];
  const portion = tpl.kcal > 0 && kcal > 0 ? kcal / tpl.kcal : 1;
  return tpl.ingredients.map((i) => ({ name: i.name, g: Math.max(1, Math.round(i.g * portion)) }));
}
