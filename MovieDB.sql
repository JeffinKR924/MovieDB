-- CS461 Project 
-- Team 10 - Movies

CREATE TABLE Movies (
    ImdbId VARCHAR(32) PRIMARY KEY,
    Description VARCHAR(250),
    StarCasts VARCHAR(200) NOT NULL,
    Director VARCHAR(100) NOT NULL,
    Genre VARCHAR(50) NOT NULL,
    ReleaseYear CHAR(4) NOT NULL,
    Ratings REAL NOT NULL,
    CHECK (Ratings >= 0.0 AND Ratings <= 5.0)
);

CREATE TABLE Users (
    UID VARCHAR(32) PRIMARY KEY,
    UserName VARCHAR(50) NOT NULL
);

CREATE TABLE Reviews (
    UID VARCHAR(32),
    ImdbId VARCHAR(32),
    Contents VARCHAR(250),
    Ratings REAL NOT NULL,
    FOREIGN KEY (UID) REFERENCES Users (UID),
    FOREIGN KEY (ImdbId) REFERENCES Movies (ImdbId),
    CHECK (Ratings >= 0.0 AND Ratings <= 5.0)
);
