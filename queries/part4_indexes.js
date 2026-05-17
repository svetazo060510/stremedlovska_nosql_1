db = db.getSiblingDB("spotify");

// ======= ЗАВДАННЯ 1. ========
print("=== ЗАВДАННЯ 1. ОПТИМІЗАЦІЯ ТА СКЛАДЕНІ ІНДЕКСИ ===");

// Перед початком тесту видалимо старі індекси для чистоти експерименту
try { db.tracks.dropIndex("track_genre_1_popularity_-1_audio_features.danceability_1"); } catch(e) {}
try { db.tracks.dropIndex("track_genre_1"); } catch(e) {}

print("\n--- 1. АНАЛІЗ ЗАПИТУ БЕЗ ІНДЕКСІВ (COLLSCAN + Сортування в пам'яті) ---");

const statsBefore = db.tracks.find({
  track_genre: "pop",
  "audio_features.danceability": { $gte: 0.7 }
}).sort({ popularity: -1 }).explain("executionStats");

print("Час виконання (executionTimeMillis): " + statsBefore.executionStats.executionTimeMillis + " мс");
print("Головна стадія (stage): " + statsBefore.executionStats.executionStages.stage);
print("Перевірено документів (docsExamined): " + statsBefore.executionStats.totalDocsExamined);

// Перевіряємо, чи було сортування в пам'яті (InMemory Sort)
let hasInMemorySort = JSON.stringify(statsBefore).includes("SORT");
print("Чи використовувалось сортування в оперативній пам'яті: " + (hasInMemorySort ? "ТАК (Ресурсоємно)" : "НІ"));


print("\n--- 2. СТВОРЕННЯ ОПТИМАЛЬНОГО СКЛАДЕНОГО ІНДЕКСУ ЗА ПРАВИЛОМ ESR ---");
// Створюємо Compound Index: Equality -> Sort -> Range
db.tracks.createIndex({
  "track_genre": 1,
  "popularity": -1,
  "audio_features.danceability": 1
});
print("Складений індекс успішно створено!");


print("\n--- 3. АНАЛІЗ ЗАПИТУ ЗІ СТВОРЕНИМ ІНДЕКСОМ (IXSCAN) ---");

const statsAfter = db.tracks.find({
  track_genre: "pop",
  "audio_features.danceability": { $gte: 0.7 }
}).sort({ popularity: -1 }).explain("executionStats");

print("Час виконання (executionTimeMillis): " + statsAfter.executionStats.executionTimeMillis + " мс");

// Дістаємо стадію індексного сканування
let winningStage = statsAfter.executionStats.executionStages.stage;
if (winningStage === "FETCH") {
  winningStage += " -> " + statsAfter.executionStats.executionStages.inputStage.stage;
}
print("Нова стадія виконання (stage): " + winningStage);
print("Перевірено документів з диска (docsExamined): " + statsAfter.executionStats.totalDocsExamined);
print("Повернуто документів (nReturned): " + statsAfter.executionStats.nReturned);

// ======= ЗАВДАННЯ 2. ========
print("\n========================================================");
print("=== ЗАВДАННЯ 2. Індекс для полів фонової роботи ===");

// Перед тестом видалимо цей індекс для чистоти експерименту
try { db.tracks.dropIndex("explicit_1_audio_features.instrumentalness_1_audio_features.speechiness_1"); } catch(e) {}

print("\n--- 1. АНАЛІЗ ЗАПИТУ ФОНУ БЕЗ ЦІЛЬОВОГО ІНДЕКСУ ---");
// Запит, що шукає треки для фонової роботи
const focusStatsBefore = db.tracks.find({
  "audio_features.instrumentalness": { $gt: 0.5 },
  "audio_features.speechiness": { $lt: 0.1 },
  "explicit": false
}).explain("executionStats");

print("Час виконання до (executionTimeMillis): " + focusStatsBefore.executionStats.executionTimeMillis + " мс");
print("Стадія до (stage): " + focusStatsBefore.executionStats.executionStages.stage);
print("Перевірено документів до (docsExamined): " + focusStatsBefore.executionStats.totalDocsExamined);


print("\n--- 2. СТВОРЕННЯ СКЛАДЕНОГО ІНДЕКСУ (ESR: explicit -> instrumentalness -> speechiness) ---");
db.tracks.createIndex({
  "explicit": 1,
  "audio_features.instrumentalness": 1,
  "audio_features.speechiness": 1
});
print("Новий складений індекс успішно створено!");


print("\n--- 3. АНАЛІЗ ЗАПИТУ З НОВИМ СТВОРЕНИМ ІНДЕКСОМ ---");
const focusStatsAfter = db.tracks.find({
  "audio_features.instrumentalness": { $gt: 0.5 },
  "audio_features.speechiness": { $lt: 0.1 },
  "explicit": false
}).explain("executionStats");

print("Час виконання після (executionTimeMillis): " + focusStatsAfter.executionStats.executionTimeMillis + " мс");

// Перевіряємо стадію виконання
let focusWinningStage = focusStatsAfter.executionStats.executionStages.stage;
if (focusWinningStage === "FETCH") {
  focusWinningStage += " -> " + focusStatsAfter.executionStats.executionStages.inputStage.stage;
}
print("Нова стадія виконання (stage): " + focusWinningStage);
print("Перевірено документів з диска після (docsExamined): " + focusStatsAfter.executionStats.totalDocsExamined);
print("Повернуто цільових документів (nReturned): " + focusStatsAfter.executionStats.nReturned);

// ======= ЗАВДАННЯ 3. ========
print("\n========================================================");
print("=== ЗАВДАННЯ 3. Покривний запит (Covered Query) ===");

// Переконуємося, що індекс із завдання існує
db.tracks.createIndex({
  "track_genre": 1,
  "popularity": -1,
  "audio_features.danceability": 1
});

print("\n--- АНАЛІЗ ОРИГІНАЛЬНОГО ЗАПИТУ (Без проєкції) ---");
const coveredStatsBefore = db.tracks.find({
  track_genre: "pop",
  popularity: { $gte: 70 }
}).explain("executionStats");

print("Час виконання (executionTimeMillis): " + coveredStatsBefore.executionStats.executionTimeMillis + " мс");
print("Стадія виконання (stage): " + coveredStatsBefore.executionStats.executionStages.stage);
print("Чи є запит покривним (totalDocsExamined == 0)? ");
print(" -> Перевірено документів з диска (docsExamined): " + coveredStatsBefore.executionStats.totalDocsExamined);


print("\n--- АНАЛІЗ ОПТИМІЗОВАНОГО ЗАПИТУ (З проєкцією по індексу) ---");
const coveredStatsAfter = db.tracks.find({
  track_genre: "pop",
  popularity: { $gte: 70 }
}, {
  _id: 0,
  track_genre: 1,
  popularity: 1
}).explain("executionStats");

print("Час виконання (executionTimeMillis): " + coveredStatsAfter.executionStats.executionTimeMillis + " мс");
print("Нова стадія виконання (stage): " + coveredStatsAfter.executionStats.executionStages.stage);
print("Чи є запит покривним тепер? ");
print(" -> Перевірено документів з диска (docsExamined): " + coveredStatsAfter.executionStats.totalDocsExamined);