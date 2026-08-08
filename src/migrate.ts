import { Client } from 'pg';
import bcrypt from 'bcryptjs';

async function migrate(): Promise<void> {
  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });

  await client.connect();

  try {
    console.log('Starting VibeSphere Database Migrations...');

    // 1. Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        avatar_url TEXT,
        bio TEXT,
        vibe_tag VARCHAR(50) DEFAULT '✨ Main Character',
        status_message TEXT DEFAULT 'Vibing in the matrix',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // 2. Channels table
    await client.query(`
      CREATE TABLE IF NOT EXISTS channels (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        icon VARCHAR(20),
        category VARCHAR(50) DEFAULT 'General',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // 3. Messages table
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        channel_id INTEGER REFERENCES channels(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        image_url TEXT,
        is_nsfw BOOLEAN DEFAULT false,
        reactions JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    await client.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_nsfw BOOLEAN DEFAULT false;`);
    await client.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT false;`);

    // 4. Direct Messages table
    await client.query(`
      CREATE TABLE IF NOT EXISTS direct_messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        image_url TEXT,
        is_nsfw BOOLEAN DEFAULT false,
        is_edited BOOLEAN DEFAULT false,
        reactions JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    await client.query(`ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS is_nsfw BOOLEAN DEFAULT false;`);
    await client.query(`ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT false;`);

    // 5. Daily Highlights table
    await client.query(`
      CREATE TABLE IF NOT EXISTS daily_highlights (
        id SERIAL PRIMARY KEY,
        date_str VARCHAR(10) UNIQUE NOT NULL,
        title TEXT NOT NULL,
        subtitle TEXT,
        main_character JSONB NOT NULL,
        slang_of_the_day JSONB NOT NULL,
        pop_culture_drops JSONB NOT NULL,
        daily_poll JSONB NOT NULL,
        meme_of_day JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // 6. Poll Votes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS poll_votes (
        id SERIAL PRIMARY KEY,
        date_str VARCHAR(10) NOT NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        option_id INTEGER NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(date_str, user_id)
      );
    `);

    // Seed Demo Users
    const defaultPasswordHash = await bcrypt.hash('password123', 10);
    const demoUsers = [
      {
        username: 'kai_rizzler',
        email: 'kai@genz.vibe',
        avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
        bio: 'Ate and left no crumbs 💅 | Content Creator & Fits enthusiast',
        vibe_tag: '🔥 Main Character',
        status_message: 'Cooking up some fresh vibes 🍳'
      },
      {
        username: 'skibidi_zack',
        email: 'zack@genz.vibe',
        avatar_url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=250&q=80',
        bio: 'Living rent-free in the metaverse 🧠 | Meme Historian',
        vibe_tag: '💀 Certified Cooked',
        status_message: 'No cap, just vibes 🧢'
      },
      {
        username: 'maya_aesthetic',
        email: 'maya@genz.vibe',
        avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=250&q=80',
        bio: 'Y2K fashion & Lo-fi beats enthusiast 🌸🎧',
        vibe_tag: '✨ Aesthetic Queen',
        status_message: 'Curating the daily playlist 🎵'
      },
      {
        username: 'dev_no_cap',
        email: 'dev@genz.vibe',
        avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80',
        bio: 'Building full-stack apps at 3 AM with 0 bugs ⚡',
        vibe_tag: '⚡ Code Wizard',
        status_message: 'In deep focus mode 💻'
      }
    ];

    for (const u of demoUsers) {
      await client.query(`
        INSERT INTO users (username, email, password_hash, avatar_url, bio, vibe_tag, status_message)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (username) DO NOTHING
      `, [u.username, u.email, defaultPasswordHash, u.avatar_url, u.bio, u.vibe_tag, u.status_message]);
    }

    // Seed Channels
    const channels = [
      { slug: 'main-stage', name: 'Main Stage Hub', description: 'The central gathering spot for Gen Z chatter & trend drops', icon: '🌐', category: 'General' },
      { slug: 'vibe-check', name: 'Unfiltered Vibe Check', description: 'Hot takes, deep thoughts, and late night discussions', icon: '🔥', category: 'General' },
      { slug: 'fits-and-drip', name: 'Fits & Drip Showcase', description: 'OOTD, Y2K aesthetics, thrifting hauls, and style inspo', icon: '👗', category: 'Lifestyle' },
      { slug: 'gaming-hype', name: 'Gaming & Esports', description: 'Clips, game drops, squad recruitment, and live streams', icon: '🎮', category: 'Entertainment' },
      { slug: 'brainrot-lore', name: 'Meme Vault & Lore', description: 'Viral memes, TikTok sounds, and Internet culture', icon: '🧠', category: 'Entertainment' },
      { slug: 'soundtrack-drops', name: 'Soundtrack & Music', description: 'Spotify playlists, underground artists, and beat drops', icon: '🎧', category: 'Lifestyle' }
    ];

    for (const c of channels) {
      await client.query(`
        INSERT INTO channels (slug, name, description, icon, category)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (slug) DO NOTHING
      `, [c.slug, c.name, c.description, c.icon, c.category]);
    }

    // Get channel IDs
    const chanRes = await client.query(`SELECT id, slug FROM channels`);
    const chanMap = new Map(chanRes.rows.map(r => [r.slug, r.id]));
    const userRes = await client.query(`SELECT id, username FROM users`);
    const userMap = new Map(userRes.rows.map(r => [r.username, r.id]));

    // Seed Messages if channel empty
    const mainStageId = chanMap.get('main-stage');
    const kaiId = userMap.get('kai_rizzler');
    const zackId = userMap.get('skibidi_zack');
    const mayaId = userMap.get('maya_aesthetic');
    const devId = userMap.get('dev_no_cap');

    if (mainStageId && kaiId && zackId && mayaId) {
      const msgCheck = await client.query(`SELECT COUNT(*) FROM messages WHERE channel_id = $1`, [mainStageId]);
      if (parseInt(msgCheck.rows[0].count, 10) === 0) {
        await client.query(`
          INSERT INTO messages (channel_id, user_id, content, reactions, created_at)
          VALUES
          ($1, $2, 'Yo welcome to VibeSphere! Did anyone check today''s main character highlights yet? Ate so hard 💅', '{"🔥": 4, "✨": 3}'::jsonb, NOW() - INTERVAL '1 hour'),
          ($1, $3, 'No cap the slang of the day is literally me on a Monday morning 😭💀', '{"💀": 6, "🗿": 2}'::jsonb, NOW() - INTERVAL '45 minutes'),
          ($1, $4, 'The new Y2K fits drop in #fits-and-drip is insane. Who voted on the daily poll?', '{"💯": 5, "❤️": 4}'::jsonb, NOW() - INTERVAL '20 minutes'),
          ($1, $5, 'Server backend is running at peak performance on Zerops Node.js 22 + PostgreSQL 18! ⚡', '{"🧠": 3, "🚀": 7}'::jsonb, NOW() - INTERVAL '5 minutes')
        `, [mainStageId, kaiId, zackId, mayaId, devId]);
      }
    }

    // Seed Today's Daily Highlight
    const todayStr = new Date().toISOString().split('T')[0];
    await client.query(`
      INSERT INTO daily_highlights (
        date_str, title, subtitle, main_character, slang_of_the_day, pop_culture_drops, daily_poll, meme_of_day
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (date_str) DO UPDATE SET
        title = EXCLUDED.title,
        subtitle = EXCLUDED.subtitle,
        main_character = EXCLUDED.main_character,
        slang_of_the_day = EXCLUDED.slang_of_the_day,
        pop_culture_drops = EXCLUDED.pop_culture_drops,
        daily_poll = EXCLUDED.daily_poll,
        meme_of_day = EXCLUDED.meme_of_day
    `, [
      todayStr,
      'DAILY GEN Z HIGHLIGHTS & VIBE REPORT ⚡',
      'Your curated daily breakdown of viral culture, slang, main characters & hot takes.',
      JSON.stringify({
        name: 'Clara "Sub-Zero" Vance',
        title: 'The 19-Year-Old Beatsmith taking over TikTok Audio',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
        bio: 'Created a 15-second viral Jersey Club remix in her dorm room using broken headphone mic that reached 45M reels in 48 hours.',
        vibeRating: '9.9/10 Main Character Energy'
      }),
      JSON.stringify({
        term: 'Crash Out',
        pronunciation: '/kræʃ aʊt/',
        category: 'Behavior & Mood',
        definition: 'To recklessly engage in erratic or extreme behavior without caring about consequences, usually triggered by minor minor inconveniences.',
        example: '"Bro lost one game of Valorant and completely crashed out on his mechanical keyboard 💀"',
        synonyms: ['Spazz out', 'Go nuclear', 'Lose it']
      }),
      JSON.stringify([
        {
          tag: 'VIRAL AUDIO',
          title: 'The "Lofi Brainrot" Beats Trend',
          snippet: 'Producers are overlaying smooth jazz chords over viral meme quotes. Is it art or peak brainrot?',
          hotCount: '1.2M posts'
        },
        {
          tag: 'FASHION',
          title: 'Gorpcore Meets Coquette Aesthetic',
          snippet: 'Hiking boots combined with pink ribbons are officially taking over college campuses worldwide.',
          hotCount: '890K posts'
        },
        {
          tag: 'GAMING',
          title: 'Indie Roguelike Breaks Concurrent Player Record',
          snippet: 'A solo developer made a game entirely in pixel art about managing a boba shop during a zombie apocalypse.',
          hotCount: '450K posts'
        }
      ]),
      JSON.stringify({
        question: 'Which Gen Z era was objectively the peak internet culture?',
        options: [
          { id: 0, text: '2016 Vine & Musically Golden Era 🍇', votes: 142 },
          { id: 1, text: '2020 Lockdown TikTok & Among Us 🚀', votes: 98 },
          { id: 2, text: '2023 Rizz, Skibidi & Meme Renaissance 🗿', votes: 87 },
          { id: 3, text: 'Right Now (2026 AI & Hyper-Vibe Era) ⚡', votes: 165 }
        ],
        total_votes: 492
      }),
      JSON.stringify({
        title: 'When you try to explain Gen Z slang to your boss',
        imageUrl: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=600&q=80',
        caption: '"So basically he had infinite rizz but then he crashed out no cap..." 😭💀',
        spicyLevel: '🌶️🌶️🌶️ High Spice'
      })
    ]);

    console.log('VibeSphere Database Migration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  } finally {
    await client.end();
  }
}

migrate().catch((err) => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
