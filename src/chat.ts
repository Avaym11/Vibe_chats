import { Response } from 'express';
import { pool } from './db';
import { AuthenticatedRequest } from './auth';

// Get list of all available channels
export async function handleGetChannels(_req: AuthenticatedRequest, res: Response) {
  try {
    const result = await pool.query('SELECT * FROM channels ORDER BY id ASC');
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

// Get messages for a channel
export async function handleGetChannelMessages(req: AuthenticatedRequest, res: Response) {
  try {
    const { channelSlug } = req.params;
    const limit = parseInt(req.query.limit as string || '50', 10);

    const chanRes = await pool.query('SELECT id FROM channels WHERE slug = $1', [channelSlug]);
    if (chanRes.rows.length === 0) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const channelId = chanRes.rows[0].id;

    const result = await pool.query(`
      SELECT m.id, m.channel_id, m.user_id, m.content, m.image_url, m.is_nsfw, m.is_edited, m.reactions, m.created_at,
             u.username, u.avatar_url, u.vibe_tag
      FROM messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.channel_id = $1
      ORDER BY m.created_at ASC
      LIMIT $2
    `, [channelId, limit]);

    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

// Post message to channel
export async function handlePostChannelMessage(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Log in to send messages.' });

    const { channelSlug } = req.params;
    const { content, image_url, is_nsfw } = req.body;

    if (!content && !image_url) {
      return res.status(400).json({ error: 'Message content or image is required.' });
    }

    const chanRes = await pool.query('SELECT id FROM channels WHERE slug = $1', [channelSlug]);
    if (chanRes.rows.length === 0) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const channelId = chanRes.rows[0].id;

    const result = await pool.query(`
      INSERT INTO messages (channel_id, user_id, content, image_url, is_nsfw, reactions)
      VALUES ($1, $2, $3, $4, $5, '{}'::jsonb)
      RETURNING id, channel_id, user_id, content, image_url, is_nsfw, reactions, created_at
    `, [channelId, req.user.id, content || '', image_url || null, Boolean(is_nsfw)]);

    const msg = result.rows[0];

    // Fetch sender detail for response
    const userRes = await pool.query('SELECT username, avatar_url, vibe_tag FROM users WHERE id = $1', [req.user.id]);
    const sender = userRes.rows[0];

    const fullMessage = {
      ...msg,
      username: sender.username,
      avatar_url: sender.avatar_url,
      vibe_tag: sender.vibe_tag
    };

    res.status(201).json(fullMessage);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

// React to a channel message
export async function handleReactChannelMessage(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Log in to react.' });

    const { messageId } = req.params;
    const { emoji } = req.body;

    if (!emoji) return res.status(400).json({ error: 'Emoji is required' });

    const msgRes = await pool.query('SELECT reactions FROM messages WHERE id = $1', [messageId]);
    if (msgRes.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const reactions = msgRes.rows[0].reactions || {};
    reactions[emoji] = (reactions[emoji] || 0) + 1;

    const updateRes = await pool.query(`
      UPDATE messages SET reactions = $1 WHERE id = $2 RETURNING *
    `, [JSON.stringify(reactions), messageId]);

    res.json(updateRes.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

// Edit a channel message
export async function handleEditChannelMessage(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Log in to edit messages.' });

    const messageId = Array.isArray(req.params.messageId) ? req.params.messageId[0] : req.params.messageId;
    const { content, image_url, is_nsfw } = req.body;

    const msgCheck = await pool.query('SELECT * FROM messages WHERE id = $1', [messageId]);
    if (msgCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const msg = msgCheck.rows[0];
    if (msg.user_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only edit your own messages.' });
    }

    const updateRes = await pool.query(`
      UPDATE messages
      SET content = $1, image_url = $2, is_nsfw = $3, is_edited = true
      WHERE id = $4
      RETURNING id, channel_id, user_id, content, image_url, is_nsfw, is_edited, reactions, created_at
    `, [content || '', image_url || null, Boolean(is_nsfw), messageId]);

    const updated = updateRes.rows[0];

    const userRes = await pool.query('SELECT username, avatar_url, vibe_tag FROM users WHERE id = $1', [req.user.id]);
    const sender = userRes.rows[0];

    res.json({
      ...updated,
      username: sender.username,
      avatar_url: sender.avatar_url,
      vibe_tag: sender.vibe_tag
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

// Delete a channel message
export async function handleDeleteChannelMessage(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Log in to delete messages.' });

    const messageId = Array.isArray(req.params.messageId) ? req.params.messageId[0] : req.params.messageId;

    const msgCheck = await pool.query('SELECT * FROM messages WHERE id = $1', [messageId]);
    if (msgCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const msg = msgCheck.rows[0];
    if (msg.user_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own messages.' });
    }

    await pool.query('DELETE FROM messages WHERE id = $1', [messageId]);

    res.json({ message: 'Message deleted successfully', id: parseInt(messageId, 10) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

// Direct Messages
export async function handleGetDirectMessages(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

    const { otherUserId } = req.params;

    const result = await pool.query(`
      SELECT dm.id, dm.sender_id, dm.receiver_id, dm.content, dm.image_url, dm.is_nsfw, dm.reactions, dm.created_at,
             u.username as sender_username, u.avatar_url as sender_avatar, u.vibe_tag as sender_vibe
      FROM direct_messages dm
      JOIN users u ON dm.sender_id = u.id
      WHERE (dm.sender_id = $1 AND dm.receiver_id = $2)
         OR (dm.sender_id = $2 AND dm.receiver_id = $1)
      ORDER BY dm.created_at ASC
      LIMIT 100
    `, [req.user.id, otherUserId]);

    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function handlePostDirectMessage(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

    const { otherUserId } = req.params;
    const { content, image_url, is_nsfw } = req.body;

    const result = await pool.query(`
      INSERT INTO direct_messages (sender_id, receiver_id, content, image_url, is_nsfw)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [req.user.id, otherUserId, content || '', image_url || null, Boolean(is_nsfw)]);

    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

// Get list of active community members
export async function handleGetMembers(_req: AuthenticatedRequest, res: Response) {
  try {
    const result = await pool.query(`
      SELECT id, username, avatar_url, bio, vibe_tag, status_message, created_at
      FROM users
      ORDER BY id ASC
      LIMIT 50
    `);
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
