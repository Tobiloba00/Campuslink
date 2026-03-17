import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseKey) {
    console.log('No anon key found');
} else {
    const supabase = createClient(supabaseUrl, supabaseKey);

    async function test() {
        console.log("Fetching user...");
        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        console.log("User:", user?.id, "AuthErr:", authErr?.message);

        console.log("Attempting to insert a test message...");
        const { data, error } = await supabase
            .from('messages')
            .insert({
                sender_id: user?.id || '00000000-0000-0000-0000-000000000000',
                receiver_id: '11111111-1111-1111-1111-111111111111',
                message: 'test message',
            });

        console.log("Insert result error:", error || 'Success');
    }

    test();
}
