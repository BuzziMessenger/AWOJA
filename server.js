/* ========================================
   AWOJA Server v3.0 - Complete Platform
   Auth + Maintenance + Vehicle History
   ======================================== */

const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
require('dotenv').config();

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'awoja-secret-key-2024-change-in-production';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://AWOJAVS:AWOJAAUTO@awojavs.t2qpckz.mongodb.net/?appName=AWOJAVS&retryWrites=true&w=majority';
const DB_NAME = process.env.DB_NAME || 'awoja';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// CORS - sta requests toe van alle origins (frontend kan op ander domein draaien)
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parser middleware voor JSON en URL-encoded data
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

// Log alle incoming requests voor debugging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// ========================================
// ALLE API ROUTES MOETEN BOVEN DE SPA FALLBACK STAAN
// ========================================

let db, usersCol, vehiclesCol, recordsCol, historyCol;

// File-based persistent storage (when MongoDB is unavailable)
const fs = require('fs');
const DATA_FILE = path.join(__dirname, 'awoja-data.json');
let memDB = {
    users: [],
    vehicles: [],
    records: [],
    history: [],
    nextId: 1,
};

function loadMemDB() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
            memDB = { ...memDB, ...data };
            console.log(`💾 Data geladen: ${memDB.users.length} users, ${memDB.vehicles.length} vehicles, ${memDB.records.length} records`);
        }
    } catch (e) { console.warn('Kon datafile niet laden:', e.message); }
}

function saveMemDB() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(memDB, null, 2));
    } catch (e) { console.warn('Kon datafile niet opslaan:', e.message); }
}

function genId() { return (memDB.nextId++).toString(); }

// === TEST ROUTE ===
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'AWOJA backend draait!', db: !!db });
});

// ========================================
// DATABASE CONNECTION
// ========================================
async function connectDB() {
    try {
        const client = new MongoClient(MONGODB_URI, {
            serverSelectionTimeoutMS: 8000,
            family: 4, // Force IPv4
        });
        await client.connect();
        db = client.db(DB_NAME);
        usersCol = db.collection('users');
        vehiclesCol = db.collection('vehicles');
        recordsCol = db.collection('maintenance_records');
        historyCol = db.collection('search_history');

        await usersCol.createIndex({ email: 1 }, { unique: true });
        await usersCol.createIndex({ username: 1 }, { unique: true });
        await vehiclesCol.createIndex({ kenteken: 1 });
        await vehiclesCol.createIndex({ ownerId: 1 });
        await recordsCol.createIndex({ kenteken: 1 });
        await recordsCol.createIndex({ createdAt: -1 });
        await historyCol.createIndex({ kenteken: 1 });

        console.log('✅ MongoDB verbonden');
    } catch (error) {
        console.error('❌ MongoDB:', error.message);
        console.log('⚠️  Server draait zonder database');
    }
}

// ========================================
// AUTH MIDDLEWARE
// ========================================
function authMiddleware(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Niet geauthenticeerd' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch {
        res.status(401).json({ error: 'Ongeldige token' });
    }
}

function optionalAuth(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
        try { req.user = jwt.verify(token, JWT_SECRET); } catch {}
    }
    next();
}

// ========================================
// AUTH ROUTES
// ========================================
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password, fullName, userType } = req.body;
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Gebruikersnaam, email en wachtwoord zijn verplicht' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Wachtwoord moet minimaal 6 tekens bevatten' });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const user = {
            username,
            email: email.toLowerCase(),
            password: hashedPassword,
            fullName: fullName || '',
            userType: userType || 'owner',
            createdAt: new Date(),
            garageName: req.body.garageName || '',
        };

        if (usersCol) {
            const existing = await usersCol.findOne({ $or: [{ email: user.email }, { username }] });
            if (existing) return res.status(400).json({ error: 'Email of gebruikersnaam is al in gebruik' });
            const result = await usersCol.insertOne(user);
            const token = jwt.sign({ userId: result.insertedId.toString(), username, email }, JWT_SECRET, { expiresIn: '30d' });
            return res.json({ token, user: { id: result.insertedId, username, email, fullName: user.fullName, userType: user.userType, garageName: user.garageName } });
        }

        // Fallback: in-memory + file persistence
        if (memDB.users.find(u => u.email === user.email || u.username === username)) {
            return res.status(400).json({ error: 'Email of gebruikersnaam is al in gebruik' });
        }
        const id = genId();
        user._id = id;
        memDB.users.push(user);
        saveMemDB();
        const token = jwt.sign({ userId: id, username, email }, JWT_SECRET, { expiresIn: '30d' });
        res.json({ token, user: { id, username, email, fullName: user.fullName, userType: user.userType, garageName: user.garageName } });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Registratie mislukt' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { login, password } = req.body;
        if (!login || !password) return res.status(400).json({ error: 'Vul je inloggegevens in' });

        let user;
        if (usersCol) {
            user = await usersCol.findOne({ $or: [{ email: login.toLowerCase() }, { username: login }] });
        } else {
            user = memDB.users.find(u => u.email === login.toLowerCase() || u.username === login);
        }

        if (!user) return res.status(401).json({ error: 'Ongeldige inloggegevens' });

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return res.status(401).json({ error: 'Ongeldige inloggegevens' });

        const token = jwt.sign({ userId: (user._id || user.id).toString(), username: user.username, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
        res.json({ token, user: { id: user._id || user.id, username: user.username, email: user.email, fullName: user.fullName, userType: user.userType, garageName: user.garageName } });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Inloggen mislukt' });
    }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
    try {
        let user;
        if (usersCol) {
            user = await usersCol.findOne({ _id: new ObjectId(req.user.userId) }, { projection: { password: 0 } });
        } else {
            user = memDB.users.find(u => (u._id || u.id) === req.user.userId);
            if (user) { user = { ...user }; delete user.password; }
        }
        if (!user) return res.status(404).json({ error: 'Gebruiker niet gevonden' });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Kon gebruiker niet ophalen' });
    }
});

