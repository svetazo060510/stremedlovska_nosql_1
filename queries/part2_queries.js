// Перемикаємося на базу spotify
db = db.getSiblingDB("spotify");

// ======= ЗАВДАННЯ 1. ========
print("=== ЗАВДАННЯ 1. Треки для вечірки ===");

// Шукаємо треки за заданими умовами
const partyTracks = db.tracks.find({
  "audio_features.danceability": { $gt: 0.7 },
  "audio_features.energy": { $gt: 0.7 },
  "duration_ms": { $gte: 180000, $lte: 300000 }
}, {
  // Робимо проєкцію: виводимо лише назву, артистів, жанр та потрібні фічі
  _id: 0,
  track_name: 1,
  artists: 1,
  track_genre: 1,
  "audio_features.danceability": 1,
  "audio_features.energy": 1,
  duration_ms: 1
}).limit(5); // Обмежуємо вивід 5 треками для красивого відображення

// Виводимо результат у консоль
while (partyTracks.hasNext()) {
  printjson(partyTracks.next());
}

// ======= ЗАВДАННЯ 2. ========
print("\n=== ЗАВДАННЯ 2. Виконавці, у яких усі треки популярні ===");

// Запускаємо агрегацію для аналізу артистів
const popularArtists = db.tracks.aggregate([
  // 1. Розгортаємо масив артистів, щоб кожен артист отримав окрему копію документа треку
  { $unwind: "$artists" },
  
  // 2. Групуємо дані за іменем артиста
  {
    $group: {
      _id: "$artists",                          // Групуємо по артисту
      total_tracks: { $sum: 1 },                // Рахуємо загальну кількість треків
      min_popularity: { $min: "$popularity" },  // Знаходимо мінімальну популярність
      avg_popularity: { $avg: "$popularity" }   // Рахуємо середню популярність
    }
  },
  
  // 3. Фільтруємо за умовами: мінімум 3 треки І мінімальна популярність >= 60
  {
    $match: {
      total_tracks: { $gte: 3 },
      min_popularity: { $gte: 60 }
    }
  },
  
  // 4. Сортуємо: спочатку за найвищою середньою популярністю, потім за кількістю треків
  {
    $sort: { avg_popularity: -1, total_tracks: -1 }
  },
  
  // 5. Лімітуємо результат — топ-20 артистів
  { $limit: 20 },
  
  // 6. Форматуємо вивід: округлюємо середню популярність до 1 знака
  {
    $project: {
      _id: 0,
      artist_name: "$_id",
      total_tracks: 1,
      min_popularity: 1,
      avg_popularity: { $round: ["$avg_popularity", 1] }
    }
  }
]);

// Виводимо топ-20 у консоль
while (popularArtists.hasNext()) {
  printjson(popularArtists.next());
}

// ======= ЗАВДАННЯ 3. ========
print("\n=== ЗАВДАННЯ 3. Нетипові треки (Викиди за темпом) ===");

const outlierTracksByGenre = db.tracks.aggregate([
  // 1. Рахуємо середній темп та стандартне відхилення для кожного жанру
  {
    $group: {
      _id: "$track_genre",
      avg_tempo: { $avg: "$audio_features.tempo" },
      std_dev: { $stdDevPop: "$audio_features.tempo" },
      // Тимчасово зберігаємо всі треки жанру, щоб порівняти їх на наступному кроці
      all_tracks: {
        $push: {
          _id: "$_id",
          track_name: "$track_name",
          popularity: "$popularity",
          artists: "$artists",
          tempo: "$audio_features.tempo"
        }
      }
    }
  },
  
  // 2. Розгортаємо треки назад для поштучного порівняння
  { $unwind: "$all_tracks" },
  
  // 3. Фільтруємо лише ті треки, де темп > сер. темп жанру + 2 * стандартні відхилення
  {
    $match: {
      $expr: {
        $gt: [
          "$all_tracks.tempo",
          { $add: ["$avg_tempo", { $multiply: [2, "$std_dev"] }] }
        ]
      }
    }
  },
  
  // 4. Групуємо відфільтровані аномальні треки назад за жанрами
  {
    $group: {
      _id: "$_id",
      avg_tempo: { $first: "$avg_tempo" },
      std_dev: { $first: "$std_dev" },
      outlier_tracks: {
        $push: {
          _id: "$all_tracks._id",
          track_name: "$all_tracks.track_name",
          popularity: "$all_tracks.popularity",
          artists: "$all_tracks.artists",
          audio_features: { tempo: "$all_tracks.tempo" }
        }
      }
    }
  },
  
  // 5. Форматуємо документ відповідно до вимог та округлюємо значення
  {
    $project: {
      _id: 0,
      genre: "$_id",
      avg_tempo: { $round: ["$avg_tempo", 1] },
      outlier_threshold: { 
        $round: [{ $add: ["$avg_tempo", { $multiply: [2, "$std_dev"] }] }, 1] 
      },
      outlier_tracks: 1
    }
  },
  
  // Сортуємо жанри за алфавітом для зручності
  { $sort: { genre: 1 } },
  
  // Обмежуємо вивід першими 3 жанрами в консолі
  { $limit: 3 }
]);

// Виводимо результат
while (outlierTracksByGenre.hasNext()) {
  printjson(outlierTracksByGenre.next());
}

// ======= ЗАВДАННЯ 4. ========
print("\n=== ЗАВДАННЯ 4. Треки для фонової роботи (Deep Focus) ===");

// Шукаємо треки для фокусу
const focusTracks = db.tracks.find({
  "audio_features.loudness": { $lt: -10 },
  "audio_features.speechiness": { $lt: 0.1 },
  "audio_features.instrumentalness": { $gt: 0.5 },
  "explicit": false
}, {
  // Робимо проєкцію, щоб вивести лише релевантні поля
  _id: 0,
  track_name: 1,
  artists: 1,
  track_genre: 1,
  "audio_features.loudness": 1,
  "audio_features.speechiness": 1,
  "audio_features.instrumentalness": 1
}).limit(5); // Обмежуємо вивід 5 треками для красивої демонстрації

// Виводимо результати
while (focusTracks.hasNext()) {
  printjson(focusTracks.next());
}