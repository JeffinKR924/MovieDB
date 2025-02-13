-- CS461 Project 
-- Team 10 - Movies

CREATE TABLE Movies (
    ImdbId VARCHAR(32) PRIMARY KEY,
    Name VARCHAR(255) NOT NULL, -- Added movie name
    Description VARCHAR(4000),
    StarCasts VARCHAR(200) NOT NULL,
    Director VARCHAR(100) NOT NULL,
    Genre VARCHAR(250) NOT NULL,
    ReleaseYear CHAR(4) NOT NULL,
    Ratings REAL NOT NULL,
    CHECK (Ratings >= 0.0 AND Ratings <= 5.0)
);

CREATE TABLE Users (
    UID SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE Reviews (
    ReviewID SERIAL PRIMARY KEY, -- Renamed UID to ReviewID for clarity
    UID INT NOT NULL, -- Changed type to INT to match Users table
    ImdbId VARCHAR(32),
    Contents VARCHAR(250),
    Ratings REAL NOT NULL,
    FOREIGN KEY (UID) REFERENCES Users (UID),
    FOREIGN KEY (ImdbId) REFERENCES Movies (ImdbId),
    CHECK (Ratings >= 0.0 AND Ratings <= 5.0)
);
