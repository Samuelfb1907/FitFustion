// Uebersetzungen fuer den Kalorien-/Essens-Tracker (FoodTrackerScreen).
// Schluessel in BEIDE Woerterbuecher (de + en) mit identischen {Platzhaltern}.
export const de = {
  "food.title": "Tracker",
  "food.diarySubtitle": "Dein Essens-Tagebuch für heute",
  "food.searchingProduct": "Produkt wird gesucht…",

  // Barcode-Scan
  "food.barcodeNotFound": "Barcode {code} nicht gefunden. Du kannst die Zutat manuell suchen.",
  "food.barcodeFetchFailed": "Konnte das Produkt nicht abrufen. Bitte nochmal versuchen.",

  // Mengen-Screen
  "food.kcalPer100g": "{n} kcal / 100 {unit}",
  "food.amountInGrams": "Menge ({unit})",
  "food.amountPlaceholder": "z. B. 150",
  "food.meal": "Mahlzeit",
  "food.addToFavoriteList": "Zur Favoriten-Liste hinzufügen",
  "food.addToDiary": "Zum Tagebuch hinzufügen",
  "food.invalidAmount": "Bitte gültige Menge eingeben.",

  // Neues Lebensmittel
  "food.newFoodTitle": "Neues Lebensmittel",
  "food.nutritionPer100g": "Nährwerte pro 100 {unit}",
  "food.name": "Name",
  "food.namePlaceholder": "z. B. Mein Proteinriegel",
  "food.categoryOptional": "Kategorie (optional)",
  "food.categoryPlaceholder": "z. B. Snacks & Süßes",
  "food.unitLabel": "Einheit",
  "food.unitG": "Gramm (g)",
  "food.unitMl": "Milliliter (ml)",
  "food.unitHintMl": "Wird als Getränk gespeichert – Mengen erscheinen in ml.",
  "food.calories": "Kalorien (kcal)",
  "food.per100g": "pro 100 {unit}",
  "food.protein": "Eiweiß (g)",
  "food.carbs": "KH (g)",
  "food.fat": "Fett (g)",
  "food.saveAndSelect": "Speichern & auswählen",
  "food.errInvalidKcal": "Bitte gültige Kalorien (pro 100 g) eingeben.",
  "food.errKcalTooHigh": "Kalorien pro 100 g wirken zu hoch (max. 1000). Bitte den Wert pro 100 g eingeben.",
  "food.errMacroTooHigh": "Protein, Kohlenhydrate und Fett sind Angaben pro 100 g (je max. 100 g).",
  "food.errDuplicateFood": "Es gibt bereits ein Lebensmittel mit diesem Namen.",

  // Auswahl (Zutaten / Favoriten)
  "food.add": "Hinzufügen",
  "food.addIngredient": "Zutat hinzufügen",
  "food.tabIngredients": "Zutaten",
  "food.tabFavorites": "Favoriten",
  "food.searchPlaceholder": "Suchen (z. B. Banane)…",
  "food.createOwnFood": "Eigenes Lebensmittel anlegen",
  // Datenbank-Suche (Open Food Facts) – Premium
  "food.dbSectionTitle": "Aus der Datenbank",
  "food.dbSearching": "Datenbank wird durchsucht…",
  "food.dbNoResult": "Nichts in der Datenbank gefunden. Leg es als eigenes Lebensmittel an ☝️",
  "food.dbPremiumCta": "In der Lebensmittel-Datenbank suchen",
  "food.dbPremiumHint": "Premium: Millionen Produkte durchsuchen",
  "food.dbFreeLeft": "{n} gratis heute",
  "food.dbQuotaCta": "Tageslimit erreicht – unbegrenzt mit Premium",
  "food.dbQuotaHint": "Du hast deine {n} kostenlosen Datenbank-Suchen für heute genutzt. Mit Premium suchst du unbegrenzt.",
  "food.searching": "Suche…",
  "food.searchCountOne": "{n} Eintrag",
  "food.searchCountMany": "{n} Einträge",
  "food.favHint": "Tippe einen Favoriten an – alle Zutaten landen auf einmal in „{meal}\".",
  "food.theMeal": "der Mahlzeit",
  "food.createNewFavorite": "Neuen Favoriten erstellen",
  "food.ownSuffix": "  ·  eigenes",
  "food.noResult": "Kein Treffer. Leg es als eigenes Lebensmittel an ☝️",
  "food.noResultFor": "Kein Treffer für „{q}\". Leg es als eigenes Lebensmittel an ☝️",
  "food.itemCountOne": "{n} Zutat",
  "food.itemCountMany": "{n} Zutaten",
  "food.noFavorites": "Noch keine Favoriten. Erstelle z. B. dein tägliches Frühstück ☝️",

  // Favorit erstellen
  "food.createFavoriteTitle": "Favorit erstellen",
  "food.createFavoriteSubtitle": "Speichere eine Mahlzeit, z. B. dein tägliches Frühstück.",
  "food.favNamePlaceholder": "z. B. Mein Frühstück",
  "food.ingredientsLabel": "Zutaten ({n})",
  "food.noIngredientYet": "Noch keine Zutat. Tippe „Zutat hinzufügen\".",
  "food.addIngredientBtn": "Zutat hinzufügen",
  "food.total": "Gesamt: {n} kcal",
  "food.saveFavorite": "Favorit speichern",
  "food.errEnterName": "Bitte einen Namen eingeben.",
  "food.errAtLeastOneItem": "Bitte mindestens eine Zutat hinzufügen.",
  "food.errSaveFailed": "Speichern fehlgeschlagen: {msg}",
  "food.errApplyFavorite": "Konnte Favorit nicht hinzufügen. Vielleicht wurde eine Zutat gelöscht.",

  // Heute-Übersicht
  "food.eaten": "gegessen",
  "food.goal": "Ziel",
  "food.remaining": "übrig",
  "food.kcalExtra": "+{n} kcal extra",
  "food.stepsSuffix": "  ·  {steps} Schritte",
  "food.gProtein": "{n} g Eiweiß",
  "food.gCarbs": "{n} g KH",
  "food.gFat": "{n} g Fett",
  "food.mProtein": "Eiweiß",
  "food.mCarbs": "KH",
  "food.mFat": "Fett",

  // "Sprich's einfach" (KI)
  "food.nlTitle": "Schreib, was du gegessen hast",
  "food.nlConsentHint": "Analyse per KI (Anthropic, USA) – freiwillig, in Einstellungen widerrufbar.",
  "food.nlPlaceholder": "z. B. 2 Eier, ein Toast und ein Kaffee",
  "food.nlRecognize": "Automatisch erkennen",
  "food.nlRecognizePremium": "Premium: Automatisch erkennen",
  "food.photoBtn": "Mahlzeit fotografieren",
  "food.photoChooseTitle": "Foto deiner Mahlzeit",
  "food.photoCamera": "Kamera",
  "food.photoGallery": "Aus Galerie",
  "food.photoCancel": "Abbrechen",
  "food.photoNothing": "Auf dem Foto nichts erkannt. Versuch ein klareres Bild von oben.",
  "food.photoFailed": "Foto konnte nicht verarbeitet werden. Bitte erneut versuchen.",
  "food.photoNoCamera": "Kein Kamerazugriff. Bitte in den iPhone-Einstellungen erlauben.",
  "food.nlNothingRecognized": "Nichts erkannt. Formuliere es etwas anders.",
  "food.nlUnavailable": "Erkennung gerade nicht verfügbar. Bitte später erneut versuchen.",
  "food.nlInsertFailed": "Konnte nicht eintragen: {msg}",

  // Aktionen
  "food.addAction": "Hinzufügen",
  "food.scan": "Scannen",
  "food.scanLocked": "Scannen",

  // Üblicher Tag
  "food.usualTitle": "Dein übliches {meal}",
  "food.aMeal": "Essen",
  "food.oneTap": "+ 1 Tipp",
  "food.usualAdded": "✓ Übliches {meal} hinzugefügt",

  // Schnellzugriff / Tagebuch
  "food.quickAccess": "SCHNELLZUGRIFF",
  "food.diary": "TAGEBUCH",
  "food.mealEmpty": "Noch nichts – tippe ＋",
  "food.entry": "Eintrag",
  "food.foodAdded": "✓ {name} ({amount} {unit}) hinzugefügt",

  // Bestätigungs-Dialog (KI erkannt)
  "food.nlSheetTitle": "Erkannt – passt das?",
  "food.nlWhichMeal": "Für welche Mahlzeit?",
  "food.nlNothingLeft": "Nichts mehr übrig – tippe Abbrechen.",
  "food.nlEnterAmounts": "Bitte bei allen eine Menge eintragen.",
  "food.nlAddToDiary": "Ins Tagebuch eintragen",

  // KI-Einwilligung
  "food.consentTitle": "KI-Mahlzeitenerkennung aktivieren?",
  "food.consentBody": "Für „Sprich's einfach\" wird dein eingegebener Text (z. B. „2 Eier und ein Toast\") oder dein Foto der Mahlzeit zur Auswertung an unseren Dienstleister Anthropic (USA) übermittelt und in Lebensmittel mit Nährwerten zerlegt. Da das Gesundheitsdaten sein können, brauchen wir dafür deine ausdrückliche Einwilligung (Art. 9 DSGVO).\n\nFreiwillig, jederzeit in den Einstellungen widerrufbar. Die Eingaben werden nicht zum KI-Training verwendet. Bitte keine sensiblen Daten eingeben, die über die Mahlzeitenbeschreibung hinausgehen.",
  "food.consentAccept": "Einverstanden & fortfahren",

  // Dialoge / gemeinsame Aktionen
  "food.cancel": "Abbrechen",
  "food.delete": "Löschen",
  "food.notPossible": "Nicht möglich",
  "food.deleteFavoriteTitle": "Favorit löschen?",
  "food.deleteFavoriteMsg": "„{name}\" wirklich löschen?",
  "food.deleteEntryTitle": "Eintrag löschen?",
  "food.deleteEntryMsg": "Diesen Tagebuch-Eintrag entfernen?",
  "food.deleteFoodTitle": "Lebensmittel löschen?",
  "food.deleteFoodMsg": "„{name}\" wirklich löschen?",
  "food.errFoodInUse": "Dieses Lebensmittel wird noch in Tagebuch-Einträgen oder Rezepten verwendet und kann darum nicht gelöscht werden.",

  // Barrierefreiheit
  "food.a11yDeleteFood": "{name} löschen",
  "food.a11yDeleteFavorite": "{name} löschen",
  "food.a11yRemoveItem": "{name} entfernen",
  "food.a11yRemoveEntry": "{name} aus dem Tagebuch entfernen",
  "food.a11yAddToMeal": "Zu {meal} hinzufügen",
  "food.a11yAddUsual": "Übliches {meal} hinzufügen",
  "food.a11yAmountFor": "Menge für {name} in {unit}",
  "food.a11ySaveMealAsFavorite": "{meal} als Favorit speichern",

  // Mahlzeit-Namen (Tagebuch-Abschnitte)
  "food.meal.breakfast": "Frühstück",
  "food.meal.lunch": "Mittagessen",
  "food.meal.dinner": "Abendessen",
  "food.meal.snack": "Snack",
};

