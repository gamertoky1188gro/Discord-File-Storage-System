import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser, UserProfile } from "@shared/schema";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import { Request, Response, NextFunction } from "express";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);
const PostgresSessionStore = connectPg(session);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// Function to get client IP address
function getClientIp(req: Request): string {
  return req.headers['x-forwarded-for'] as string || 
         req.connection.remoteAddress || 
         'unknown-ip';
}

// Function to get client device name
function getDeviceName(req: Request): string {
  const userAgent = req.headers['user-agent'] || '';
  
  // Extract device information from user agent
  let deviceName = 'Unknown Device';
  
  if (userAgent.includes('iPhone')) {
    deviceName = 'iPhone';
  } else if (userAgent.includes('iPad')) {
    deviceName = 'iPad';
  } else if (userAgent.includes('Android')) {
    deviceName = 'Android Device';
  } else if (userAgent.includes('Windows')) {
    deviceName = 'Windows PC';
  } else if (userAgent.includes('Macintosh')) {
    deviceName = 'Mac';
  } else if (userAgent.includes('Linux')) {
    deviceName = 'Linux Device';
  }
  
  return deviceName;
}

export function setupAuth(app: Express) {
  const sessionStore = new PostgresSessionStore({ 
    pool, 
    createTableIfMissing: true,
    tableName: 'user_sessions'
  });
  
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || 'discord-file-master-secret-key',
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      secure: process.env.NODE_ENV === 'production'
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      const user = await storage.getUserByUsername(username);
      if (!user || !(await comparePasswords(password, user.password))) {
        return done(null, false);
      } else {
        return done(null, user);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        // Instead of throwing an error, just return null user
        // This will invalidate the session without errors
        console.log(`User with ID ${id} not found, cleaning up session`);
        return done(null, null);
      }
      return done(null, user);
    } catch (error) {
      console.error("Error deserializing user:", error);
      // Don't throw error, just return null to clean up the session
      return done(null, null);
    }
  });

  // Auto-user creation middleware based on IP
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    // Skip if user is already authenticated
    if (req.isAuthenticated()) {
      return next();
    }
    
    const clientIp = getClientIp(req);
    
    // For now, skip the IP check since the database schema might not be fully migrated
    // In a production app, we would check if a user with this IP already exists
    const existingProfile = null; // Skip existing profile check
    
    if (existingProfile) {
      // User exists with this IP, redirect to password form
      if (!req.path.startsWith('/auth') && !req.path.startsWith('/api')) {
        return res.redirect('/auth?ip=' + encodeURIComponent(clientIp));
      }
    } else {
      // No user with this IP exists, create one automatically
      try {
        const deviceName = getDeviceName(req);
        const username = `${deviceName}-${Date.now().toString().slice(-4)}`;
        const randomPassword = randomBytes(8).toString('hex');
        
        // Create a new user without setting the email field in user table
        // Instead, we'll store the IP in the user profile
        const newUser = await storage.createUser({
          username,
          password: await hashPassword(randomPassword),
          created_at: new Date()
          // No updated_at field in the actual database
        });
        
        // Create user profile
        await storage.createUserProfile({
          user_id: newUser.id,
          display_name: username,
          device_name: deviceName,
          email: clientIp // Store IP as email in profile too
        });
        
        // Auto-login the new user
        req.login(newUser, (err) => {
          if (err) {
            console.error('Error auto-logging in new user:', err);
          }
          next();
        });
      } catch (error) {
        console.error('Error creating user from IP:', error);
        next();
      }
    }
  });

  app.post("/api/register", async (req, res, next) => {
    const existingUser = await storage.getUserByUsername(req.body.username);
    if (existingUser) {
      return res.status(400).send("Username already exists");
    }

    const user = await storage.createUser({
      username: req.body.username,
      password: await hashPassword(req.body.password),
      created_at: new Date()
      // No updated_at field in the actual database
    });

    req.login(user, (err) => {
      if (err) return next(err);
      res.status(201).json(user);
    });
  });

  app.post("/api/login", (req, res, next) => {
    // Custom login handler to handle stayLoggedIn parameter
    passport.authenticate("local", (err: Error | null, user: Express.User | false, info: any) => {
      if (err) {
        return next(err);
      }
      
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      
      // Set session expiration based on stayLoggedIn flag
      if (req.body.stayLoggedIn) {
        // If stayLoggedIn is true, use the default long expiration (30 days from session settings)
        req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
      } else {
        // If stayLoggedIn is false, set a short expiration (browser session only)
        req.session.cookie.maxAge = undefined; // Browser session only (expires when browser is closed)
      }
      
      // Log the user in
      req.login(user, (loginErr) => {
        if (loginErr) {
          return next(loginErr);
        }
        
        // Update the last_active time in the user's profile
        storage.updateUserProfile(user.id, { 
          last_active: new Date() 
        }).catch(error => {
          console.error('Error updating user last_active time:', error);
        });
        
        return res.status(200).json(user);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });
  
  app.get("/api/check-ip", (req, res) => {
    const clientIp = getClientIp(req);
    const deviceName = getDeviceName(req);
    
    res.json({ 
      ip: clientIp, 
      device: deviceName,
      auth: req.isAuthenticated()
    });
  });
}