require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  console.log('Checking tables...');
  const { error } = await supabase.from('users').select('*').limit(1);
  if (error) {
    console.log('❌ Error:', error.message);
    console.log('Error Code:', error.code);
  } else {
    console.log('✅ Table "users" is accessible.');
  }
}

check();
