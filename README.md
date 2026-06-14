# AWOJA - Alles Weten Over Je Auto

🚗 Complete platform voor voertuiggeschiedenis, onderhoudsbeheer en RDW gegevens

## 📋 Overzicht

AWOJA is een professioneel platform dat hobbyisten en garages in staat stelt om complete voertuiginformatie te bekijken, onderhoudsgeschiedenis bij te houden, en alle RDW gegevens te raadplegen.

## 🚀 Live Demo

👉 [https://awoja.onrender.com](https://awoja.onrender.com)

## 🛠️ Functionaliteiten

### 🔍 Voertuig Zoeken
- Zoek op kenteken in de RDW database
- Complete voertuigspecificaties en geschiedenis
- Technische gegevens, gewichten, afmetingen

### 📋 Onderhoudsbeheer
- Voeg reparaties, services en APK keuringen toe
- Gedetailleerde onderhoudstijdlijn
- Kostenoverzicht en statistieken

### 👥 Gebruikersbeheer
- Registratie en authenticatie
- Mijn voertuigen dashboard
- Garage integratie voor professionele gebruikers

### 📊 Extra Features
- Voertuig vergelijkingstool
- QR code generatie voor verkoop
- PDF rapport generatie
- Zoekgeschiedenis

## 💻 Technische Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Node.js, Express
- **Database**: MongoDB (met fallback naar JSON bestand)
- **API**: RDW Open Data integratie
- **Authenticatie**: JWT tokens
- **Styling**: CSS Grid/Flexbox, Font Awesome

## 🔧 Installatie & Configuratie

### Vereisten

- Node.js v18+
- MongoDB Atlas account (optioneel)
- Render account (voor deployment)

### Lokale Installatie

1. **Clone de repository:**
```bash
git clone https://github.com/BuzziMessenger/AWOJAVS.git
cd AWOJAVS
```

2. **Installeer dependencies:**
```bash
npm install
```

3. **Maak een `.env` bestand:**
```env
# Kopieer van .env.example of maak zelf:
PORT=3000
JWT_SECRET=jouw-geheime-sleutel-hier
MONGODB_URI=mongodb+srv://gebruiker:wachtwoord@cluster.mongodb.net/?retryWrites=true&w=majority
DB_NAME=awoja
FRONTEND_URL=http://localhost:3000
```

4. **Start de server:**
```bash
npm start
```

5. **Open in browser:**
```
http://localhost:3000
```

## 🌐 Deployment op Render

### Stappen voor Render Deployment:

1. **Fork deze repository** naar je eigen GitHub account

2. **Maak een MongoDB Atlas database:**
   - Ga naar [MongoDB Atlas](https://www.mongodb.com/atlas/database)
   - Maak een gratis cluster
   - Maak een database gebruiker
   - Voeg je IP adres toe aan de whitelist
   - Kopieer de connection string

3. **Maak een Render account:**
   - Ga naar [Render.com](https://render.com)
   - Maak een gratis account

4. **Nieuw Web Service aanmaken:**
   - Klik op "New" > "Web Service"
   - Kies je GitHub repository
   - Vul de volgende gegevens in:
     - **Name**: AWOJA
     - **Region**: Frankfurt (EU)
     - **Branch**: main
     - **Root Directory**: (leeg laten)
     - **Build Command**: `npm install`
     - **Start Command**: `npm start`
     - **Environment Variables**: Voeg alle variabelen uit je `.env` bestand toe

5. **Deploy en wacht op build:**
   - Render zal automatisch de applicatie bouwen en deployen
   - Dit duurt ongeveer 2-5 minuten

6. **Configureer Custom Domain (optioneel):**
   - Ga naar Settings > Custom Domains
   - Voeg je eigen domein toe (bijv. awoja.nl)

## 📁 Bestandsstructuur

```
.
├── .env                  # Omgevingsvariabelen
├── .gitignore            # Git ignore rules
├── README.md             # Dit bestand
├── app.js                # Frontend JavaScript
├── index.html            # Hoofdpagina
├── package.json          # Node.js configuratie
├── server.js             # Backend server
├── style.css             # CSS stijlen
└── awoja-data.json       # Lokale database (fallback)
```

## 🔐 Beveiliging

- Gebruik sterke JWT secret keys in productie
- Verander de MongoDB wachtwoorden regelmatig
- Gebruik HTTPS voor alle verbindingen
- Implementeer rate limiting voor API endpoints

## 🤝 Bijdragen

Pull requests zijn welkom! Voor grote wijzigingen, open eerst een issue om te bespreken wat je wilt veranderen.

## 📝 Licentie

[MIT License](https://opensource.org/licenses/MIT)

---

**AWOJA © 2024** - Alles Weten Over Je Auto