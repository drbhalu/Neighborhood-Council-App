const express = require('express');
const sql = require('mssql');
const cors = require('cors');
const multer = require('multer');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// --- MULTER CONFIGURATION FOR PROFILE PICTURES ---
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'profile-pictures/');
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'));
    }
  }
});

// Serve profile pictures as static files
app.use('/profile-pictures', express.static('profile-pictures'));

// --- CONFIGURATION ---
const dbConfig = {
  user: 'sa',
  password: '12345',
  server: 'DESKTOP-J53S96B\\SQLEXPRESS', 
  database: 'NHC_DB',
  options: {
    encrypt: false, 
    trustServerCertificate: true,
    enableArithAbort: true
  }
};

// --- INIT DB ---
async function initDB() {
  try {
    console.log("--- Step 1: Connecting to Master ---");
    const masterPool = new sql.ConnectionPool({ ...dbConfig, database: 'master' });
    await masterPool.connect();
    console.log("✓ Connected to Master successfully.");

    await masterPool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'NHC_DB')
      CREATE DATABASE NHC_DB
    `);
    console.log("✓ Database NHC_DB created/checked.");

    await masterPool.close();

    console.log("--- Step 2: Connecting to NHC_DB ---");
    const nhcPool = new sql.ConnectionPool(dbConfig);
    await nhcPool.connect();
    console.log("✓ Connected to NHC_DB successfully.");

    // Create Table Users
    await nhcPool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Users' AND xtype='U')
      CREATE TABLE Users (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        FirstName NVARCHAR(50),
        LastName NVARCHAR(50),
        Gender NVARCHAR(10),
        CNIC NVARCHAR(20) UNIQUE,
        Phone NVARCHAR(20),
        Address NVARCHAR(200),
        Email NVARCHAR(100),
        Password NVARCHAR(100),
        NHC_Code NVARCHAR(100),
        ProfileImage NVARCHAR(MAX),
        CreatedDate DATETIME DEFAULT GETDATE(),
        Role NVARCHAR(20) DEFAULT 'User'
      )
    `);
    console.log("✓ Table Users ready.");

    // Add NHC_Code column if missing
    await nhcPool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name = N'NHC_Code' AND Object_ID = OBJECT_ID('Users'))
      ALTER TABLE Users ADD NHC_Code NVARCHAR(100);
    `);

    // Add ProfileImage column if missing
    await nhcPool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name = N'ProfileImage' AND Object_ID = OBJECT_ID('Users'))
      ALTER TABLE Users ADD ProfileImage NVARCHAR(MAX);
    `);

    // Clean up any base64 data in ProfileImage (keep only file paths)
    await nhcPool.request().query(`
      UPDATE Users 
      SET ProfileImage = NULL 
      WHERE ProfileImage LIKE 'data:image%'
    `);
    console.log("✓ Cleaned up base64 data from ProfileImage column.");

    // Add Location column if missing
    await nhcPool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name = N'Location' AND Object_ID = OBJECT_ID('Users'))
      ALTER TABLE Users ADD Location NVARCHAR(MAX);
    `);

    // --- NEW: CREATE NOTIFICATIONS TABLE ---
    await nhcPool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Notifications' AND xtype='U')
      CREATE TABLE Notifications (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        RecipientCNIC NVARCHAR(20),
        Message NVARCHAR(MAX),
        CreatedDate DATETIME DEFAULT GETDATE()
      )
    `);
    console.log("✓ Table Notifications ready.");

    // --- NEW: CREATE POSITIONS TABLE ---
    await nhcPool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Positions' AND xtype='U')
      CREATE TABLE Positions (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Name NVARCHAR(100) UNIQUE,
        CreatedDate DATETIME DEFAULT GETDATE()
      )
    `);

    // Seed default positions if table is empty (President, Treasurer, Vice President)
    await nhcPool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM Positions)
      BEGIN
        INSERT INTO Positions (Name) VALUES ('President');
        INSERT INTO Positions (Name) VALUES ('Treasurer');
        INSERT INTO Positions (Name) VALUES ('Vice President');
      END
    `);
    console.log("✓ Table Positions ready and seeded.");

    // Create Table Requests
    await nhcPool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Requests' AND xtype='U')
      CREATE TABLE Requests (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        FirstName NVARCHAR(50),
        LastName NVARCHAR(50),
        CNIC NVARCHAR(20),
        RequestType NVARCHAR(50),
        Message NVARCHAR(MAX),
        Location NVARCHAR(MAX),
        Status NVARCHAR(20) DEFAULT 'Pending',
        CreatedDate DATETIME DEFAULT GETDATE()
      )
    `);
    // Add AssignedNHC column if missing
    await nhcPool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name = N'AssignedNHC' AND Object_ID = OBJECT_ID('Requests'))
      ALTER TABLE Requests ADD AssignedNHC NVARCHAR(100);
    `);
    // Add Location column if missing
    await nhcPool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name = N'Location' AND Object_ID = OBJECT_ID('Requests'))
      ALTER TABLE Requests ADD Location NVARCHAR(MAX);
    `);

    // Create Table NHC_Zones
    await nhcPool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='NHC_Zones' AND xtype='U')
      CREATE TABLE NHC_Zones (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Name NVARCHAR(100),
        ZoneData NVARCHAR(MAX)
      )
    `);

    // Drop NominationDate column if it exists
    await nhcPool.request().query(`
      IF EXISTS (SELECT * FROM sys.columns WHERE Name = N'NominationDate' AND Object_ID = OBJECT_ID('NHC_Zones'))
      ALTER TABLE NHC_Zones DROP COLUMN NominationDate;
    `);

    // Drop ElectionDate column if it exists
    await nhcPool.request().query(`
      IF EXISTS (SELECT * FROM sys.columns WHERE Name = N'ElectionDate' AND Object_ID = OBJECT_ID('NHC_Zones'))
      ALTER TABLE NHC_Zones DROP COLUMN ElectionDate;
    `);

    // Create Nominations Table
    await nhcPool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Nominations' AND xtype='U')
      CREATE TABLE Nominations (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        NHC_Id INT NOT NULL,
        NominationStartDate DATE,
        NominationEndDate DATE,
        CreatedDate DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (NHC_Id) REFERENCES NHC_Zones(Id)
      )
    `);
    
    // Add NominationStartDate column if missing
    await nhcPool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name = N'NominationStartDate' AND Object_ID = OBJECT_ID('Nominations'))
      ALTER TABLE Nominations ADD NominationStartDate DATE;
    `);
    
    // Add NominationEndDate column if missing
    await nhcPool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name = N'NominationEndDate' AND Object_ID = OBJECT_ID('Nominations'))
      ALTER TABLE Nominations ADD NominationEndDate DATE;
    `);
    
    // Drop old NominationDate column if it exists
    await nhcPool.request().query(`
      IF EXISTS (SELECT * FROM sys.columns WHERE Name = N'NominationDate' AND Object_ID = OBJECT_ID('Nominations'))
      ALTER TABLE Nominations DROP COLUMN NominationDate;
    `);
    
    // Add CreatedDate column if missing
    await nhcPool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name = N'CreatedDate' AND Object_ID = OBJECT_ID('Nominations'))
      ALTER TABLE Nominations ADD CreatedDate DATETIME DEFAULT GETDATE();
    `);
    console.log("✓ Table Nominations ready.");

    // Create Elections Table
    await nhcPool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Elections' AND xtype='U')
      CREATE TABLE Elections (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        NHC_Id INT NOT NULL,
        ElectionStartDate DATE,
        ElectionEndDate DATE,
        CreatedDate DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (NHC_Id) REFERENCES NHC_Zones(Id)
      )
    `);
    
    // Add ElectionStartDate column if missing
    await nhcPool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name = N'ElectionStartDate' AND Object_ID = OBJECT_ID('Elections'))
      ALTER TABLE Elections ADD ElectionStartDate DATE;
    `);
    
    // Add ElectionEndDate column if missing
    await nhcPool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name = N'ElectionEndDate' AND Object_ID = OBJECT_ID('Elections'))
      ALTER TABLE Elections ADD ElectionEndDate DATE;
    `);
    
    // Drop old ElectionDate column if it exists
    await nhcPool.request().query(`
      IF EXISTS (SELECT * FROM sys.columns WHERE Name = N'ElectionDate' AND Object_ID = OBJECT_ID('Elections'))
      ALTER TABLE Elections DROP COLUMN ElectionDate;
    `);
    
    // Add CreatedDate column if missing
    await nhcPool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name = N'CreatedDate' AND Object_ID = OBJECT_ID('Elections'))
      ALTER TABLE Elections ADD CreatedDate DATETIME DEFAULT GETDATE();
    `);
    console.log("✓ Table Elections ready.");

    // Create ElectionVotes Table (for tracking votes during election period)
    await nhcPool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ElectionVotes' AND xtype='U')
      CREATE TABLE ElectionVotes (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        ElectionId INT NOT NULL,
        NHC_Id INT,
        VoterCNIC NVARCHAR(20) NOT NULL,
        CandidateId INT,
        ElectionEndDate DATE,
        CreatedDate DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (ElectionId) REFERENCES Elections(Id)
      )
    `);
    
    // Add NHC_Id column if missing
    await nhcPool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name = N'NHC_Id' AND Object_ID = OBJECT_ID('ElectionVotes'))
      ALTER TABLE ElectionVotes ADD NHC_Id INT;
    `);
    
    // Add VoterCNIC column if missing
    await nhcPool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name = N'VoterCNIC' AND Object_ID = OBJECT_ID('ElectionVotes'))
      ALTER TABLE ElectionVotes ADD VoterCNIC NVARCHAR(20);
    `);
    
    // Add CandidateId column if missing
    await nhcPool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name = N'CandidateId' AND Object_ID = OBJECT_ID('ElectionVotes'))
      ALTER TABLE ElectionVotes ADD CandidateId INT;
    `);
    
    // Add ElectionEndDate column if missing
    await nhcPool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name = N'ElectionEndDate' AND Object_ID = OBJECT_ID('ElectionVotes'))
      ALTER TABLE ElectionVotes ADD ElectionEndDate DATE;
    `);
    
    console.log("✓ Table ElectionVotes ready.");
    console.log("✓ Table Elections ready.");

    // Create Candidates Table (self-nominations)
    await nhcPool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Candidates' AND xtype='U')
      CREATE TABLE Candidates (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        CNIC NVARCHAR(20) NOT NULL,
        NHC_Id INT NOT NULL,
        Category NVARCHAR(50) NOT NULL,
        Status NVARCHAR(50) DEFAULT 'Pending',
        NominationEndDate DATE,
        TotalVotes INT DEFAULT 0,
        IsEligible BIT DEFAULT 0,
        CreatedDate DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (NHC_Id) REFERENCES NHC_Zones(Id)
      )
    `);
    
    // Add NominationEndDate column if missing
    await nhcPool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name = N'NominationEndDate' AND Object_ID = OBJECT_ID('Candidates'))
      ALTER TABLE Candidates ADD NominationEndDate DATE;
    `);
    
    // Add TotalVotes column if missing
    await nhcPool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name = N'TotalVotes' AND Object_ID = OBJECT_ID('Candidates'))
      ALTER TABLE Candidates ADD TotalVotes INT DEFAULT 0;
    `);
    
    // Add IsEligible column if missing
    await nhcPool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name = N'IsEligible' AND Object_ID = OBJECT_ID('Candidates'))
      ALTER TABLE Candidates ADD IsEligible BIT DEFAULT 0;
    `);
    
    // Add NominationId FK if missing (link each candidate to a specific nomination period)
    await nhcPool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name = N'NominationId' AND Object_ID = OBJECT_ID('Candidates'))
      ALTER TABLE Candidates ADD NominationId INT, FOREIGN KEY (NominationId) REFERENCES Nominations(Id);
    `);
    
    console.log("✓ Table Candidates ready with NominationId FK.");

    // Create CandidateSupports Table (for tracking supports/votes)
    await nhcPool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='CandidateSupports' AND xtype='U')
      CREATE TABLE CandidateSupports (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        CandidateId INT NOT NULL,
        SupporterCNIC NVARCHAR(20) NOT NULL,
        NHC_Id INT,
        NominationEndDate DATE,
        CreatedDate DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (CandidateId) REFERENCES Candidates(Id)
      )
    `);
    
    // Add NHC_Id column if missing
    await nhcPool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name = N'NHC_Id' AND Object_ID = OBJECT_ID('CandidateSupports'))
      ALTER TABLE CandidateSupports ADD NHC_Id INT;
    `);
    
    // Add NominationEndDate column if missing
    await nhcPool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name = N'NominationEndDate' AND Object_ID = OBJECT_ID('CandidateSupports'))
      ALTER TABLE CandidateSupports ADD NominationEndDate DATE;
    `);
    
    console.log("✓ Table CandidateSupports ready.");

    // Create ElectionResults Table (stores finalized results when election ends)
    await nhcPool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ElectionResults' AND xtype='U')
      CREATE TABLE ElectionResults (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        ElectionId INT NOT NULL,
        NHC_Id INT NOT NULL,
        CandidateId INT NOT NULL,
        CNIC NVARCHAR(20),
        FirstName NVARCHAR(50),
        LastName NVARCHAR(50),
        Category NVARCHAR(50),
        TotalVotes INT DEFAULT 0,
        CreatedDate DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (ElectionId) REFERENCES Elections(Id),
        FOREIGN KEY (NHC_Id) REFERENCES NHC_Zones(Id),
        FOREIGN KEY (CandidateId) REFERENCES Candidates(Id)
      )
    `);
    console.log("✓ Table ElectionResults ready.");

    console.log("✓ All tables initialized successfully.");
    await nhcPool.close();

  } catch (err) {
    console.error("❌ DATABASE INITIALIZATION FAILED:");
    console.error("Error Details:", err); 
  }
}

