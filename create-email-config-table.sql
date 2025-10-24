-- Create email_configurations table
CREATE TABLE IF NOT EXISTS email_configurations (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_email TEXT NOT NULL,
  from_email TEXT NOT NULL,
  from_password TEXT NOT NULL,
  configured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE email_configurations ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "Users can manage their own email configurations" ON email_configurations
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create unique index on user_id to ensure one config per user
CREATE UNIQUE INDEX IF NOT EXISTS email_configurations_user_id_unique 
ON email_configurations(user_id);
