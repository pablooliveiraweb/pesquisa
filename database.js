const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Usar um arquivo SQLite para persistência
const dbPath = path.resolve(__dirname, 'votos.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS votos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT,
        cpf TEXT,
        bairro TEXT,
        telefone TEXT,
        respostas TEXT
    )`);
});

module.exports = db;
