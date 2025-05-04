# Discord File Storage System

A modern web application for using Discord channels as a cloud storage solution, featuring an advanced admin dashboard and intuitive file management system.

**Note: This project is not updated, bug fixed in feature, it's just test and basic task complete project, made in under 6 hours.**

## Overview

This application lets users store and retrieve files of any size through Discord channels, effectively turning Discord into a free cloud storage solution. The system handles large files by automatically chunking them into smaller pieces to comply with Discord's file size limitations.

## Key Features

### User Management
- User registration and authentication
- Personalized user profiles with customizable settings
- Activity tracking and file operation history

### File Operations
- Upload files to Discord channels
- Download files from Discord channels
- Large file handling with automatic chunking and merging
- File encryption with password protection
- Public file sharing with shareable links

### Credential Management
- Save Discord tokens and channel IDs for quick access
- Favorite frequently used credentials
- Secure credential storage

### Batch Operations
- Batch upload multiple files simultaneously
- Batch download multiple files at once
- Real-time progress tracking

### Admin Dashboard
- User management with full CRUD operations
- System statistics and file analytics
- Storage usage monitoring
- Global settings management
- Activity logs and audit trails

### Real-time Updates
- WebSocket-based real-time notifications
- Live updating file list and operation status

## Technical Stack

### Frontend
- React with TypeScript
- TanStack Query for data fetching
- Shadcn UI components
- Tailwind CSS for styling
- WebSockets for real-time updates

### Backend
- Express.js server
- PostgreSQL database with Drizzle ORM
- Discord API integration
- Passport.js for authentication
- Multer for file handling

## Getting Started

### Prerequisites
- Node.js (v18+)
- PostgreSQL database
- Discord account with a server and channel to use

### Installation
1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables in `.env` file
4. Initialize the database: `npm run db:push`
5. Start the application: `npm run dev`

### Environment Variables
The application requires the following environment variables:
- `DATABASE_URL`: PostgreSQL database connection string
- Other PostgreSQL-related variables are automatically set up when initializing the database

## Usage Guide

### Setting Up Discord
1. Create a Discord server and a channel for file storage
2. Get your Discord token and channel ID
3. Enter these credentials in the application

### Uploading Files
1. Navigate to the Upload page
2. Select a file and enter your Discord credentials
3. Click Upload and wait for confirmation

### Downloading Files
1. Navigate to File Browser
2. Enter your Discord credentials to connect
3. Browse files and click Download on any file you wish to retrieve

### Managing Credentials
1. Navigate to your Profile
2. Go to the Saved Credentials tab
3. Add and manage your Discord credentials for quick access

## Security Considerations

- Discord tokens are sensitive information and should be kept secure
- The application stores tokens securely but users should be careful when sharing their information
- Optional file encryption is available for sensitive files

## Future Enhancements

While this project was completed in a limited timeframe (6 hours), potential future enhancements could include:
- Enhanced file organization with folders and tags
- Improved search functionality
- Integration with other storage providers
- Mobile applications for Android and iOS
- Additional encryption options
- Collaborative features for team environments


## License

This project is for demonstration purposes.

## Disclaimer

This application is not affiliated with Discord. Using Discord as a file storage solution may violate Discord's terms of service if abused. Use responsibly and at your own risk.