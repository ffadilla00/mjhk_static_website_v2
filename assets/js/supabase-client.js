const SUPABASE_URL = "https://yeumzuknpklpcbcaczat.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_kR37XM4It1OFLfL0PP3DoA_mEZ2TwVi";

window.mjhkSupabase = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);