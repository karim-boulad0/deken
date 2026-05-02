import Database from 'better-sqlite3';
import path from 'node:path';
import { app } from 'electron';
import { existsSync } from 'node:fs';

// This script is meant to be run in the same environment as the app, 
// but since I'm an agent I'll try to find the DB path.
// On Windows, it's usually %APPDATA%/deken/deken.sqlite or similar.

const dbPath = path.join(process.env.APPDATA || '', 'deken', 'deken.sqlite');
if (existsSync(dbPath)) {
    const db = new Database(dbPath);
    const duplicates = db.prepare(`
        SELECT barcode, COUNT(*) as count 
        FROM products 
        WHERE barcode IS NOT NULL 
        GROUP BY barcode 
        HAVING count > 1
    `).all();
    console.log(JSON.stringify(duplicates));
} else {
    console.log("Database not found at " + dbPath);
}
