import express from 'express';
import path from 'path';
import { handleRegister, handleLogin, handleGetProfile, handleUpdateProfile, authenticateToken } from './auth';
import { handleGetDailyHighlights, handleVotePoll } from './highlights';
import {
  handleGetChannels,
  handleGetChannelMessages,
  handlePostChannelMessage,
  handleReactChannelMessage,
  handleEditChannelMessage,
  handleDeleteChannelMessage,
  handleGetDirectMessages,
  handlePostDirectMessage,
  handleGetMembers
} from './chat';

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files from 'public' directory
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'OK', app: 'VibeSphere Gen Z Platform', timestamp: new Date().toISOString() });
});

// Authentication Routes
app.post('/api/auth/register', handleRegister);
app.post('/api/auth/login', handleLogin);
app.get('/api/auth/me', authenticateToken as any, handleGetProfile as any);
app.put('/api/auth/profile', authenticateToken as any, handleUpdateProfile as any);

// Daily Highlights Routes
app.get('/api/highlights/daily', handleGetDailyHighlights);
app.post('/api/highlights/poll/vote', authenticateToken as any, handleVotePoll as any);

// Chat Channels Routes
app.get('/api/channels', handleGetChannels as any);
app.get('/api/channels/:channelSlug/messages', handleGetChannelMessages as any);
app.post('/api/channels/:channelSlug/messages', authenticateToken as any, handlePostChannelMessage as any);
app.put('/api/messages/:messageId', authenticateToken as any, handleEditChannelMessage as any);
app.delete('/api/messages/:messageId', authenticateToken as any, handleDeleteChannelMessage as any);
app.post('/api/messages/:messageId/react', authenticateToken as any, handleReactChannelMessage as any);

// Direct Messages Routes
app.get('/api/dm/:otherUserId', authenticateToken as any, handleGetDirectMessages as any);
app.post('/api/dm/:otherUserId', authenticateToken as any, handlePostDirectMessage as any);

// Community Members
app.get('/api/members', handleGetMembers as any);

// Fallback to index.html for single-page app routing
app.get('*', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

export default app;
