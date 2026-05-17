// Перемикаємося на потрібну базу даних
db = db.getSiblingDB("spotify");

// 1. Видаляємо колекцію tracks, якщо вона існує (для ідемпотентності)
db.tracks.drop();

print("Починаємо трансформацію даних з tracks_raw у tracks...");

// Запускаємо Aggregation Pipeline
db.tracks_raw.aggregate([
  {
    // Крок 2: Залишаємо лише потрібні поля для аналізу
    $project: {
      _id: 1,
      track_id: 1,
      track_name: 1,
      album_name: 1,
      explicit: 1,
      popularity: 1,
      duration_ms: 1,
      track_genre: 1,
      
      // Крок 3 та 5: Розбиваємо рядок артистів по ";" у масив 
      // та за допомогою $map + $trim прибираємо зайві пробіли навколо імен
      /* ОПТИМІЗАЦІЯ:
        Замість створення тимчасового проміжного поля artists_raw (Крок 2) 
        та його подальшого видалення (Крок 5), ми одразу "на льоту" беремо 
        сире поле "$artists" з tracks_raw, розбиваємо його через $split 
        та очищаємо пробіли. Це економить пам'ять та процесорний час кластера.
      */
      
      artists: {
        $map: {
          input: { $split: ["$artists", ";"] },
          as: "artist",
          in: { $trim: { input: "$$artist" } }
        }
      },
      
      // Крок 4.1: Формуємо вкладений об'єкт audio_features
      audio_features: {
        danceability: "$danceability",
        energy: "$energy",
        loudness: "$loudness",
        speechiness: "$speechiness",
        acousticness: "$acousticness",
        instrumentalness: "$instrumentalness",
        liveness: "$liveness",
        valence: "$valence",
        tempo: "$tempo",
        key: "$key",
        mode: "$mode",
        time_signature: "$time_signature"
      },
      
      // Крок 4.2: Обчислюємо тривалість у секундах з округленням до 1 знака
      duration_sec: { 
        $round: [ { $divide: ["$duration_ms", 1000] }, 1 ] 
      },
      
      // Крок 4.3: Створюємо умовне поле popularity_tier через $switch
      popularity_tier: {
        $switch: {
          branches: [
            { case: { $gte: ["$popularity", 70] }, then: "high" },
            { case: { $gte: ["$popularity", 40] }, then: "medium" }
          ],
          default: "low"
        }
      }
    }
  },
  {
    // Крок 6: Зберігаємо результат у нову колекцію tracks
    $out: "tracks"
  }
]);

// Крок 7: Перевірка результату
print("Трансформація завершена успішно!");
print("Кількість документів у новій колекції tracks: " + db.tracks.countDocuments({}));

print("\nПриклад трансформованого документа:");
printjson(db.tracks.findOne());