// ========================================
// MAINTENANCE RECORDS
// ========================================

// Add a maintenance record
app.post('/api/records', authMiddleware, async (req, res) => {
    try {
        const { kenteken, type, title, description, cost, date, mileage, garage, parts, nextServiceDate, nextServiceMileage } = req.body;

        if (!kenteken || !type || !title) {
            return res.status(400).json({ error: 'Kenteken, type en titel zijn verplicht' });
        }

        if (!recordsCol) {
            // Fallback: in-memory
            const record = {
                kenteken: kenteken.toUpperCase(),
                userId: req.user.userId,
                type, title,
                description: description || '',
                cost: cost ? parseFloat(cost) : 0,
                date: date || new Date().toISOString().split('T')[0],
                mileage: mileage ? parseInt(mileage) : null,
                garage: garage || '',
                parts: parts || [],
                nextServiceDate: nextServiceDate || null,
                nextServiceMileage: nextServiceMileage ? parseInt(nextServiceMileage) : null,
                createdAt: new Date(),
                createdBy: req.user.username,
            };
            const id = genId();
            record._id = id;
            memDB.records.push(record);
            saveMemDB();
            return res.json(record);
        }

        const record = {
            kenteken: kenteken.toUpperCase(),
            userId: req.user.userId,
            type, // 'reparatie', 'onderhoud', 'apk', 'banden', 'schade', 'beurt', 'anders'
            title,
            description: description || '',
            cost: cost ? parseFloat(cost) : 0,
            date: date || new Date().toISOString().split('T')[0],
            mileage: mileage ? parseInt(mileage) : null,
            garage: garage || '',
            parts: parts || [],
            nextServiceDate: nextServiceDate || null,
            nextServiceMileage: nextServiceMileage ? parseInt(nextServiceMileage) : null,
            createdAt: new Date(),
            createdBy: req.user.username,
        };

        const result = await recordsCol.insertOne(record);
        record._id = result.insertedId;

        res.json(record);
    } catch (error) {
        console.error('Add record error:', error);
        res.status(500).json({ error: 'Kon onderhoudsrecord niet toevoegen' });
    }
});

// Get records for a kenteken (public view)
app.get('/api/records/:kenteken', optionalAuth, async (req, res) => {
    try {
        if (!recordsCol) {
            const kenteken = req.params.kenteken.toUpperCase();
            const recs = memDB.records.filter(r => r.kenteken === kenteken).sort((a, b) => (b.date||'').localeCompare(a.date||''));
            return res.json(recs);
        }

        const kenteken = req.params.kenteken.toUpperCase();
        const records = await recordsCol
            .find({ kenteken })
            .sort({ date: -1, createdAt: -1 })
            .toArray();

        res.json(records);
    } catch (error) {
        console.error('Get records error:', error);
        res.status(500).json({ error: 'Kon onderhoudsrecords niet ophalen' });
    }
});

// Get records for kenteken summary (totals, counts)
app.get('/api/records/:kenteken/summary', optionalAuth, async (req, res) => {
    try {
        if (!recordsCol) {
            const kenteken = req.params.kenteken.toUpperCase();
            const recs = memDB.records.filter(r => r.kenteken === kenteken);
            const totalCost = recs.reduce((sum, r) => sum + (r.cost || 0), 0);
            const byType = {};
            recs.forEach(r => { if (!byType[r.type]) byType[r.type] = { count: 0, cost: 0 }; byType[r.type].count++; byType[r.type].cost += (r.cost || 0); });
            return res.json({ totalCost, totalRecords: recs.length, byType });
        }

        const kenteken = req.params.kenteken.toUpperCase();
        const records = await recordsCol.find({ kenteken }).toArray();

        const totalCost = records.reduce((sum, r) => sum + (r.cost || 0), 0);
        const byType = {};
        records.forEach(r => {
            if (!byType[r.type]) byType[r.type] = { count: 0, cost: 0 };
            byType[r.type].count++;
            byType[r.type].cost += (r.cost || 0);
        });

        const lastRecord = records.sort((a, b) => new Date(b.date) - new Date(a.date))[0];

        res.json({
            totalCost,
            totalRecords: records.length,
            byType,
            lastService: lastRecord ? { date: lastRecord.date, type: lastRecord.type, title: lastRecord.title } : null,
        });
    } catch (error) {
        res.status(500).json({ error: 'Kon samenvatting niet ophalen' });
    }
});

