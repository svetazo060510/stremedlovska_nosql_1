// Перемикаємося на базу даних spotify
db = db.getSiblingDB("spotify");

// ======= ЗАВДАННЯ 1. ========
print("=== ЗАВДАННЯ 1. Топ-10 виконавців за середньою популярністю ===");

const topArtists = db.tracks.aggregate([
  // 1. Розгортаємо масив артистів, щоб врахувати трек для кожного виконавця окремо
  { $unwind: "$artists" },
  
  // 2. Групуємо за іменем виконавця та рахуємо метрики
  {
    $group: {
      _id: "$artists",
      track_count: { $sum: 1 },
      avg_popularity: { $avg: "$popularity" }
    }
  },
  
  // 3. Відсікаємо виконавців, у яких менше 5 треків
  {
    $match: {
      track_count: { $gte: 5 }
    }
  },
  
  // 4. Сортуємо за спаданням середньої популярності
  {
    $sort: { avg_popularity: -1 }
  },
  
  // 5. Беремо перші 10 результатів
  { $limit: 10 },
  
  // 6. Форматуємо вивід відповідно до вимог
  {
    $project: {
      _id: 0,
      artist_name: "$_id",
      avg_popularity: { $round: ["$avg_popularity", 1] }
    }
  }
]);

// Виводимо топ-10 у консоль
while (topArtists.hasNext()) {
  printjson(topArtists.next());
}

// ======= ЗАВДАННЯ 2. ========
print("\n=== ЗАВДАННЯ 2. Розподіл треків за настроєм ===");

const moodDistribution = db.tracks.aggregate([
  // 1. Етап проєкції: визначаємо настрій для кожного треку через $switch
  {
    $project: {
      mood: {
        $switch: {
          branches: [
            {
              // високий valence (>= 0.5) + висока energy (>= 0.5) → happy
              case: { $and: [ { $gte: ["$audio_features.valence", 0.5] }, { $gte: ["$audio_features.energy", 0.5] } ] },
              then: "happy"
            },
            {
              // низький valence (< 0.5) + висока energy (>= 0.5) → angry
              case: { $and: [ { $lt: ["$audio_features.valence", 0.5] }, { $gte: ["$audio_features.energy", 0.5] } ] },
              then: "angry"
            },
            {
              // високий valence (>= 0.5) + низька energy (< 0.5) → calm
              case: { $and: [ { $gte: ["$audio_features.valence", 0.5] }, { $lt: ["$audio_features.energy", 0.5] } ] },
              then: "calm"
            }
          ],
          // якщо жоден кейс не підійшов (обидва < 0.5) → sad
          default: "sad"
        }
      }
    }
  },
  
  // 2. Етап групування: рахуємо кількість треків у кожній категорії настрою
  {
    $group: {
      _id: "$mood",
      track_count: { $sum: 1 }
    }
  },
  
  // 3. Форматуємо фінальний вигляд результату
  {
    $project: {
      _id: 0,
      mood: "$_id",
      track_count: 1
    }
  },
  
  // Сортуємо за кількістю треків (від найбільшої до найменшої)
  { $sort: { track_count: -1 } }
]);

// Виводимо результат
while (moodDistribution.hasNext()) {
  printjson(moodDistribution.next());
}

// ======= ЗАВДАННЯ 3. ========
print("\n=== ЗАВДАННЯ 3. Найбільш «танцювальний» жанр ===");

const danceableGenres = db.tracks.aggregate([
  // 1. Групуємо треки за жанрами та вираховуємо середні показники й кількість
  {
    $group: {
      _id: "$track_genre",
      avg_danceability: { $avg: "$audio_features.danceability" },
      avg_energy: { $avg: "$audio_features.energy" },
      avg_valence: { $avg: "$audio_features.valence" },
      total_tracks: { $sum: 1 }
    }
  },
  
  // 2. Фільтруємо жанри, щоб забезпечити статистичну надійність (мінімум 100 треків)
  {
    $match: {
      total_tracks: { $gte: 100 }
    }
  },
  
  // 3. Сортуємо за спаданням середньої танцювальності, щоб топ-жанр опинився першим
  {
    $sort: { avg_danceability: -1 }
  },
  
  // 4. Форматуємо фінальний документ і округлюємо значення для краси
  {
    $project: {
      _id: 0,
      genre: "$_id",
      avg_danceability: { $round: ["$avg_danceability", 3] },
      avg_energy: { $round: ["$avg_energy", 3] },
      avg_valence: { $round: ["$avg_valence", 3] },
      total_tracks: 1
    }
  },
  
  // Обмежуємо вивід топ-5 найтанцювальнішими жанрами для наочності
  { $limit: 5 }
]);

// Виводимо результати в консоль
while (danceableGenres.hasNext()) {
  printjson(danceableGenres.next());
}