export const en = {
  "food.title": "Tracker",
  "food.diarySubtitle": "Your food diary for today",
  "food.searchingProduct": "Looking up product…",

  // Barcode scan
  "food.barcodeNotFound": "Barcode {code} not found. You can search for the item manually.",
  "food.barcodeFetchFailed": "Couldn't fetch the product. Please try again.",

  // Amount screen
  "food.kcalPer100g": "{n} kcal / 100 {unit}",
  "food.amountInGrams": "Amount ({unit})",
  "food.amountPlaceholder": "e.g. 150",
  "food.meal": "Meal",
  "food.addToFavoriteList": "Add to favorites list",
  "food.addToDiary": "Add to diary",
  "food.invalidAmount": "Please enter a valid amount.",

  // New food
  "food.newFoodTitle": "New food",
  "food.nutritionPer100g": "Nutrition per 100 {unit}",
  "food.name": "Name",
  "food.namePlaceholder": "e.g. My protein bar",
  "food.categoryOptional": "Category (optional)",
  "food.categoryPlaceholder": "e.g. Snacks & sweets",
  "food.unitLabel": "Unit",
  "food.unitG": "Grams (g)",
  "food.unitMl": "Milliliters (ml)",
  "food.unitHintMl": "Saved as a beverage – amounts show in ml.",
  "food.calories": "Calories (kcal)",
  "food.per100g": "per 100 {unit}",
  "food.protein": "Protein (g)",
  "food.carbs": "Carbs (g)",
  "food.fat": "Fat (g)",
  "food.saveAndSelect": "Save & select",
  "food.errInvalidKcal": "Please enter valid calories (per 100 g).",
  "food.errKcalTooHigh": "Calories per 100 g seem too high (max. 1000). Please enter the value per 100 g.",
  "food.errMacroTooHigh": "Protein, carbs and fat are values per 100 g (max. 100 g each).",
  "food.errDuplicateFood": "A food with this name already exists.",

  // Picker (ingredients / favorites)
  "food.add": "Add",
  "food.addIngredient": "Add ingredient",
  "food.tabIngredients": "Ingredients",
  "food.tabFavorites": "Favorites",
  "food.searchPlaceholder": "Search (e.g. banana)…",
  "food.createOwnFood": "Create your own food",
  // Database search (Open Food Facts) – Premium
  "food.dbSectionTitle": "From the database",
  "food.dbSearching": "Searching the database…",
  "food.dbNoResult": "Nothing found in the database. Add it as your own food ☝️",
  "food.dbPremiumCta": "Search the food database",
  "food.dbPremiumHint": "Premium: search millions of products",
  "food.dbFreeLeft": "{n} free today",
  "food.dbQuotaCta": "Daily limit reached – unlimited with Premium",
  "food.dbQuotaHint": "You've used your {n} free database searches for today. Premium gives you unlimited searches.",
  "food.searching": "Searching…",
  "food.searchCountOne": "{n} entry",
  "food.searchCountMany": "{n} entries",
  "food.favHint": "Tap a favorite – all ingredients go into “{meal}” at once.",
  "food.theMeal": "the meal",
  "food.createNewFavorite": "Create new favorite",
  "food.ownSuffix": "  ·  yours",
  "food.noResult": "No match. Add it as your own food ☝️",
  "food.noResultFor": "No match for “{q}”. Add it as your own food ☝️",
  "food.itemCountOne": "{n} ingredient",
  "food.itemCountMany": "{n} ingredients",
  "food.noFavorites": "No favorites yet. Create e.g. your daily breakfast ☝️",

  // Create favorite
  "food.createFavoriteTitle": "Create favorite",
  "food.createFavoriteSubtitle": "Save a meal, e.g. your daily breakfast.",
  "food.favNamePlaceholder": "e.g. My breakfast",
  "food.ingredientsLabel": "Ingredients ({n})",
  "food.noIngredientYet": "No ingredient yet. Tap “Add ingredient”.",
  "food.addIngredientBtn": "Add ingredient",
  "food.total": "Total: {n} kcal",
  "food.saveFavorite": "Save favorite",
  "food.errEnterName": "Please enter a name.",
  "food.errAtLeastOneItem": "Please add at least one ingredient.",
  "food.errSaveFailed": "Save failed: {msg}",
  "food.errApplyFavorite": "Couldn't add favorite. An ingredient may have been deleted.",

  // Today overview
  "food.eaten": "eaten",
  "food.goal": "goal",
  "food.remaining": "left",
  "food.kcalExtra": "+{n} kcal extra",
  "food.stepsSuffix": "  ·  {steps} steps",
  "food.gProtein": "{n} g protein",
  "food.gCarbs": "{n} g carbs",
  "food.gFat": "{n} g fat",
  "food.mProtein": "Protein",
  "food.mCarbs": "Carbs",
  "food.mFat": "Fat",

  // "Just say it" (AI)
  "food.nlTitle": "Write what you ate",
  "food.nlConsentHint": "AI analysis (Anthropic, USA) – optional, revocable in settings.",
  "food.nlPlaceholder": "e.g. 2 eggs, a slice of toast and a coffee",
  "food.nlRecognize": "Recognize automatically",
  "food.nlRecognizePremium": "Premium: Recognize automatically",
  "food.photoBtn": "Photograph meal",
  "food.photoChooseTitle": "Photo of your meal",
  "food.photoCamera": "Camera",
  "food.photoGallery": "From gallery",
  "food.photoCancel": "Cancel",
  "food.photoNothing": "Nothing recognized in the photo. Try a clearer shot from above.",
  "food.photoFailed": "Couldn't process the photo. Please try again.",
  "food.photoNoCamera": "No camera access. Please allow it in iPhone settings.",
  "food.nlNothingRecognized": "Nothing recognized. Try rephrasing it.",
  "food.nlUnavailable": "Recognition is currently unavailable. Please try again later.",
  "food.nlInsertFailed": "Couldn't add: {msg}",

  // Actions
  "food.addAction": "Add",
  "food.scan": "Scan",
  "food.scanLocked": "Scan",

  // Usual day
  "food.usualTitle": "Your usual {meal}",
  "food.aMeal": "meal",
  "food.oneTap": "+ 1 tap",
  "food.usualAdded": "✓ Usual {meal} added",

  // Quick access / diary
  "food.quickAccess": "QUICK ACCESS",
  "food.diary": "DIARY",
  "food.mealEmpty": "Nothing yet – tap ＋",
  "food.entry": "entry",
  "food.foodAdded": "✓ {name} ({amount} {unit}) added",

  // Confirmation dialog (AI recognized)
  "food.nlSheetTitle": "Recognized – does this look right?",
  "food.nlWhichMeal": "Which meal?",
  "food.nlNothingLeft": "Nothing left – tap Cancel.",
  "food.nlEnterAmounts": "Please enter an amount for each.",
  "food.nlAddToDiary": "Add to diary",

  // AI consent
  "food.consentTitle": "Enable AI meal recognition?",
  "food.consentBody": "For “Just say it”, the text you enter (e.g. “2 eggs and a slice of toast”) or your meal photo is sent to our service provider Anthropic (USA) for analysis and broken down into foods with nutritional values. As this may be health data, we need your explicit consent (Art. 9 GDPR).\n\nOptional, revocable in settings at any time. Your inputs are not used for AI training. Please don't enter sensitive data beyond the meal description.",
  "food.consentAccept": "Agree & continue",

  // Dialogs / shared actions
  "food.cancel": "Cancel",
  "food.delete": "Delete",
  "food.notPossible": "Not possible",
  "food.deleteFavoriteTitle": "Delete favorite?",
  "food.deleteFavoriteMsg": "Really delete “{name}”?",
  "food.deleteEntryTitle": "Delete entry?",
  "food.deleteEntryMsg": "Remove this diary entry?",
  "food.deleteFoodTitle": "Delete food?",
  "food.deleteFoodMsg": "Really delete “{name}”?",
  "food.errFoodInUse": "This food is still used in diary entries or recipes and therefore can't be deleted.",

  // Accessibility
  "food.a11yDeleteFood": "Delete {name}",
  "food.a11yDeleteFavorite": "Delete {name}",
  "food.a11yRemoveItem": "Remove {name}",
  "food.a11yRemoveEntry": "Remove {name} from the diary",
  "food.a11yAddToMeal": "Add to {meal}",
  "food.a11yAddUsual": "Add usual {meal}",
  "food.a11yAmountFor": "Amount for {name} in {unit}",
  "food.a11ySaveMealAsFavorite": "Save {meal} as favorite",

  // Meal names (diary sections)
  "food.meal.breakfast": "Breakfast",
  "food.meal.lunch": "Lunch",
  "food.meal.dinner": "Dinner",
  "food.meal.snack": "Snack",
};