// Delete a record (only owner)
app.delete('/api/records/:id', authMiddleware, async (req, res) => {
    try {
        if (!recordsCol) return res.status(503).json({ error: 'Database niet beschikbaar' });

        const record = await recordsCol.findOne({ _id: new ObjectId(req.params.id) });
        if (!record) return res.status(404).json({ error: 'Record niet gevonden' });
        if (record.userId !== req.user.userId) {
            return res.status(403).json({ error: 'Geen toegang' });
        }

        await recordsCol.deleteOne({ _id: new ObjectId(req.params.id) });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Kon record niet verwijderen' });
    }
});

// ========================================
// MY VEHICLES (owned by user)
// ========================================
app.post('/api/my-vehicles', authMiddleware, async (req, res) => {
    try {
        const { kenteken, alias } = req.body;
        if (!kenteken) return res.status(400).json({ error: 'Kenteken is verplicht' });
        if (!vehiclesCol) return res.status(503).json({ error: 'Database niet beschikbaar' });

        const vehicle = {
            kenteken: kenteken.toUpperCase(),
            ownerId: req.user.userId,
            alias: alias || '',
            addedAt: new Date(),
        };

        await vehiclesCol.replaceOne(
            { kenteken: vehicle.kenteken, ownerId: vehicle.ownerId },
            vehicle,
            { upsert: true }
        );

        res.json(vehicle);
    } catch (error) {
        res.status(500).json({ error: 'Kon voertuig niet toevoegen' });
    }
});

app.get('/api/my-vehicles', authMiddleware, async (req, res) => {
    try {
        if (!vehiclesCol) return res.json([]);
        const vehicles = await vehiclesCol.find({ ownerId: req.user.userId }).toArray();
        res.json(vehicles);
    } catch (error) {
        res.status(500).json({ error: 'Kon voertuigen niet ophalen' });
    }
});

app.delete('/api/my-vehicles/:kenteken', authMiddleware, async (req, res) => {
    try {
        if (!vehiclesCol) return res.status(503).json({ error: 'Database niet beschikbaar' });
        await vehiclesCol.deleteOne({ kenteken: req.params.kenteken.toUpperCase(), ownerId: req.user.userId });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Kon voertuig niet verwijderen' });
    }
});

// ========================================
// GARAGE ROUTES
// ========================================
app.get('/api/garage/records', authMiddleware, async (req, res) => {
    try {
        if (!recordsCol || !usersCol) return res.json([]);
        const user = await usersCol.findOne({ _id: new ObjectId(req.user.userId) });
        if (!user || (user.userType !== 'garage' && user.userType !== 'both')) {
            return res.status(403).json({ error: 'Geen garage account' });
        }

        const records = await recordsCol.find({ createdBy: user.username })
            .sort({ createdAt: -1 })
            .limit(100)
            .toArray();
        res.json(records);
    } catch (error) {
        res.status(500).json({ error: 'Kon garage records niet ophalen' });
    }
});

// ========================================
// FAVORITES & HISTORY (legacy support)
// ========================================
app.post('/api/history', async (req, res) => {
    try {
        const { kenteken, merk, handelsbenaming, kleur } = req.body;
        if (!kenteken || !historyCol) return res.json({});
        const entry = { kenteken: kenteken.toUpperCase(), merk: merk || '', handelsbenaming: handelsbenaming || '', kleur: kleur || '', searchedAt: new Date() };
        await historyCol.deleteOne({ kenteken: entry.kenteken });
        await historyCol.insertOne(entry);
        res.json(entry);
    } catch { res.json({}); }
});

app.get('/api/history', async (req, res) => {
    try {
        if (!historyCol) return res.json([]);
        const data = await historyCol.find({}).sort({ searchedAt: -1 }).limit(20).toArray();
        res.json(data);
    } catch { res.json([]); }
});

app.delete('/api/history', async (req, res) => {
    try {
        if (historyCol) await historyCol.deleteMany({});
        res.json({ success: true });
    } catch { res.json({ success: true }); }
});

// ========================================
// SPA FALLBACK - na alle API routes
// ========================================
app.use((req, res, next) => {
    // Alleen niet-API, niet-static routes doorsturen naar index.html
    if (!req.path.startsWith('/api/') && !req.path.startsWith('/') && req.method === 'GET') {
        res.sendFile(path.join(__dirname, 'index.html'));
    } else if (!req.path.startsWith('/api/') && req.method === 'GET') {
        res.sendFile(path.join(__dirname, 'index.html'));
    } else {
        next();
    }
});

// ========================================
// START
// ========================================
async function start() {
    loadMemDB();
    await connectDB();
    app.listen(PORT, () => {
        console.log(`\n🚗 AWOJA v3.0 draait op http://localhost:${PORT}`);
        console.log(`   Database: ${db ? '✅ Verbonden (MongoDB)' : '⚠️ File-opslag (awoja-data.json)'}\n`);
    });
}

start();