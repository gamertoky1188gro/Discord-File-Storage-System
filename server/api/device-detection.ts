/**
 * Device and IP detection service for user authentication
 */
import { Request } from 'express';
import { storage } from '../storage';

export class DeviceDetectionService {
  /**
   * Get the client's public IP address from the request
   * @param req Express request object
   * @returns IP address as string
   */
  getClientIP(req: Request): string {
    const forwardedFor = req.headers['x-forwarded-for'] as string;
    if (forwardedFor) {
      // If multiple IPs, take the first one which is the client's
      return forwardedFor.split(',')[0].trim();
    }
    return req.socket.remoteAddress || '127.0.0.1';
  }

  /**
   * Get the client's device name from user agent
   * @param req Express request object
   * @returns Device name string
   */
  getDeviceName(req: Request): string {
    const userAgent = req.headers['user-agent'] || '';
    
    // Extract OS information
    let os = 'Unknown';
    if (userAgent.includes('Windows')) {
      os = 'Windows';
    } else if (userAgent.includes('Mac OS')) {
      os = 'macOS';
    } else if (userAgent.includes('Android')) {
      os = 'Android';
    } else if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) {
      os = 'iOS';
    } else if (userAgent.includes('Linux')) {
      os = 'Linux';
    }
    
    // Extract browser information
    let browser = 'Unknown';
    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
      browser = 'Chrome';
    } else if (userAgent.includes('Firefox')) {
      browser = 'Firefox';
    } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
      browser = 'Safari';
    } else if (userAgent.includes('Edg')) {
      browser = 'Edge';
    }
    
    return `${os}-${browser}`;
  }

  /**
   * Check if there's already a user registered with this IP
   * @param ip Client IP address
   * @returns User ID if exists, null otherwise
   */
  async getUserByIP(ip: string): Promise<number | null> {
    // Find a user profile with this IP as email
    const users = await storage.getAllUsers();
    
    for (const user of users) {
      const profile = await storage.getUserProfile(user.id);
      if (profile && profile.email === ip) {
        return user.id;
      }
    }
    
    return null;
  }

  /**
   * Check if this is a new device from an existing IP
   * @param ip Client IP address
   * @param deviceName Device name
   * @returns True if new device, false otherwise
   */
  async isNewDeviceFromExistingIP(ip: string, deviceName: string): Promise<boolean> {
    const users = await storage.getAllUsers();
    
    for (const user of users) {
      const profile = await storage.getUserProfile(user.id);
      if (profile && profile.email === ip && profile.device_name !== deviceName) {
        return true;
      }
    }
    
    return false;
  }
}

export const deviceDetection = new DeviceDetectionService();