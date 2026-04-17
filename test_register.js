const db = require('./db');
const bcrypt = require('bcryptjs');

async function testRegister() {
    const username = 'testuser' + Date.now();
    const email = 'test' + Date.now() + '@example.com';
    const password = 'Password123!';
    
    try {
        console.log(`[Test] Attempting register for: ${email}`);
        const passwordHash = await bcrypt.hash(password, 12);
        
        const setting = db.prepare("SELECT value FROM system_settings WHERE key = 'default_credits'").get();
        const defaultCredits = setting ? parseInt(setting.value) || 4 : 4;
        
        const result = db.prepare(
            'INSERT INTO users (username, email, password_hash, credits) VALUES (?, ?, ?, ?)'
        ).run(username, email, passwordHash, defaultCredits);
        
        console.log(`[Test] User inserted. ID: ${result.lastInsertRowid}`);
        
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
        console.log(`[Test] User fetched:`, user);
        
        function safeUser(u) {
            return { id: u.id, username: u.username, email: u.email, credits: u.credits, role: u.role, avatar_color: u.avatar_color, bio: u.bio };
        }
        
        const safe = safeUser(user);
        console.log(`[Test] Safe user:`, safe);
        console.log(`[Test] SUCCESS`);
        process.exit(0);
    } catch (err) {
        console.error(`[Test] FAILED:`, err);
        process.exit(1);
    }
}

testRegister();
