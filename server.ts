import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import multer from "multer";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(process.cwd(), "worship.db");
const uploadDir = path.join(process.cwd(), "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({ dest: uploadDir });
console.log(`Initializing database at: ${dbPath}`);

let db: Database.Database;
try {
  db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  console.log("Database connection established successfully.");
} catch (error) {
  console.error("Failed to connect to database:", error);
  process.exit(1);
}

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    roles TEXT NOT NULL, -- Comma separated roles
    only_sundays INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    type TEXT NOT NULL -- 'Quarta', 'Sexta', 'Domingo Manhã', 'Domingo Noite'
  );

  CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id INTEGER NOT NULL,
    member_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
  );
`);

const memberCount = db.prepare("SELECT COUNT(*) as count FROM members").get() as { count: number };
console.log(`Database initialized. Current member count: ${memberCount.count}`);

// Migration: Add columns if they don't exist
try {
  db.prepare("ALTER TABLE members ADD COLUMN only_sundays INTEGER DEFAULT 0").run();
  console.log("Migration: Added only_sundays column");
} catch (e) {}

try {
  db.prepare("ALTER TABLE members ADD COLUMN is_active INTEGER DEFAULT 1").run();
  console.log("Migration: Added is_active column");
} catch (e) {}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  
  // Members
  app.get("/api/members", (req, res) => {
    try {
      const members = db.prepare("SELECT * FROM members ORDER BY name").all();
      res.json(members);
    } catch (error) {
      console.error("Error fetching members:", error);
      res.status(500).json({ error: "Failed to fetch members" });
    }
  });

  app.post("/api/members", (req, res) => {
    try {
      const { name, roles, only_sundays, is_active } = req.body;
      const info = db.prepare("INSERT INTO members (name, roles, only_sundays, is_active) VALUES (?, ?, ?, ?)").run(
        name, 
        roles, 
        only_sundays ? 1 : 0, 
        is_active !== undefined ? (is_active ? 1 : 0) : 1
      );
      res.json({ id: info.lastInsertRowid, name, roles, only_sundays, is_active });
    } catch (error) {
      console.error("Error adding member:", error);
      res.status(500).json({ error: "Failed to add member" });
    }
  });

  app.put("/api/members/:id", (req, res) => {
    try {
      const { name, roles, only_sundays, is_active } = req.body;
      db.prepare("UPDATE members SET name = ?, roles = ?, only_sundays = ?, is_active = ? WHERE id = ?").run(
        name, 
        roles, 
        only_sundays ? 1 : 0, 
        is_active ? 1 : 0, 
        req.params.id
      );
      res.json({ id: req.params.id, name, roles, only_sundays, is_active });
    } catch (error) {
      console.error("Error updating member:", error);
      res.status(500).json({ error: "Failed to update member" });
    }
  });

  app.delete("/api/members/:id", (req, res) => {
    try {
      db.prepare("DELETE FROM members WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting member:", error);
      res.status(500).json({ error: "Failed to delete member" });
    }
  });

  // Services & Assignments
  app.get("/api/schedule", (req, res) => {
    try {
      const { start, end } = req.query;
      const services = db.prepare("SELECT * FROM services WHERE date BETWEEN ? AND ? ORDER BY date").all(start, end);
      
      const schedule = services.map((service: any) => {
        const assignments = db.prepare(`
          SELECT a.id, a.role, m.name, m.id as member_id 
          FROM assignments a 
          JOIN members m ON a.member_id = m.id 
          WHERE a.service_id = ?
        `).all(service.id);
        return { ...service, assignments };
      });
      
      res.json(schedule);
    } catch (error) {
      console.error("Error fetching schedule:", error);
      res.status(500).json({ error: "Failed to fetch schedule" });
    }
  });

  app.post("/api/services", (req, res) => {
    try {
      const { date, type } = req.body;
      // Check if service already exists
      let service: any = db.prepare("SELECT * FROM services WHERE date = ? AND type = ?").get(date, type);
      if (!service) {
        const info = db.prepare("INSERT INTO services (date, type) VALUES (?, ?)").run(date, type);
        service = { id: info.lastInsertRowid, date, type };
      }
      res.json(service);
    } catch (error) {
      console.error("Error creating service:", error);
      res.status(500).json({ error: "Failed to create service" });
    }
  });

  app.delete("/api/services/:id", (req, res) => {
    try {
      db.prepare("DELETE FROM services WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting service:", error);
      res.status(500).json({ error: "Failed to delete service" });
    }
  });

  app.post("/api/assignments", (req, res) => {
    try {
      const { service_id, member_id, role } = req.body;
      // Remove existing assignment for this role in this service
      db.prepare("DELETE FROM assignments WHERE service_id = ? AND role = ?").run(service_id, role);
      
      if (member_id) {
        db.prepare("INSERT INTO assignments (service_id, member_id, role) VALUES (?, ?, ?)").run(service_id, member_id, role);
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating assignment:", error);
      res.status(500).json({ error: "Failed to update assignment" });
    }
  });

  app.get("/api/backup", (req, res) => {
    try {
      res.download(dbPath, "backup_louvor.db");
    } catch (error) {
      console.error("Error downloading backup:", error);
      res.status(500).send("Failed to download backup");
    }
  });

  app.post("/api/restore", upload.single('backup'), async (req: any, res) => {
    try {
      console.log("Restore request received");
      if (!req.file) {
        console.error("No file uploaded in restore request");
        return res.status(400).json({ error: "No file uploaded" });
      }

      const backupPath = req.file.path;
      console.log(`Restoring from: ${backupPath}`);
      
      // Close the current database connection
      console.log("Closing current database connection...");
      db.close();
      
      // Replace the current database file with the uploaded one
      console.log(`Copying ${backupPath} to ${dbPath}...`);
      fs.copyFileSync(backupPath, dbPath);
      
      // Delete the temporary uploaded file
      console.log("Deleting temporary backup file...");
      fs.unlinkSync(backupPath);

      // Re-initialize the main database connection
      console.log("Re-initializing database connection...");
      db = new Database(dbPath);
      db.pragma('foreign_keys = ON');

      console.log("Database restored successfully");
      res.json({ success: true, message: "Database restored successfully" });
    } catch (error) {
      console.error("Error restoring backup:", error);
      // Ensure db is re-opened if something fails
      try { 
        db = new Database(dbPath); 
        db.pragma('foreign_keys = ON'); 
        console.log("Database re-opened after failed restore attempt");
      } catch(e) {
        console.error("Failed to re-open database after restore error:", e);
      }
      res.status(500).json({ error: "Failed to restore backup" });
    }
  });

  // Simple login endpoint
  app.post("/api/login", express.json(), (req, res) => {
    const { username, password } = req.body;
    
    if (username === "admin" && password === "admin123") {
      return res.json({ role: "admin", name: "Administrador" });
    } else if (username === "membro" && password === "membro123") {
      return res.json({ role: "membro", name: "Membro" });
    } else {
      return res.status(401).json({ error: "Usuário ou senha inválidos" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
