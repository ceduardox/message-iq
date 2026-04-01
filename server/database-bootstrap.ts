import { sql } from "drizzle-orm";
import { db } from "./db";

let schemaEnsured = false;

export async function ensureDatabaseSchema(): Promise<void> {
  if (schemaEnsured) return;

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS agents (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      username VARCHAR(50) NOT NULL UNIQUE,
      password VARCHAR(100) NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      is_ai_auto_reply_enabled BOOLEAN NOT NULL DEFAULT true,
      weight INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS subadmins (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      username VARCHAR(50) NOT NULL UNIQUE,
      password VARCHAR(100) NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS labels (
      id SERIAL PRIMARY KEY,
      name VARCHAR(50) NOT NULL,
      color VARCHAR(20) NOT NULL,
      agent_id INTEGER REFERENCES agents(id)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS quick_messages (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      text TEXT,
      image_url TEXT
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS conversations (
      id SERIAL PRIMARY KEY,
      wa_id VARCHAR NOT NULL UNIQUE,
      contact_name TEXT,
      label_id INTEGER REFERENCES labels(id),
      label_id_2 INTEGER REFERENCES labels(id),
      is_pinned BOOLEAN DEFAULT false,
      order_status VARCHAR(20),
      ai_disabled BOOLEAN DEFAULT false,
      needs_human_attention BOOLEAN DEFAULT false,
      should_call BOOLEAN DEFAULT false,
      reminder_at TIMESTAMP,
      reminder_note TEXT,
      reminder_color VARCHAR(20),
      reminder_done BOOLEAN DEFAULT false,
      reminder_updated_at TIMESTAMP,
      last_follow_up_at TIMESTAMP,
      assigned_agent_id INTEGER REFERENCES agents(id),
      last_message TEXT,
      last_message_timestamp TIMESTAMP,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id),
      wa_message_id VARCHAR UNIQUE,
      direction VARCHAR(10) NOT NULL,
      type VARCHAR(20) NOT NULL,
      body TEXT,
      media_id VARCHAR,
      mime_type VARCHAR(255),
      status VARCHAR(20) DEFAULT 'received',
      timestamp VARCHAR,
      raw_json JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ai_settings (
      id SERIAL PRIMARY KEY,
      enabled BOOLEAN DEFAULT false,
      system_prompt TEXT,
      catalog TEXT,
      cache_refresh_minutes INTEGER DEFAULT 5,
      max_tokens INTEGER DEFAULT 120,
      temperature INTEGER DEFAULT 70,
      ai_provider VARCHAR(20) DEFAULT 'openai',
      model VARCHAR(50) DEFAULT 'gpt-4o-mini',
      max_prompt_chars INTEGER DEFAULT 2000,
      conversation_history INTEGER DEFAULT 3,
      audio_response_enabled BOOLEAN DEFAULT false,
      audio_voice VARCHAR(20) DEFAULT 'nova',
      tts_provider VARCHAR(20) DEFAULT 'openai',
      elevenlabs_voice_id VARCHAR(50) DEFAULT 'JBFqnCBsd6RMkjVDRZzb',
      tts_speed INTEGER DEFAULT 100,
      tts_instructions TEXT,
      learning_mode BOOLEAN DEFAULT false,
      learning_message_count INTEGER DEFAULT 10,
      follow_up_enabled BOOLEAN DEFAULT false,
      follow_up_minutes INTEGER DEFAULT 20,
      follow_up_check_interval_minutes INTEGER DEFAULT 5,
      follow_up_batch_size INTEGER DEFAULT 10,
      follow_up_message_mode VARCHAR(20) DEFAULT 'ai',
      follow_up_fixed_message TEXT,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ai_training_data (
      id SERIAL PRIMARY KEY,
      type VARCHAR(20) NOT NULL,
      title VARCHAR(200),
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ai_logs (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER REFERENCES conversations(id),
      user_message TEXT,
      ai_response TEXT,
      tokens_used INTEGER,
      success BOOLEAN DEFAULT true,
      error TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      keywords VARCHAR(200),
      description TEXT,
      price VARCHAR(50),
      image_url TEXT,
      image_bottle_url TEXT,
      image_dose_url TEXT,
      image_ingredients_url TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS purchase_analyses (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id),
      probability VARCHAR(10) NOT NULL,
      reasoning TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS learned_rules (
      id SERIAL PRIMARY KEY,
      rule TEXT NOT NULL,
      learned_from TEXT,
      conversation_id INTEGER REFERENCES conversations(id),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS agent_assignment_cursor (
      id INTEGER PRIMARY KEY,
      cursor INTEGER NOT NULL DEFAULT -1,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      CONSTRAINT agent_assignment_cursor_singleton CHECK (id = 1)
    )
  `);

  await db.execute(sql`
    INSERT INTO agent_assignment_cursor (id, cursor)
    VALUES (1, -1)
    ON CONFLICT (id) DO NOTHING
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ad_lead_routing_rules (
      id SERIAL PRIMARY KEY,
      ad_id TEXT NOT NULL UNIQUE,
      agent_ids TEXT NOT NULL DEFAULT '',
      is_active BOOLEAN NOT NULL DEFAULT true,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS daily_cost_settings (
      date DATE PRIMARY KEY,
      unit_cost_bs NUMERIC(12, 4) NOT NULL,
      official_rate_bs NUMERIC(12, 4) NOT NULL,
      parallel_rate_bs NUMERIC(12, 4) NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS analytics_view_permissions (
      viewer_agent_id INTEGER PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
      visible_agent_ids TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS product_uploaded_images (
      id SERIAL PRIMARY KEY,
      file_name TEXT NOT NULL UNIQUE,
      mime_type TEXT NOT NULL,
      data BYTEA NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS push_notification_settings (
      id INTEGER PRIMARY KEY,
      notify_new_messages BOOLEAN NOT NULL DEFAULT true,
      notify_pending BOOLEAN NOT NULL DEFAULT true,
      reminder_lead_minutes TEXT NOT NULL DEFAULT '30,15',
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      CONSTRAINT push_notification_settings_singleton CHECK (id = 1)
    )
  `);

  await db.execute(sql`
    INSERT INTO push_notification_settings (id)
    VALUES (1)
    ON CONFLICT (id) DO NOTHING
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS user_sessions (
      sid VARCHAR PRIMARY KEY,
      sess JSON NOT NULL,
      expire TIMESTAMP(6) NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS user_sessions_expire_idx
    ON user_sessions (expire)
  `);

  schemaEnsured = true;
}
