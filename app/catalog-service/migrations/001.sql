CREATE TABLE IF NOT EXISTS titles(id BIGINT PRIMARY KEY,name TEXT NOT NULL,genre TEXT NOT NULL,year INT NOT NULL,description TEXT NOT NULL,poster TEXT NOT NULL,duration INT NOT NULL,rating TEXT NOT NULL,media_url TEXT,featured BOOLEAN NOT NULL DEFAULT false);
INSERT INTO titles(id,name,genre,year,description,poster,duration,rating,media_url,featured) VALUES
(1,'Big Buck Bunny','Animation',2008,'A gentle giant discovers that kindness can be the strongest kind of courage.','/assets/poster-1.jpg',10,'PG','https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',True),
(2,'Neon Horizon','Sci-Fi',2025,'A signal from a vanished city draws a pilot beyond the edge of the known world.','/assets/poster-2.svg',118,'13+',NULL,True),
(3,'The Last Orbit','Sci-Fi',2024,'One astronaut. One impossible return. A journey that bends the meaning of home.','/assets/poster-3.svg',104,'13+',NULL,False),
(4,'Wild Earth','Documentary',2025,'Travel through the untouched corners of our planet and the lives that call them home.','/assets/poster-4.svg',52,'All',NULL,True),
(5,'Midnight Run','Thriller',2024,'A courier has one night to deliver the truth before the city wakes.','/assets/poster-5.svg',112,'16+',NULL,False),
(6,'After the Rain','Drama',2023,'Two strangers find a new beginning in the quiet streets of a coastal town.','/assets/poster-6.svg',96,'13+',NULL,False),
(7,'The Summit','Adventure',2025,'A climbing team confronts the mountain they thought they understood.','/assets/poster-7.svg',126,'13+',NULL,False),
(8,'Ocean Between Us','Drama',2024,'Separated by continents, a family reconnects through the stories they share.','/assets/poster-8.svg',108,'13+',NULL,False),
(9,'Circuit Breaker','Action',2025,'An engineer uncovers a conspiracy inside the system she helped build.','/assets/poster-9.svg',121,'16+',NULL,False),
(10,'Golden Hour','Romance',2024,'A summer road trip becomes an unexpected second chance.','/assets/poster-10.svg',101,'13+',NULL,False),
(11,'Beyond the Pines','Adventure',2023,'A hidden trail leads three friends toward a discovery that changes everything.','/assets/poster-11.svg',109,'13+',NULL,False),
(12,'Signal Lost','Thriller',2025,'When every screen goes dark, a small radio station becomes a city’s lifeline.','/assets/poster-12.svg',115,'16+',NULL,False),
(13,'Sintel','Animation',2010,'A young traveler searches for a companion across a world of dragons.','/assets/poster-13.svg',15,'13+','https://storage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',False),
(14,'Tears of Steel','Sci-Fi',2012,'A team in future Amsterdam faces the consequences of a broken promise.','/assets/poster-14.svg',12,'13+','https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',False),
(15,'Cosmos','Documentary',2024,'Explore the astonishing scale and beauty of the night sky.','/assets/poster-15.svg',48,'All',NULL,False),
(16,'Small Worlds','Documentary',2025,'Discover the extraordinary lives that exist beneath our feet.','/assets/poster-16.svg',45,'All',NULL,False)
ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,genre=EXCLUDED.genre,description=EXCLUDED.description,poster=EXCLUDED.poster,media_url=EXCLUDED.media_url;