// --- ROUTES ---

// 1. GET NHC Zones
app.get('/api/nhc', async (req, res) => {
  console.log("GET /api/nhc called...");
  try {
    let pool = await sql.connect(dbConfig);
    let result = await pool.request().query("SELECT * FROM NHC_Zones");
    const zones = result.recordset.map(z => ({ 
        id: z.Id, 
        name: z.Name, 
        points: JSON.parse(z.ZoneData) 
    }));
    res.json(zones);
  } catch (err) {
    console.error("❌ GET Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// 2. CREATE NHC Zone
app.post('/api/nhc', async (req, res) => {
  console.log("POST /api/nhc called...");
  const { name, points } = req.body;
  let pool;
  try {
    pool = await sql.connect(dbConfig);
    const query = "INSERT INTO NHC_Zones (Name, ZoneData) VALUES (@Name, @ZoneData); SELECT SCOPE_IDENTITY() as id";
    const result = await pool.request()
      .input('Name', sql.NVarChar, name)
      .input('ZoneData', sql.NVarChar(sql.MAX), JSON.stringify(points))
      .query(query);
    const id = result.recordset[0].id;
    res.status(201).json({ message: "NHC Created", id: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (pool) await pool.close();
  }
});

// 2.5 SET NOMINATION DATE FOR NHC
app.put('/api/nhc/nomination', async (req, res) => {
  console.log("PUT /api/nhc/nomination called...");
  const { nhcId, nominationStartDate, nominationEndDate } = req.body;
  console.log("📥 Received data:", { nhcId, nominationStartDate, nominationEndDate });
  let pool;
  try {
    pool = await sql.connect(dbConfig);
    
    // Validate dates
    if (!nominationStartDate || !nominationEndDate) {
      return res.status(400).json({ error: 'Both start and end dates are required' });
    }
    
    if (nominationStartDate > nominationEndDate) {
      return res.status(400).json({ error: 'Start date cannot be after end date' });
    }
    
    // Get NHC name
    const nhcResult = await pool.request()
      .input('Id', sql.Int, nhcId)
      .query('SELECT Name FROM NHC_Zones WHERE Id = @Id');
    
    if (nhcResult.recordset.length === 0) {
      return res.status(404).json({ error: 'NHC not found' });
    }
    
    const nhcName = nhcResult.recordset[0].Name;
    
    // Keep historical nominations; DO NOT delete previous records.
    // Deleting old nominations would break FK relationships (Candidates -> Nominations).
    // We insert a new nomination record and keep history for auditing.
    
    // Insert new nomination record
    const result = await pool.request()
      .input('NHC_Id', sql.Int, nhcId)
      .input('NominationStartDate', sql.Date, nominationStartDate)
      .input('NominationEndDate', sql.Date, nominationEndDate)
      .query('INSERT INTO Nominations (NHC_Id, NominationStartDate, NominationEndDate) VALUES (@NHC_Id, @NominationStartDate, @NominationEndDate); SELECT SCOPE_IDENTITY() as id');
    
    const id = result.recordset[0].id;
    console.log("✓ Inserted new nomination record with ID:", id);
    
    // Send notifications to all members of this NHC
    const membersResult = await pool.request()
      .input('NHC_Code', sql.NVarChar, nhcName)
      .query('SELECT CNIC FROM Users WHERE NHC_Code = @NHC_Code');
    
    console.log(`📢 Found ${membersResult.recordset.length} members in NHC: ${nhcName}`);
    
    for (const member of membersResult.recordset) {
      try {
        await pool.request()
          .input('RecipientCNIC', sql.NVarChar, member.CNIC)
          .input('Message', sql.NVarChar(sql.MAX), `Nomination period for ${nhcName} is set from ${nominationStartDate} to ${nominationEndDate}`)
          .query("INSERT INTO Notifications (RecipientCNIC, Message) VALUES (@RecipientCNIC, @Message)");
        console.log(`✓ Notification sent to ${member.CNIC}`);
      } catch (noteErr) {
        console.error(`❌ Failed to send notification to ${member.CNIC}:`, noteErr);
      }
    }
    
    res.status(200).json({ message: "Nomination dates set successfully and notifications sent", id: id });
  } catch (err) {
    console.error("❌ Error setting nomination date:", err);
    res.status(500).json({ error: err.message });
  } finally {
    if (pool) await pool.close();
  }
});

// 2.5 END NOMINATION FOR NHC (mark as ended, preserve history)
app.delete('/api/nhc/nomination/:nhcId', async (req, res) => {
  console.log("DELETE /api/nhc/nomination called...");
  const nhcId = parseInt(req.params.nhcId, 10);
  if (!nhcId) return res.status(400).json({ error: 'nhcId is required' });

  let pool;
  try {
    pool = await sql.connect(dbConfig);
    
    // Mark nomination as ended immediately by setting end date to yesterday
    // This ensures it no longer appears in the "active nominations" query (which is inclusive of today)
    const result = await pool.request()
      .input('NHC_Id', sql.Int, nhcId)
      .query(`
        UPDATE Nominations 
        SET NominationEndDate = DATEADD(day, -1, CAST(GETDATE() AS DATE)) 
        WHERE NHC_Id = @NHC_Id 
        AND NominationEndDate >= CAST(GETDATE() AS DATE)
      `);

    console.log("✓ Marked nomination as ended (set end date to yesterday) for NHC_Id:", nhcId);

    res.status(200).json({ message: "Nomination period ended successfully (history preserved)" });
  } catch (err) {
    console.error("❌ Error ending nomination:", err);
    res.status(500).json({ error: err.message });
  } finally {
    if (pool) await pool.close();
  }
});

// 2.6 SET ELECTION DATE FOR NHC
app.put('/api/nhc/election', async (req, res) => {
  console.log("PUT /api/nhc/election called...");
  const { nhcId, electionStartDate, electionEndDate } = req.body;
  console.log("📥 Received data:", { nhcId, electionStartDate, electionEndDate });
  let pool;
  try {
    pool = await sql.connect(dbConfig);
    
    // Validate dates
    if (!electionStartDate || !electionEndDate) {
      return res.status(400).json({ error: 'Both start and end dates are required' });
    }
    
    if (electionStartDate > electionEndDate) {
      return res.status(400).json({ error: 'Start date cannot be after end date' });
    }
    
    // Get NHC name
    const nhcResult = await pool.request()
      .input('Id', sql.Int, nhcId)
      .query('SELECT Name FROM NHC_Zones WHERE Id = @Id');
    
    if (nhcResult.recordset.length === 0) {
      return res.status(404).json({ error: 'NHC not found' });
    }
    
    const nhcName = nhcResult.recordset[0].Name;
    
    // Keep historical election records and votes for audit purposes.
    // Insert new election record (do not delete previous Elections or ElectionVotes)
    
    // Insert new election record
    const result = await pool.request()
      .input('NHC_Id', sql.Int, nhcId)
      .input('ElectionStartDate', sql.Date, electionStartDate)
      .input('ElectionEndDate', sql.Date, electionEndDate)
      .query('INSERT INTO Elections (NHC_Id, ElectionStartDate, ElectionEndDate) VALUES (@NHC_Id, @ElectionStartDate, @ElectionEndDate); SELECT SCOPE_IDENTITY() as id');
    
    const id = result.recordset[0].id;
    console.log("✓ Inserted new election record with ID:", id);
    
    // Send notifications to all members of this NHC
    const membersResult = await pool.request()
      .input('NHC_Code', sql.NVarChar, nhcName)
      .query('SELECT CNIC FROM Users WHERE NHC_Code = @NHC_Code');
    
    console.log(`📢 Found ${membersResult.recordset.length} members in NHC: ${nhcName}`);
    
    for (const member of membersResult.recordset) {
      try {
        await pool.request()
          .input('RecipientCNIC', sql.NVarChar, member.CNIC)
          .input('Message', sql.NVarChar(sql.MAX), `Election period for ${nhcName} is set from ${electionStartDate} to ${electionEndDate}`)
          .query("INSERT INTO Notifications (RecipientCNIC, Message) VALUES (@RecipientCNIC, @Message)");
        console.log(`✓ Notification sent to ${member.CNIC}`);
      } catch (noteErr) {
        console.error(`❌ Failed to send notification to ${member.CNIC}:`, noteErr);
      }
    }
    
    res.status(200).json({ message: "Election dates set successfully and notifications sent", id: id });
  } catch (err) {
    console.error("❌ Error setting election date:", err);
    res.status(500).json({ error: err.message });
  } finally {
    if (pool) await pool.close();
  }
});

// 2.6A DELETE ELECTIONS FOR NHC
app.delete('/api/nhc/election/:nhcId', async (req, res) => {
  console.log("DELETE /api/nhc/election called...");
  const nhcId = parseInt(req.params.nhcId, 10);
  if (!nhcId) return res.status(400).json({ error: 'nhcId is required' });

  let pool;
  try {
    pool = await sql.connect(dbConfig);
    
    // Get the latest election for this NHC
    const elRes = await pool.request()
      .input('NHC_Id', sql.Int, nhcId)
      .query(`
        SELECT TOP 1 Id, NHC_Id FROM Elections 
        WHERE NHC_Id = @NHC_Id 
        ORDER BY CreatedDate DESC
      `);

    if (elRes.recordset.length === 0) {
      return res.status(404).json({ error: 'Election not found for this NHC' });
    }

    const electionId = elRes.recordset[0].Id;

    // First, calculate and store results from ElectionVotes before marking as ended
    // IMPORTANT: Only include candidates from the LATEST nomination period using NominationId
    const latestNomRes = await pool.request()
      .input('NHC_Id', sql.Int, nhcId)
      .query(`SELECT TOP 1 Id FROM Nominations WHERE NHC_Id = @NHC_Id ORDER BY CreatedDate DESC`);
    
    const latestNominationId = latestNomRes.recordset.length > 0 ? latestNomRes.recordset[0].Id : null;
    
    const resultsData = await pool.request()
      .input('ElectionId', sql.Int, electionId)
      .input('NHC_Id', sql.Int, nhcId)
      .input('NominationId', sql.Int, latestNominationId)
      .query(`
        SELECT 
          c.Id as CandidateId,
          c.CNIC,
          ISNULL(u.FirstName, '') AS FirstName,
          ISNULL(u.LastName, '') AS LastName,
          c.Category,
          ISNULL(v.TotalVotes, 0) AS TotalVotes
        FROM Candidates c
        LEFT JOIN Users u ON c.CNIC = u.CNIC
        LEFT JOIN (
          SELECT CandidateId, COUNT(*) AS TotalVotes FROM ElectionVotes WHERE ElectionId = @ElectionId GROUP BY CandidateId
        ) v ON v.CandidateId = c.Id
        WHERE c.NHC_Id = @NHC_Id AND c.IsEligible = 1
          AND (@NominationId IS NULL OR c.NominationId = @NominationId)
      `);

    // Insert results into ElectionResults table
    for (const candidate of resultsData.recordset) {
      await pool.request()
        .input('ElectionId', sql.Int, electionId)
        .input('NHC_Id', sql.Int, nhcId)
        .input('CandidateId', sql.Int, candidate.CandidateId)
        .input('CNIC', sql.NVarChar, candidate.CNIC)
        .input('FirstName', sql.NVarChar, candidate.FirstName)
        .input('LastName', sql.NVarChar, candidate.LastName)
        .input('Category', sql.NVarChar, candidate.Category)
        .input('TotalVotes', sql.Int, candidate.TotalVotes)
        .query(`
          INSERT INTO ElectionResults (ElectionId, NHC_Id, CandidateId, CNIC, FirstName, LastName, Category, TotalVotes, CreatedDate)
          VALUES (@ElectionId, @NHC_Id, @CandidateId, @CNIC, @FirstName, @LastName, @Category, @TotalVotes, GETDATE())
        `);
    }

    // --- Assign Roles to Winners and reset previous role-holders for this NHC ---
    try {
      // Resolve NHC name
      const nhcNameRes = await pool.request()
        .input('NHC_Id', sql.Int, nhcId)
        .query('SELECT Name FROM NHC_Zones WHERE Id = @NHC_Id');
      const nhcName = nhcNameRes.recordset.length > 0 ? nhcNameRes.recordset[0].Name : null;

      // Reset roles for all positions for users in this NHC (set back to 'User')
      const posRes = await pool.request().query('SELECT Name FROM Positions');
      for (const p of posRes.recordset) {
        try {
          await pool.request()
            .input('NHC_Code', sql.NVarChar, nhcName)
            .input('RoleName', sql.NVarChar, p.Name)
            .query("UPDATE Users SET Role = 'User' WHERE NHC_Code = @NHC_Code AND Role = @RoleName");
        } catch (e) {
          console.error('Failed to reset role for position', p.Name, e);
        }
      }

      // Assign role to each winner (based on Category)
      for (const candidate of resultsData.recordset) {
        try {
          await pool.request()
            .input('CNIC', sql.NVarChar, candidate.CNIC)
            .input('RoleName', sql.NVarChar, candidate.Category)
            .query('UPDATE Users SET Role = @RoleName WHERE CNIC = @CNIC');
          console.log(`✓ Assigned role ${candidate.Category} to user ${candidate.CNIC}`);
        } catch (e) {
          console.error('Failed to assign role to winner', candidate.CNIC, e);
        }
      }
    } catch (roleErr) {
      console.error('Error assigning roles after election:', roleErr);
    }

    // Update the ElectionEndDate to today ONLY for the current election (preserve votes for results/audit)
    await pool.request()
      .input('Id', sql.Int, electionId)
      .query("UPDATE Elections SET ElectionEndDate = CAST(GETDATE() AS DATE) WHERE Id = @Id");

    console.log("✓ Marked election as ended for NHC_Id:", nhcId);
    console.log("✓ Stored", resultsData.recordset.length, "results in ElectionResults table");

    res.status(200).json({ 
      message: "Election ended successfully and results stored",
      resultsStored: resultsData.recordset.length
    });
  } catch (err) {
    console.error("❌ Error deleting election date:", err);
    res.status(500).json({ error: err.message });
  } finally {
    if (pool) await pool.close();
  }
});

// 2.7 GET ALL NOMINATIONS
app.get('/api/nominations', async (req, res) => {
  console.log("GET /api/nominations called...");
  let pool;
  try {
    pool = await sql.connect(dbConfig);
    const result = await pool.request().query(`
      SELECT n.Id, n.NHC_Id, n.NominationStartDate, n.NominationEndDate, n.CreatedDate, nz.Name as NHCName 
      FROM Nominations n
      LEFT JOIN NHC_Zones nz ON n.NHC_Id = nz.Id
      WHERE n.CreatedDate = (
        SELECT MAX(CreatedDate) 
        FROM Nominations n2 
        WHERE n2.NHC_Id = n.NHC_Id
      )
      AND CAST(GETDATE() AS DATE) <= n.NominationEndDate
      ORDER BY n.NominationStartDate DESC
    `);
    console.log("✓ Fetched active nominations:", result.recordset.length);
    res.json(result.recordset);
  } catch (err) {
    console.error("❌ Error fetching nominations:", err);
    res.status(500).json({ error: err.message });
  } finally {
    if (pool) await pool.close();
  }
});

// 2.8 GET ALL ELECTIONS
app.get('/api/elections', async (req, res) => {
  console.log("GET /api/elections called...");
  let pool;
  try {
    pool = await sql.connect(dbConfig);
    const result = await pool.request().query(`
      SELECT e.Id, e.NHC_Id, e.ElectionStartDate, e.ElectionEndDate, e.CreatedDate, nz.Name as NHCName 
      FROM Elections e
      LEFT JOIN NHC_Zones nz ON e.NHC_Id = nz.Id
      WHERE e.CreatedDate = (
        SELECT MAX(CreatedDate) 
        FROM Elections e2 
        WHERE e2.NHC_Id = e.NHC_Id
      )
      AND CAST(GETDATE() AS DATE) < e.ElectionEndDate
      ORDER BY e.ElectionStartDate DESC
    `);
    console.log("✓ Fetched active elections:", result.recordset.length);
    res.json(result.recordset);
  } catch (err) {
    console.error("❌ Error fetching elections:", err);
    res.status(500).json({ error: err.message });
  } finally {
    if (pool) await pool.close();
  }
});

// Get latest election for NHC (including ended elections) - for status checking
app.get('/api/election-by-nhc/:nhcId', async (req, res) => {
  console.log("GET /api/election-by-nhc/:nhcId called...", req.params.nhcId);
  const { nhcId } = req.params;
  let pool;
  try {
    pool = await sql.connect(dbConfig);
    const result = await pool.request()
      .input('NHC_Id', sql.Int, nhcId)
      .query(`
        SELECT e.Id, e.NHC_Id, e.ElectionStartDate, e.ElectionEndDate, e.CreatedDate, nz.Name as NHCName 
        FROM Elections e
        LEFT JOIN NHC_Zones nz ON e.NHC_Id = nz.Id
        WHERE e.NHC_Id = @NHC_Id
        AND e.CreatedDate = (
          SELECT MAX(CreatedDate) 
          FROM Elections e2 
          WHERE e2.NHC_Id = @NHC_Id
        )
        ORDER BY e.CreatedDate DESC
      `);
    console.log("✓ Fetched election for NHC", nhcId, ":", result.recordset.length > 0 ? result.recordset[0] : "None");
    if (result.recordset.length > 0) {
      res.json(result.recordset[0]);
    } else {
      res.status(404).json({ error: 'No election found for this NHC' });
    }
  } catch (err) {
    console.error("❌ Error fetching election by NHC:", err);
    res.status(500).json({ error: err.message });
  } finally {
    if (pool) await pool.close();
  }
});

// Get past election results from ElectionResults table
app.get('/api/election-results/:nhcId', async (req, res) => {
  console.log("GET /api/election-results/:nhcId called...", req.params.nhcId);
  const { nhcId } = req.params;
  let pool;
  try {
    pool = await sql.connect(dbConfig);

    // Fetch results for ALL elections for this NHC, newest first
    const result = await pool.request()
      .input('NHC_Id', sql.Int, nhcId)
      .query(`
        SELECT er.*, e.ElectionStartDate, e.ElectionEndDate FROM ElectionResults er
        JOIN Elections e ON er.ElectionId = e.Id
        WHERE er.NHC_Id = @NHC_Id
        ORDER BY er.ElectionId DESC, er.Category ASC, er.TotalVotes DESC
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'No past election results found' });
    }

    // Group results by election, then by position/category
    const resultsByElection = {};
    result.recordset.forEach(r => {
      const electionId = r.ElectionId;
      if (!resultsByElection[electionId]) {
        resultsByElection[electionId] = {
          electionId,
          electionStartDate: r.ElectionStartDate,
          electionEndDate: r.ElectionEndDate,
          positions: {}
        };
      }

      const category = r.Category || 'Unknown';
      if (!resultsByElection[electionId].positions[category]) {
        resultsByElection[electionId].positions[category] = [];
      }

      resultsByElection[electionId].positions[category].push({
        Id: r.CandidateId,
        CNIC: r.CNIC,
        FirstName: r.FirstName,
        LastName: r.LastName,
        Category: category,
        TotalVotes: r.TotalVotes
      });
    });

    console.log("✓ Fetched past election results for NHC", nhcId);
    res.json(resultsByElection);
  } catch (err) {
    console.error("❌ Error fetching past election results:", err);
    res.status(500).json({ error: err.message });
  } finally {
    if (pool) await pool.close();
  }
});

// 3. SIGN UP USER
app.post('/api/signup', async (req, res) => {
  console.log("POST /api/signup called...");
  const { firstName, lastName, gender, cnic, phone, address, location, email, password, nhcCode, profileImage } = req.body;
  let pool;
  try {
    pool = await sql.connect(dbConfig);
    const result = await pool.request()
      .input('FirstName', sql.NVarChar, firstName)
      .input('LastName', sql.NVarChar, lastName)
      .input('Gender', sql.NVarChar, gender)
      .input('CNIC', sql.NVarChar, cnic)
      .input('Phone', sql.NVarChar, phone)
      .input('Address', sql.NVarChar, address)
      .input('Location', sql.NVarChar(sql.MAX), location)
      .input('Email', sql.NVarChar, email)
      .input('Password', sql.NVarChar, password)
      .input('NHC_Code', sql.NVarChar, nhcCode)
      .input('ProfileImage', sql.NVarChar(sql.MAX), profileImage)
      .query("INSERT INTO Users (FirstName, LastName, Gender, CNIC, Phone, Address, Location, Email, Password, NHC_Code, ProfileImage) VALUES (@FirstName, @LastName, @Gender, @CNIC, @Phone, @Address, @Location, @Email, @Password, @NHC_Code, @ProfileImage); SELECT SCOPE_IDENTITY() as id");
    const id = result.recordset[0].id;
    res.status(201).json({ message: "User Registered", id: id });
  } catch (err) {
    console.error("❌ Signup Error:", err);
    if (err.number === 2627) res.status(400).json({ error: "CNIC already exists" });
    else res.status(500).json({ error: err.message });
  } finally {
    if (pool) await pool.close();
  }
});

// 4. LOGIN USER
app.post('/api/login', async (req, res) => {
  console.log("POST /api/login called...");
  const { cnic, password } = req.body;
  let pool;
  try {
    pool = await sql.connect(dbConfig);
    let result = await pool.request()
      .input('CNIC', sql.NVarChar, cnic)
      .input('Password', sql.NVarChar, password)
      .query("SELECT * FROM Users WHERE CNIC = @CNIC AND Password = @Password");
      
    if (result.recordset.length > 0) {
      const user = result.recordset[0];
      
      // Get NHC_Id from NHC_Code if user has an NHC assigned
      let nhcId = null;
      if (user.NHC_Code) {
        const nhcResult = await pool.request()
          .input('Name', sql.NVarChar, user.NHC_Code)
          .query("SELECT Id FROM NHC_Zones WHERE Name = @Name");
        if (nhcResult.recordset.length > 0) {
          nhcId = nhcResult.recordset[0].Id;
        }
      }
      
      res.status(200).json({ 
        message: "Login Successful", 
        role: user.Role,
        firstName: user.FirstName,
        lastName: user.LastName,
        cnic: user.CNIC,
        nhcCode: user.NHC_Code,
        nhcId: nhcId,
        address: user.Address,
        profileImage: user.ProfileImage
      });
    } else {
      res.status(401).json({ error: "Invalid CNIC or Password" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (pool) await pool.close();
  }
});

// 5. UPDATE USER PROFILE
app.put('/api/user', async (req, res) => {
  console.log("PUT /api/user (Update Profile) called...");
  const { cnic, firstName, lastName, email, phone, address, nhcCode } = req.body;
  let pool;
  try {
    pool = await sql.connect(dbConfig);
    await pool.request()
      .input('CNIC', sql.NVarChar, cnic)
      .input('FirstName', sql.NVarChar, firstName)
      .input('LastName', sql.NVarChar, lastName)
      .input('Email', sql.NVarChar, email)
      .input('Phone', sql.NVarChar, phone)
      .input('Address', sql.NVarChar, address)
      .input('NHC_Code', sql.NVarChar, nhcCode)
      .query("UPDATE Users SET FirstName = @FirstName, LastName = @LastName, Email = @Email, Phone = @Phone, Address = @Address, NHC_Code = @NHC_Code WHERE CNIC = @CNIC");
    res.status(200).json({ message: "Profile Updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (pool) await pool.close();
  }
});

// 6. GET ALL USERS
app.get('/api/users', async (req, res) => {
  let pool;
  try {
    pool = await sql.connect(dbConfig);
    let result = await pool.request().query("SELECT Id, FirstName, LastName, CNIC, Email, Role, NHC_Code, CreatedDate FROM Users ORDER BY CreatedDate DESC");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (pool) await pool.close();
  }
});

// 7. CREATE REQUEST
app.post('/api/request', async (req, res) => {
  console.log("POST /api/request called...");
  const { firstName, lastName, cnic, requestType, message, location } = req.body;
  let pool;
  try {
    pool = await sql.connect(dbConfig);
    const result = await pool.request()
      .input('FirstName', sql.NVarChar, firstName)
      .input('LastName', sql.NVarChar, lastName)
      .input('CNIC', sql.NVarChar, cnic)
      .input('RequestType', sql.NVarChar, requestType)
      .input('Message', sql.NVarChar(sql.MAX), message)
      .input('Location', sql.NVarChar(sql.MAX), location)
      .query("INSERT INTO Requests (FirstName, LastName, CNIC, RequestType, Message, Location) VALUES (@FirstName, @LastName, @CNIC, @RequestType, @Message, @Location); SELECT SCOPE_IDENTITY() as id");
    const id = result.recordset[0].id;
    res.status(201).json({ message: "Request Sent", id: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (pool) await pool.close();
  }
});

// --- NEW NOTIFICATION ROUTES ---

// 8. SEND NOTIFICATION (From Admin)
app.post('/api/notification', async (req, res) => {
  console.log("POST /api/notification called...");
  const { recipientCnic, message } = req.body;
  let pool;
  try {
    pool = await sql.connect(dbConfig);
    const result = await pool.request()
      .input('RecipientCNIC', sql.NVarChar, recipientCnic)
      .input('Message', sql.NVarChar(sql.MAX), message)
      .query("INSERT INTO Notifications (RecipientCNIC, Message) VALUES (@RecipientCNIC, @Message); SELECT SCOPE_IDENTITY() as id");
    
    const id = result.recordset[0].id;
    console.log("✓ Notification Sent with ID:", id);
    res.status(201).json({ message: "Notification Sent", id: id });
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    if (pool) await pool.close();
  }
});

// 9. GET NOTIFICATIONS (For User Dashboard)
app.get('/api/notifications', async (req, res) => {
  const { cnic } = req.query;
  let pool;
  try {
    pool = await sql.connect(dbConfig);
    let result = await pool.request()
      .input('CNIC', sql.NVarChar, cnic)
      .query("SELECT * FROM Notifications WHERE RecipientCNIC = @CNIC ORDER BY CreatedDate DESC");
    
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (pool) await pool.close();
  }
});

// GET single user by CNIC
app.get('/api/user', async (req, res) => {
  const { cnic } = req.query;
  let pool;
  try {
    pool = await sql.connect(dbConfig);
    const result = await pool.request()
      .input('CNIC', sql.NVarChar, cnic)
      .query("SELECT * FROM Users WHERE CNIC = @CNIC");
    if (result.recordset.length > 0) res.json(result.recordset[0]);
    else res.status(404).json({ error: 'User not found' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (pool) await pool.close();
  }
});

// GET all requests (for admin)
app.get('/api/requests', async (req, res) => {
  let pool;
  try {
    pool = await sql.connect(dbConfig);
    const result = await pool.request().query("SELECT * FROM Requests ORDER BY CreatedDate DESC");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (pool) await pool.close();
  }
});

const PORT = 3001;
app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  await initDB();
});

// 10. ASSIGN REQUEST TO AN NHC (Admin action)
app.put('/api/request/assign', async (req, res) => {
  const { requestId, nhcCode } = req.body;
  if (!requestId || !nhcCode) return res.status(400).json({ error: 'requestId and nhcCode required' });
  let pool;
  try {
    pool = await sql.connect(dbConfig);
    // Get request to find CNIC
    const r = await pool.request()
      .input('Id', sql.Int, requestId)
      .query('SELECT * FROM Requests WHERE Id = @Id');
    if (r.recordset.length === 0) return res.status(404).json({ error: 'Request not found' });
    const reqRecord = r.recordset[0];
    const cnic = reqRecord.CNIC;

    // Update user's NHC_Code

    // Update user's NHC_Code
    await pool.request()
      .input('CNIC', sql.NVarChar, cnic)
      .input('NHC_Code', sql.NVarChar, nhcCode)
      .query('UPDATE Users SET NHC_Code = @NHC_Code WHERE CNIC = @CNIC');

    // Update request status and assigned nhc
    await pool.request()
      .input('Id', sql.Int, requestId)
      .input('AssignedNHC', sql.NVarChar, nhcCode)
      .input('Status', sql.NVarChar, 'Created')
      .query("UPDATE Requests SET Status = @Status, AssignedNHC = @AssignedNHC WHERE Id = @Id");

    // Create a notification for the user informing them about the assignment
    try {
      await pool.request()
        .input('RecipientCNIC', sql.NVarChar, cnic)
        .input('Message', sql.NVarChar(sql.MAX), `Your request has been assigned to ${nhcCode}`)
        .query("INSERT INTO Notifications (RecipientCNIC, Message) VALUES (@RecipientCNIC, @Message)");
      console.log('✓ Notification created for', cnic);
    } catch (noteErr) {
      console.error('Notification Insert Error:', noteErr);
    }

    res.json({ message: 'Request assigned, user updated and notified' });
  } catch (err) {
    console.error('Assign Error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (pool) await pool.close();
  }
});

// DELETE a request (Admin)
app.delete('/api/request/:id', async (req, res) => {
  const { id } = req.params;
  let pool;
  try {
    pool = await sql.connect(dbConfig);
    const r = await pool.request()
      .input('Id', sql.Int, id)
      .query('SELECT * FROM Requests WHERE Id = @Id');
    if (r.recordset.length === 0) return res.status(404).json({ error: 'Request not found' });

    await pool.request()
      .input('Id', sql.Int, id)
      .query('DELETE FROM Requests WHERE Id = @Id');

    res.json({ message: 'Request deleted' });
  } catch (err) {
    console.error('Delete Request Error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (pool) await pool.close();
  }
});

// 2.9 GET CANDIDATES FOR NHC (only from current active nomination period)
app.get('/api/candidates', async (req, res) => {
  const nhcId = parseInt(req.query.nhcId, 10);
  const eligibleOnly = req.query.eligible === 'true';
  if (!nhcId) return res.status(400).json({ error: 'nhcId required' });
  let pool;
  try {
    pool = new sql.ConnectionPool(dbConfig);
    await pool.connect();
    const supporterCnic = req.query.supporterCnic || null;

    // Get the latest nomination ID (not just date) for this NHC
    const nomRes = await pool.request()
      .input('NHC_Id', sql.Int, nhcId)
      .query(`
        SELECT TOP 1 Id, NominationEndDate FROM Nominations 
        WHERE NHC_Id = @NHC_Id 
        ORDER BY CreatedDate DESC
      `);
    
    const latestNominationId = nomRes.recordset.length > 0 ? nomRes.recordset[0].Id : null;

    // Get the latest election id for this NHC (if any) so we can include current election vote counts
    const elRes = await pool.request()
      .input('NHC_Id', sql.Int, nhcId)
      .query(`SELECT TOP 1 Id FROM Elections WHERE NHC_Id = @NHC_Id ORDER BY CreatedDate DESC`);
    const latestElectionId = elRes.recordset.length > 0 ? elRes.recordset[0].Id : null;

    const request = pool.request()
      .input('NHC_Id', sql.Int, nhcId)
      .input('SupporterCNIC', sql.NVarChar, supporterCnic)
      .input('EligibleOnly', sql.Bit, eligibleOnly ? 1 : 0)
      .input('NominationId', sql.Int, latestNominationId)
      .input('ElectionId', sql.Int, latestElectionId);

    const result = await request.query(`
      SELECT c.Id, c.CNIC, c.NHC_Id, c.Category, c.Status, c.NominationEndDate, c.IsEligible, c.CreatedDate, 
        u.FirstName, u.LastName,
        ISNULL(c.TotalVotes, 0) AS TotalVotes,
        ISNULL(s.SupportCount, 0) AS SupportCount,
        ISNULL(v2.ElectionVotes, 0) AS ElectionVotes,
        CASE WHEN @SupporterCNIC IS NOT NULL AND EXISTS(SELECT 1 FROM CandidateSupports cs WHERE cs.CandidateId = c.Id AND cs.SupporterCNIC = @SupporterCNIC) THEN 1 ELSE 0 END AS IsSupported
      FROM Candidates c
      LEFT JOIN Users u ON c.CNIC = u.CNIC
      LEFT JOIN (
        SELECT CandidateId, COUNT(*) AS SupportCount FROM CandidateSupports GROUP BY CandidateId
      ) s ON s.CandidateId = c.Id
      LEFT JOIN (
        SELECT CandidateId, COUNT(*) AS ElectionVotes FROM ElectionVotes WHERE ElectionId = @ElectionId GROUP BY CandidateId
      ) v2 ON v2.CandidateId = c.Id
      WHERE c.NHC_Id = @NHC_Id 
        AND (CAST(@EligibleOnly as BIT) = 0 OR c.IsEligible = 1)
        AND (@NominationId IS NULL OR c.NominationId = @NominationId)
      ORDER BY c.TotalVotes DESC, c.CreatedDate DESC
    `);
    
    res.json(result.recordset.map(r => ({ 
      ...r, 
      TotalVotes: r.TotalVotes || 0, 
      SupportCount: r.SupportCount || 0, 
      ElectionVotes: r.ElectionVotes || 0,
      IsSupported: r.IsSupported === 1,
      IsEligible: r.IsEligible === 1
    })));
  } catch (err) {
    console.error('❌ Error fetching candidates:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (pool) await pool.close();
  }
});

// 2.10 SUBMIT SELF NOMINATION
app.post('/api/candidates', async (req, res) => {
  const { cnic, nhcId, category } = req.body;
  if (!cnic || !nhcId || !category) return res.status(400).json({ error: 'cnic, nhcId and category are required' });

  let pool;
  try {
    pool = await sql.connect(dbConfig);

    // Validate category exists in Positions table (allow DB-driven positions)
    let posCheck;
    try {
      posCheck = await pool.request()
        .input('Category', sql.NVarChar, category)
        .query('SELECT Id FROM Positions WHERE Name = @Category');
    } catch (posErr) {
      console.error('❌ Error checking position existence:', posErr);
      return res.status(500).json({ error: 'Failed to validate category' });
    }
    if (!posCheck.recordset || posCheck.recordset.length === 0) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    // Check nomination exists and is within the nomination period
    const nomRes = await pool.request()
      .input('NHC_Id', sql.Int, nhcId)
      .query('SELECT TOP 1 Id, NominationStartDate, NominationEndDate FROM Nominations WHERE NHC_Id = @NHC_Id ORDER BY CreatedDate DESC');

    if (nomRes.recordset.length === 0) {
      return res.status(400).json({ error: 'Nomination period not set for this NHC' });
    }

    const { Id: nominationId, NominationStartDate, NominationEndDate } = nomRes.recordset[0];
    
    // Get local date (not UTC) for proper comparison
    const today = new Date();
    const todayStr = String(today.getFullYear()).padStart(4, '0') + '-' +
                     String(today.getMonth() + 1).padStart(2, '0') + '-' +
                     String(today.getDate()).padStart(2, '0');
    
    // Parse dates from DB
    let startDateStr, endDateStr;
    
    if (NominationStartDate instanceof Date) {
      startDateStr = String(NominationStartDate.getFullYear()).padStart(4, '0') + '-' +
                     String(NominationStartDate.getMonth() + 1).padStart(2, '0') + '-' +
                     String(NominationStartDate.getDate()).padStart(2, '0');
    } else {
      startDateStr = String(NominationStartDate).split('T')[0];
    }
    
    if (NominationEndDate instanceof Date) {
      endDateStr = String(NominationEndDate.getFullYear()).padStart(4, '0') + '-' +
                   String(NominationEndDate.getMonth() + 1).padStart(2, '0') + '-' +
                   String(NominationEndDate.getDate()).padStart(2, '0');
    } else {
      endDateStr = String(NominationEndDate).split('T')[0];
    }
    
    console.log('DEBUG POST /api/candidates - Period Check');
    console.log('  Today:', todayStr);
    console.log('  Start Date:', startDateStr);
    console.log('  End Date:', endDateStr);
    
    if (todayStr < startDateStr || todayStr > endDateStr) {
      return res.status(400).json({ error: 'Nominations are not open today. Nomination period: ' + startDateStr + ' to ' + endDateStr });
    }

    // Prevent duplicate nomination by same user for same NHC in THIS nomination period
    const exist = await pool.request()
      .input('CNIC', sql.NVarChar, cnic)
      .input('NominationId', sql.Int, nominationId)
      .query('SELECT * FROM Candidates WHERE CNIC = @CNIC AND NominationId = @NominationId');

    if (exist.recordset.length > 0) {
      return res.status(400).json({ error: 'You have already nominated for this nomination period' });
    }

    const ins = await pool.request()
      .input('CNIC', sql.NVarChar, cnic)
      .input('NHC_Id', sql.Int, nhcId)
      .input('NominationId', sql.Int, nominationId)
      .input('Category', sql.NVarChar, category)
      .input('NominationEndDate', sql.Date, NominationEndDate)
      .query('INSERT INTO Candidates (CNIC, NHC_Id, NominationId, Category, NominationEndDate, TotalVotes, IsEligible) VALUES (@CNIC, @NHC_Id, @NominationId, @Category, @NominationEndDate, 0, 0); SELECT SCOPE_IDENTITY() as id');

    const id = ins.recordset[0].id;

    // Send confirmation notification to user
    try {
      await pool.request()
        .input('RecipientCNIC', sql.NVarChar, cnic)
        .input('Message', sql.NVarChar(sql.MAX), `Your nomination for ${category} has been received. Voting ends on ${endDateStr}.`)
        .query('INSERT INTO Notifications (RecipientCNIC, Message) VALUES (@RecipientCNIC, @Message)');
    } catch (noteErr) {
      console.error('Notification Insert Error for candidate:', noteErr);
    }

    res.status(201).json({ message: 'Nomination submitted', id });
  } catch (err) {
    console.error('Nomination Error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (pool) await pool.close();
  }
});

// 2.11 SUPPORT A CANDIDATE
app.post('/api/candidates/:id/support', async (req, res) => {
  const candidateId = parseInt(req.params.id, 10);
  const { supporterCnic } = req.body;
  if (!candidateId || !supporterCnic) return res.status(400).json({ error: 'candidate id and supporterCnic required' });

  let pool;
  try {
    pool = await sql.connect(dbConfig);
    
    // Ensure candidate exists and get nomination info and category
    const cRes = await pool.request()
      .input('Id', sql.Int, candidateId)
      .query('SELECT CNIC, NHC_Id, Category, NominationEndDate, NominationId FROM Candidates WHERE Id = @Id');
    if (cRes.recordset.length === 0) return res.status(404).json({ error: 'Candidate not found' });
    
    const { CNIC: candidateCnic, NHC_Id: nhcId, Category: candidateCategory, NominationEndDate, NominationId } = cRes.recordset[0];

    // Prevent supporting yourself
    if (String(candidateCnic) === String(supporterCnic)) {
      return res.status(400).json({ error: 'You cannot support yourself' });
    }
    
    // Check if voting is within the nomination period (use local date)
    const today = new Date();
    const todayStr = String(today.getFullYear()).padStart(4, '0') + '-' +
                     String(today.getMonth() + 1).padStart(2, '0') + '-' +
                     String(today.getDate()).padStart(2, '0');
    
    let endDateStr;
    if (NominationEndDate instanceof Date) {
      endDateStr = String(NominationEndDate.getFullYear()).padStart(4, '0') + '-' +
                   String(NominationEndDate.getMonth() + 1).padStart(2, '0') + '-' +
                   String(NominationEndDate.getDate()).padStart(2, '0');
    } else {
      endDateStr = String(NominationEndDate).split('T')[0];
    }
    
    console.log('DEBUG POST /api/candidates/:id/support - Period Check');
    console.log('  Today:', todayStr);
    console.log('  Nomination End Date:', endDateStr);
    
    if (todayStr > endDateStr) {
      return res.status(400).json({ error: 'Voting period has ended for this nomination. Period ended on: ' + endDateStr });
    }

    // Prevent supporter from supporting more than one candidate in the same category & nomination period
    const alreadySupportedCategory = await pool.request()
      .input('SupporterCNIC', sql.NVarChar, supporterCnic)
      .input('Category', sql.NVarChar, candidateCategory)
      .input('NominationId', sql.Int, NominationId)
      .query(`
        SELECT 1 FROM CandidateSupports cs
        INNER JOIN Candidates c ON cs.CandidateId = c.Id
        WHERE cs.SupporterCNIC = @SupporterCNIC
          AND c.Category = @Category
          AND (@NominationId IS NULL OR c.NominationId = @NominationId)
      `);
    if (alreadySupportedCategory.recordset.length > 0) return res.status(400).json({ error: 'You have already supported a candidate in this category for the current nomination period' });

    // Prevent duplicate support for same candidate
    const exist = await pool.request()
      .input('CandidateId', sql.Int, candidateId)
      .input('SupporterCNIC', sql.NVarChar, supporterCnic)
      .query('SELECT * FROM CandidateSupports WHERE CandidateId = @CandidateId AND SupporterCNIC = @SupporterCNIC');
    if (exist.recordset.length > 0) return res.status(400).json({ error: 'You already supported this candidate' });

    // Insert support with NHC_Id and NominationEndDate for historical tracking
    await pool.request()
      .input('CandidateId', sql.Int, candidateId)
      .input('SupporterCNIC', sql.NVarChar, supporterCnic)
      .input('NHC_Id', sql.Int, nhcId)
      .input('NominationEndDate', sql.Date, NominationEndDate)
      .input('NominationId', sql.Int, NominationId)
      .query('INSERT INTO CandidateSupports (CandidateId, SupporterCNIC, NHC_Id, NominationEndDate, CreatedDate) VALUES (@CandidateId, @SupporterCNIC, @NHC_Id, @NominationEndDate, GETDATE())');

    // Count total supports and update TotalVotes
    const cntRes = await pool.request()
      .input('CandidateId', sql.Int, candidateId)
      .query('SELECT COUNT(*) as cnt FROM CandidateSupports WHERE CandidateId = @CandidateId');
    const totalVotes = cntRes.recordset[0].cnt;

    // Update candidate with total votes
    await pool.request()
      .input('Id', sql.Int, candidateId)
      .input('TotalVotes', sql.Int, totalVotes)
      .query('UPDATE Candidates SET TotalVotes = @TotalVotes WHERE Id = @Id');

    // Check eligibility: must have at least 5 votes to be eligible
    let isEligible = false;
    if (totalVotes >= 5) {
      isEligible = true;
      try {
        await pool.request()
          .input('Id', sql.Int, candidateId)
          .input('IsEligible', sql.Bit, 1)
          .input('Status', sql.NVarChar, 'Eligible')
          .query('UPDATE Candidates SET IsEligible = 1, Status = @Status WHERE Id = @Id');
        console.log(`✓ Candidate ${candidateId} became eligible with ${totalVotes} votes`);
      } catch (e) {
        console.error('Failed to update candidate eligibility:', e);
      }
    }

    res.json({ message: 'Supported', count: totalVotes, isEligible });
  } catch (err) {
    console.error('Support Error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (pool) await pool.close();
  }
});

// 2.12 GET CANDIDATE ELIGIBILITY RESULTS (after nomination period ends)
app.get('/api/candidates/eligibility/results', async (req, res) => {
  const nhcId = parseInt(req.query.nhcId, 10);
  if (!nhcId) return res.status(400).json({ error: 'nhcId required' });
  
  let pool;
  try {
    pool = await sql.connect(dbConfig);
    
    // Get nomination period for this NHC
    const nomRes = await pool.request()
      .input('NHC_Id', sql.Int, nhcId)
      .query('SELECT NominationStartDate, NominationEndDate FROM Nominations WHERE NHC_Id = @NHC_Id');
    
    if (nomRes.recordset.length === 0) {
      return res.status(400).json({ error: 'Nomination period not found for this NHC' });
    }
    
    const { NominationStartDate, NominationEndDate } = nomRes.recordset[0];
    
    // Get all candidates with their eligibility status and total votes
    const result = await pool.request()
      .input('NHC_Id', sql.Int, nhcId)
      .query(`
        SELECT 
          c.Id as CandidateId,
          c.CNIC,
          c.Category,
          c.Status,
          c.IsEligible,
          c.TotalVotes,
          c.NominationEndDate,
          c.CreatedDate as NominationDate,
          u.FirstName,
          u.LastName,
          u.Phone,
          u.Email,
          n.Name as NHCName,
          CASE 
            WHEN c.IsEligible = 1 THEN 'Eligible'
            WHEN c.TotalVotes >= 5 THEN 'Eligible'
            ELSE 'Not Eligible (Need ' + CAST(5 - c.TotalVotes AS NVARCHAR(2)) + ' more votes)'
          END AS EligibilityStatus
        FROM Candidates c
        LEFT JOIN Users u ON c.CNIC = u.CNIC
        LEFT JOIN NHC_Zones n ON c.NHC_Id = n.Id
        WHERE c.NHC_Id = @NHC_Id
        ORDER BY c.TotalVotes DESC, c.CreatedDate ASC
      `);
    
    res.json({
      NominationStartDate,
      NominationEndDate,
      Candidates: result.recordset.map(r => ({
        ...r,
        IsEligible: r.IsEligible === 1
      }))
    });
  } catch (err) {
    console.error('❌ Error fetching eligibility results:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (pool) await pool.close();
  }
});

// 2.13 GET ALL CANDIDATES SUMMARY (for admin dashboard)
app.get('/api/candidates/summary', async (req, res) => {
  const nhcId = parseInt(req.query.nhcId, 10);
  if (!nhcId) return res.status(400).json({ error: 'nhcId required' });
  
  let pool;
  try {
    pool = await sql.connect(dbConfig);
    
    const result = await pool.request()
      .input('NHC_Id', sql.Int, nhcId)
      .query(`
        SELECT 
          COUNT(*) as TotalCandidates,
          SUM(CASE WHEN IsEligible = 1 THEN 1 ELSE 0 END) as EligibleCount,
          SUM(CASE WHEN IsEligible = 0 THEN 1 ELSE 0 END) as NotEligibleCount,
          MAX(TotalVotes) as MaxVotes,
          AVG(CAST(TotalVotes AS FLOAT)) as AvgVotes
        FROM Candidates
        WHERE NHC_Id = @NHC_Id
      `);
    
    res.json(result.recordset[0] || { TotalCandidates: 0, EligibleCount: 0, NotEligibleCount: 0 });
  } catch (err) {
    console.error('❌ Error fetching candidates summary:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (pool) await pool.close();
  }
});

// 2.14 GET SUPPORT HISTORY (who supported whom during nomination period)
app.get('/api/support-history', async (req, res) => {
  const nhcId = parseInt(req.query.nhcId, 10);
  if (!nhcId) return res.status(400).json({ error: 'nhcId required' });
  
  let pool;
  try {
    pool = await sql.connect(dbConfig);
    
    const result = await pool.request()
      .input('NHC_Id', sql.Int, nhcId)
      .query(`
        SELECT 
          cs.Id as SupportId,
          cs.CandidateId,
          cs.NHC_Id,
          cs.SupporterCNIC,
          cs.NominationEndDate,
          cs.CreatedDate as VoteDate,
          c.CNIC as CandidateCNIC,
          c.Category,
          c.TotalVotes as CandidateTotalVotes,
          c.IsEligible as CandidateIsEligible,
          cu.FirstName as CandidateFirstName,
          cu.LastName as CandidateLastName,
          su.FirstName as SupporterFirstName,
          su.LastName as SupporterLastName,
          su.Phone as SupporterPhone,
          su.Email as SupporterEmail,
          nz.Name as NHCName
        FROM CandidateSupports cs
        INNER JOIN Candidates c ON cs.CandidateId = c.Id
        LEFT JOIN Users cu ON c.CNIC = cu.CNIC
        LEFT JOIN Users su ON cs.SupporterCNIC = su.CNIC
        LEFT JOIN NHC_Zones nz ON cs.NHC_Id = nz.Id
        WHERE cs.NHC_Id = @NHC_Id
        ORDER BY cs.CreatedDate DESC
      `);
    
    res.json(result.recordset.map(r => ({
      ...r,
      CandidateIsEligible: r.CandidateIsEligible === 1
    })));
  } catch (err) {
    console.error('❌ Error fetching support history:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (pool) await pool.close();
  }
});

// 2.15 GET SUPPORT HISTORY BY CANDIDATE (all supporters for a specific candidate)
app.get('/api/support-history/candidate/:candidateId', async (req, res) => {
  const candidateId = parseInt(req.params.candidateId, 10);
  if (!candidateId) return res.status(400).json({ error: 'candidateId required' });
  
  let pool;
  try {
    pool = await sql.connect(dbConfig);
    
    const result = await pool.request()
      .input('CandidateId', sql.Int, candidateId)
      .query(`
        SELECT 
          cs.Id as SupportId,
          cs.SupporterCNIC,
          cs.NominationEndDate,
          cs.CreatedDate as VoteDate,
          su.FirstName as SupporterFirstName,
          su.LastName as SupporterLastName,
          su.Phone as SupporterPhone,
          su.Email as SupporterEmail,
          su.Address as SupporterAddress,
          c.CNIC as CandidateCNIC,
          c.Category,
          c.TotalVotes,
          c.IsEligible,
          cu.FirstName as CandidateFirstName,
          cu.LastName as CandidateLastName
        FROM CandidateSupports cs
        INNER JOIN Candidates c ON cs.CandidateId = c.Id
        LEFT JOIN Users cu ON c.CNIC = cu.CNIC
        LEFT JOIN Users su ON cs.SupporterCNIC = su.CNIC
        WHERE cs.CandidateId = @CandidateId
        ORDER BY cs.CreatedDate DESC
      `);
    
    res.json({
      CandidateInfo: result.recordset.length > 0 ? {
        CNIC: result.recordset[0].CandidateCNIC,
        Name: (result.recordset[0].CandidateFirstName || '') + ' ' + (result.recordset[0].CandidateLastName || ''),
        Category: result.recordset[0].Category,
        TotalVotes: result.recordset[0].TotalVotes,
        IsEligible: result.recordset[0].IsEligible === 1
      } : null,
      Supporters: result.recordset.map(r => ({
        SupportId: r.SupportId,
        SupporterCNIC: r.SupporterCNIC,
        SupporterName: (r.SupporterFirstName || '') + ' ' + (r.SupporterLastName || ''),
        SupporterPhone: r.SupporterPhone,
        SupporterEmail: r.SupporterEmail,
        VoteDate: r.VoteDate,
        NominationEndDate: r.NominationEndDate
      }))
    });
  } catch (err) {
    console.error('❌ Error fetching candidate supporters:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (pool) await pool.close();
  }
});

// 2.16 GET SUPPORT STATS (statistics about voting during nomination period)
app.get('/api/support-stats', async (req, res) => {
  const nhcId = parseInt(req.query.nhcId, 10);
  if (!nhcId) return res.status(400).json({ error: 'nhcId required' });
  
  let pool;
  try {
    pool = await sql.connect(dbConfig);
    
    const result = await pool.request()
      .input('NHC_Id', sql.Int, nhcId)
      .query(`
        SELECT 
          COUNT(DISTINCT cs.SupporterCNIC) AS TotalVoters,
          COUNT(cs.Id) AS TotalVotesCast,
          COUNT(DISTINCT cs.CandidateId) AS CandidatesReceivingVotes,
          (SELECT COUNT(*) FROM Candidates WHERE NHC_Id = @NHC_Id AND IsEligible = 1) AS EligibleCandidates,
          (SELECT COUNT(*) FROM Candidates WHERE NHC_Id = @NHC_Id) AS TotalCandidates,
          MAX(cs.CreatedDate) AS LastVoteTime,
          MIN(cs.CreatedDate) AS FirstVoteTime
        FROM CandidateSupports cs
        WHERE cs.NHC_Id = @NHC_Id
      `);
    
    res.json(result.recordset[0] || {
      TotalVoters: 0,
      TotalVotesCast: 0,
      CandidatesReceivingVotes: 0,
      EligibleCandidates: 0,
      TotalCandidates: 0
    });
  } catch (err) {
    console.error('❌ Error fetching support stats:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (pool) await pool.close();
  }
});

// 2.17 CAST ELECTION VOTE
app.post('/api/election-vote', async (req, res) => {
  const { electionId, voterCnic, candidateId } = req.body;
  if (!electionId || !voterCnic || !candidateId) {
    return res.status(400).json({ error: 'electionId, voterCnic, and candidateId are required' });
  }

  let pool;
  try {
    pool = await sql.connect(dbConfig);

    // Get election details
    const elRes = await pool.request()
      .input('Id', sql.Int, electionId)
      .query('SELECT NHC_Id, ElectionStartDate, ElectionEndDate FROM Elections WHERE Id = @Id');
    
    if (elRes.recordset.length === 0) {
      return res.status(404).json({ error: 'Election not found' });
    }

    const { NHC_Id: nhcId, ElectionStartDate, ElectionEndDate } = elRes.recordset[0];

    // Prevent voting for yourself: check candidate CNIC
    const candRes = await pool.request()
      .input('Id', sql.Int, candidateId)
      .query('SELECT CNIC FROM Candidates WHERE Id = @Id');
    if (candRes.recordset.length === 0) return res.status(404).json({ error: 'Candidate not found' });
    const candidateCnic = candRes.recordset[0].CNIC;
    if (String(candidateCnic) === String(voterCnic)) {
      return res.status(400).json({ error: 'You cannot vote for yourself' });
    }

    // Check if voting is within the election period (use local date)
    const today = new Date();
    const todayStr = String(today.getFullYear()).padStart(4, '0') + '-' +
                     String(today.getMonth() + 1).padStart(2, '0') + '-' +
                     String(today.getDate()).padStart(2, '0');
    
    let startDateStr, endDateStr;
    if (ElectionStartDate instanceof Date) {
      startDateStr = String(ElectionStartDate.getFullYear()).padStart(4, '0') + '-' +
                     String(ElectionStartDate.getMonth() + 1).padStart(2, '0') + '-' +
                     String(ElectionStartDate.getDate()).padStart(2, '0');
    } else {
      startDateStr = String(ElectionStartDate).split('T')[0];
    }
    
    if (ElectionEndDate instanceof Date) {
      endDateStr = String(ElectionEndDate.getFullYear()).padStart(4, '0') + '-' +
                   String(ElectionEndDate.getMonth() + 1).padStart(2, '0') + '-' +
                   String(ElectionEndDate.getDate()).padStart(2, '0');
    } else {
      endDateStr = String(ElectionEndDate).split('T')[0];
    }

    console.log('DEBUG POST /api/election-vote - Period Check');
    console.log('  Today:', todayStr);
    console.log('  Start Date:', startDateStr);
    console.log('  End Date:', endDateStr);

    if (todayStr < startDateStr || todayStr > endDateStr) {
      return res.status(400).json({ error: 'Voting is not open. Election period: ' + startDateStr + ' to ' + endDateStr });
    }

    // Prevent duplicate vote
    const exist = await pool.request()
      .input('ElectionId', sql.Int, electionId)
      .input('VoterCNIC', sql.NVarChar, voterCnic)
      .query('SELECT * FROM ElectionVotes WHERE ElectionId = @ElectionId AND VoterCNIC = @VoterCNIC');
    
    if (exist.recordset.length > 0) {
      return res.status(400).json({ error: 'You have already voted in this election' });
    }

    // Insert vote
    const result = await pool.request()
      .input('ElectionId', sql.Int, electionId)
      .input('NHC_Id', sql.Int, nhcId)
      .input('VoterCNIC', sql.NVarChar, voterCnic)
      .input('CandidateId', sql.Int, candidateId)
      .input('ElectionEndDate', sql.Date, ElectionEndDate)
      .query('INSERT INTO ElectionVotes (ElectionId, NHC_Id, VoterCNIC, CandidateId, ElectionEndDate) VALUES (@ElectionId, @NHC_Id, @VoterCNIC, @CandidateId, @ElectionEndDate); SELECT SCOPE_IDENTITY() as id');

    const id = result.recordset[0].id;
    console.log('✓ Vote recorded with ID:', id);

    res.status(201).json({ message: 'Vote recorded successfully', id });
  } catch (err) {
    console.error('Vote Error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (pool) await pool.close();
  }
});

// 2.18 GET ELECTION VOTE HISTORY (who voted for whom in an election)
app.get('/api/election-vote-history', async (req, res) => {
  const electionId = parseInt(req.query.electionId, 10);
  if (!electionId) return res.status(400).json({ error: 'electionId required' });
  
  let pool;
  try {
    pool = await sql.connect(dbConfig);
    
    const result = await pool.request()
      .input('ElectionId', sql.Int, electionId)
      .query(`
        SELECT 
          ev.Id as VoteId,
          ev.ElectionId,
          ev.NHC_Id,
          ev.VoterCNIC,
          ev.CandidateId,
          ev.ElectionEndDate,
          ev.CreatedDate as VoteDate,
          c.CNIC as CandidateCNIC,
          c.Category,
          cu.FirstName as CandidateFirstName,
          cu.LastName as CandidateLastName,
          vu.FirstName as VoterFirstName,
          vu.LastName as VoterLastName,
          vu.Phone as VoterPhone,
          vu.Email as VoterEmail,
          nz.Name as NHCName
        FROM ElectionVotes ev
        INNER JOIN Candidates c ON ev.CandidateId = c.Id
        LEFT JOIN Users cu ON c.CNIC = cu.CNIC
        LEFT JOIN Users vu ON ev.VoterCNIC = vu.CNIC
        LEFT JOIN NHC_Zones nz ON ev.NHC_Id = nz.Id
        WHERE ev.ElectionId = @ElectionId
        ORDER BY ev.CreatedDate DESC
      `);
    
    res.json(result.recordset);
  } catch (err) {
    console.error('❌ Error fetching election vote history:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (pool) await pool.close();
  }
});

// 2.19 GET VOTES FOR A CANDIDATE (in an election)
app.get('/api/election-votes/candidate/:candidateId', async (req, res) => {
  const candidateId = parseInt(req.params.candidateId, 10);
  if (!candidateId) return res.status(400).json({ error: 'candidateId required' });
  
  let pool;
  try {
    pool = await sql.connect(dbConfig);
    
    const result = await pool.request()
      .input('CandidateId', sql.Int, candidateId)
      .query(`
        SELECT 
          ev.Id as VoteId,
          ev.VoterCNIC,
          ev.ElectionEndDate,
          ev.CreatedDate as VoteDate,
          c.CNIC as CandidateCNIC,
          c.Category,
          cu.FirstName as CandidateFirstName,
          cu.LastName as CandidateLastName,
          vu.FirstName as VoterFirstName,
          vu.LastName as VoterLastName,
          vu.Phone as VoterPhone,
          vu.Email as VoterEmail,
          vu.Address as VoterAddress
        FROM ElectionVotes ev
        INNER JOIN Candidates c ON ev.CandidateId = c.Id
        LEFT JOIN Users cu ON c.CNIC = cu.CNIC
        LEFT JOIN Users vu ON ev.VoterCNIC = vu.CNIC
        WHERE ev.CandidateId = @CandidateId
        ORDER BY ev.CreatedDate DESC
      `);
    
    const voteCount = result.recordset.length;
    
    res.json({
      CandidateInfo: result.recordset.length > 0 ? {
        CNIC: result.recordset[0].CandidateCNIC,
        Name: (result.recordset[0].CandidateFirstName || '') + ' ' + (result.recordset[0].CandidateLastName || ''),
        Category: result.recordset[0].Category,
        TotalVotesReceived: voteCount
      } : null,
      Voters: result.recordset.map(r => ({
        VoteId: r.VoteId,
        VoterCNIC: r.VoterCNIC,
        VoterName: (r.VoterFirstName || '') + ' ' + (r.VoterLastName || ''),
        VoterPhone: r.VoterPhone,
        VoterEmail: r.VoterEmail,
        VoteDate: r.VoteDate,
        ElectionEndDate: r.ElectionEndDate
      }))
    });
  } catch (err) {
    console.error('❌ Error fetching candidate election votes:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (pool) await pool.close();
  }
});

// 2.20 GET ELECTION VOTING STATISTICS
app.get('/api/election-stats', async (req, res) => {
  // Accept either electionId OR nhcId. If nhcId provided, resolve the latest election for that NHC.
  const electionId = req.query.electionId ? parseInt(req.query.electionId, 10) : null;
  const nhcId = req.query.nhcId ? parseInt(req.query.nhcId, 10) : null;

  if (!electionId && !nhcId) return res.status(400).json({ error: 'electionId or nhcId required' });

  let pool;
  try {
    pool = await sql.connect(dbConfig);

    let resolvedElectionId = electionId;
    let resolvedNhcId = nhcId;

    if (!resolvedElectionId && resolvedNhcId) {
      const el = await pool.request()
        .input('NHC_Id', sql.Int, resolvedNhcId)
        .query('SELECT TOP 1 Id FROM Elections WHERE NHC_Id = @NHC_Id ORDER BY CreatedDate DESC');
      if (el.recordset.length === 0) return res.status(404).json({ error: 'No election found for this NHC' });
      resolvedElectionId = el.recordset[0].Id;
    }

    if (!resolvedNhcId && resolvedElectionId) {
      const el2 = await pool.request()
        .input('Id', sql.Int, resolvedElectionId)
        .query('SELECT NHC_Id FROM Elections WHERE Id = @Id');
      if (el2.recordset.length === 0) return res.status(404).json({ error: 'Election not found' });
      resolvedNhcId = el2.recordset[0].NHC_Id;
    }

    // Check if results are stored in ElectionResults table
    const storedResults = await pool.request()
      .input('ElectionId', sql.Int, resolvedElectionId)
      .query(`
        SELECT * FROM ElectionResults WHERE ElectionId = @ElectionId
      `);

    // If results are stored, fetch from ElectionResults (official final results)
    if (storedResults.recordset.length > 0) {
      const president = storedResults.recordset.filter(r => r.Category === 'President').map(r => ({ 
        Id: r.CandidateId,
        CNIC: r.CNIC,
        FirstName: r.FirstName,
        LastName: r.LastName,
        Category: r.Category,
        TotalVotes: r.TotalVotes
      }));
      const treasurer = storedResults.recordset.filter(r => r.Category === 'Treasurer').map(r => ({ 
        Id: r.CandidateId,
        CNIC: r.CNIC,
        FirstName: r.FirstName,
        LastName: r.LastName,
        Category: r.Category,
        TotalVotes: r.TotalVotes
      }));

      console.log("✓ Fetched finalized results from ElectionResults table for ElectionId:", resolvedElectionId);
      return res.json({ president, treasurer });
    }

    // Fallback: Calculate from ElectionVotes in real-time (for ongoing or incomplete elections)
    // IMPORTANT: Only include candidates from the LATEST nomination period using NominationId
    const latestNomRes = await pool.request()
      .input('NHC_Id', sql.Int, resolvedNhcId)
      .query(`SELECT TOP 1 Id FROM Nominations WHERE NHC_Id = @NHC_Id ORDER BY CreatedDate DESC`);
    
    const latestNominationId = latestNomRes.recordset.length > 0 ? latestNomRes.recordset[0].Id : null;
    
    const candidatesRes = await pool.request()
      .input('ElectionId', sql.Int, resolvedElectionId)
      .input('NHC_Id', sql.Int, resolvedNhcId)
      .input('NominationId', sql.Int, latestNominationId)
      .query(`
        SELECT 
          c.Id,
          c.CNIC,
          ISNULL(u.FirstName, '') AS FirstName,
          ISNULL(u.LastName, '') AS LastName,
          c.Category,
          ISNULL(v.TotalVotes, 0) AS TotalVotes
        FROM Candidates c
        LEFT JOIN Users u ON c.CNIC = u.CNIC
        LEFT JOIN (
          SELECT CandidateId, COUNT(*) AS TotalVotes FROM ElectionVotes WHERE ElectionId = @ElectionId GROUP BY CandidateId
        ) v ON v.CandidateId = c.Id
        WHERE c.NHC_Id = @NHC_Id AND c.IsEligible = 1
          AND (@NominationId IS NULL OR c.NominationId = @NominationId)
        ORDER BY c.Category ASC, ISNULL(v.TotalVotes, 0) DESC, c.CreatedDate ASC
      `);

    const president = candidatesRes.recordset.filter(r => r.Category === 'President').map(r => ({ ...r }));
    const treasurer = candidatesRes.recordset.filter(r => r.Category === 'Treasurer').map(r => ({ ...r }));

    console.log("✓ Calculated real-time stats from ElectionVotes for ElectionId:", resolvedElectionId);
    res.json({ president, treasurer });
  } catch (err) {
    console.error('❌ Error fetching election stats:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (pool) await pool.close();
  }
});

// --- POSITIONS: GET / POST ---
app.get('/api/positions', async (req, res) => {
  console.log('GET /api/positions called...');
  let pool;
  try {
    pool = await sql.connect(dbConfig);
    const result = await pool.request().query('SELECT Id, Name, CreatedDate FROM Positions ORDER BY Id');
    res.json(result.recordset);
  } catch (err) {
    console.error('❌ Error fetching positions:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (pool) await pool.close();
  }
});

app.post('/api/positions', async (req, res) => {
  console.log('POST /api/positions called...');
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Position name is required' });
  let pool;
  try {
    pool = await sql.connect(dbConfig);
    // Check if exists
    const exists = await pool.request().input('Name', sql.NVarChar, name.trim()).query('SELECT Id FROM Positions WHERE Name = @Name');
    if (exists.recordset.length > 0) return res.status(409).json({ error: 'Position already exists' });

    const insert = await pool.request().input('Name', sql.NVarChar, name.trim()).query("INSERT INTO Positions (Name) VALUES (@Name); SELECT SCOPE_IDENTITY() as id");
    const id = insert.recordset[0].id;
    res.status(201).json({ id, name: name.trim() });
  } catch (err) {
    console.error('❌ Error creating position:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (pool) await pool.close();
  }
});

// --- PROFILE PICTURE UPLOAD ---
app.post('/api/upload-profile-pic', upload.single('profilePic'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileUrl = `/profile-pictures/${req.file.filename}`;
    const cnic = req.body.cnic;

    if (cnic) {
      let pool;
      try {
        pool = await sql.connect(dbConfig);
        await pool.request()
          .input('CNIC', sql.NVarChar, cnic)
          .input('ProfileImage', sql.NVarChar, fileUrl)
          .query('UPDATE Users SET ProfileImage = @ProfileImage WHERE CNIC = @CNIC');
      } finally {
        if (pool) await pool.close();
      }
    }

    res.json({ 
      message: 'Profile picture uploaded successfully',
      fileUrl: fileUrl,
      filename: req.file.filename
    });
  } catch (err) {
    console.error('❌ Error uploading profile picture:', err);
    res.status(500).json({ error: err.message });
  }
});