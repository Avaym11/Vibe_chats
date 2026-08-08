import { Request, Response } from 'express';
import { pool } from './db';
import { AuthenticatedRequest } from './auth';

export async function handleGetDailyHighlights(req: Request, res: Response) {
  try {
    const dateParam = (req.query.date as string) || new Date().toISOString().split('T')[0];

    const result = await pool.query(
      'SELECT * FROM daily_highlights WHERE date_str = $1',
      [dateParam]
    );

    if (result.rows.length === 0) {
      // Return fallback or latest available highlight
      const latest = await pool.query(
        'SELECT * FROM daily_highlights ORDER BY date_str DESC LIMIT 1'
      );
      if (latest.rows.length > 0) {
        return res.json(latest.rows[0]);
      }
      return res.status(404).json({ error: 'No daily highlights found.' });
    }

    res.json(result.rows[0]);
  } catch (err: any) {
    console.error('Error fetching highlights:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
}

export async function handleVotePoll(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Please log in to vote on daily polls.' });

    const { date_str, option_id } = req.body;
    if (!date_str || option_id === undefined) {
      return res.status(400).json({ error: 'date_str and option_id are required.' });
    }

    const userId = req.user.id;

    // Check if already voted
    const voteCheck = await pool.query(
      'SELECT option_id FROM poll_votes WHERE date_str = $1 AND user_id = $2',
      [date_str, userId]
    );

    const highlightRes = await pool.query(
      'SELECT daily_poll FROM daily_highlights WHERE date_str = $1',
      [date_str]
    );

    if (highlightRes.rows.length === 0) {
      return res.status(404).json({ error: 'Daily highlight not found.' });
    }

    const dailyPoll = highlightRes.rows[0].daily_poll;

    if (voteCheck.rows.length > 0) {
      const prevOption = voteCheck.rows[0].option_id;
      if (prevOption === option_id) {
        return res.json({ message: 'Already voted for this option', daily_poll: dailyPoll, userVote: option_id });
      }

      // Update vote option counts
      if (dailyPoll.options[prevOption]) {
        dailyPoll.options[prevOption].votes = Math.max(0, dailyPoll.options[prevOption].votes - 1);
      }
      if (dailyPoll.options[option_id]) {
        dailyPoll.options[option_id].votes = (dailyPoll.options[option_id].votes || 0) + 1;
      }

      await pool.query(
        'UPDATE poll_votes SET option_id = $1 WHERE date_str = $2 AND user_id = $3',
        [option_id, date_str, userId]
      );
    } else {
      // First time vote
      if (dailyPoll.options[option_id]) {
        dailyPoll.options[option_id].votes = (dailyPoll.options[option_id].votes || 0) + 1;
        dailyPoll.total_votes = (dailyPoll.total_votes || 0) + 1;
      }

      await pool.query(
        'INSERT INTO poll_votes (date_str, user_id, option_id) VALUES ($1, $2, $3)',
        [date_str, userId, option_id]
      );
    }

    // Save updated poll JSON
    await pool.query(
      'UPDATE daily_highlights SET daily_poll = $1 WHERE date_str = $2',
      [JSON.stringify(dailyPoll), date_str]
    );

    res.json({
      message: 'Vote recorded!',
      daily_poll: dailyPoll,
      userVote: option_id
    });
  } catch (err: any) {
    console.error('Error voting in poll:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
}
