export default async function handler(req, res) {
    // Robust CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { token, title, body, data } = req.body;
    if (!token || !title || !body) return res.status(400).json({ error: 'Missing required fields' });

    // Initialize Firebase Admin (Singleton check)
    // We use require to avoid webpack/esm issues in some Vercel envs, but import is likely fine.
    // Let's stick to standard node requires for functions if possible, or dynamic import.
    // Create React App doesn't transpile API folder usually, but Vercel does.

    // We need to use "firebase-admin"
    let admin;
    try {
        admin = require('firebase-admin');
        if (!admin.apps.length) {
            // READ ENV VARS & CLEAN THEM
            const projectId = process.env.FIREBASE_PROJECT_ID ? process.env.FIREBASE_PROJECT_ID.trim() : null;
            const clientEmail = process.env.FIREBASE_CLIENT_EMAIL ? process.env.FIREBASE_CLIENT_EMAIL.trim() : null;
            // Handle Private Key Newlines
            let privateKey = process.env.FIREBASE_PRIVATE_KEY;
            if (privateKey) {
                // If user pasted literal "\n", replace them. 
                // If user pasted real newlines, this regex call is safe (it only matches literal backslash-n).
                privateKey = privateKey.replace(/\\n/g, '\n');
            }

            if (!projectId || !clientEmail || !privateKey) {
                console.error("Missing Firebase Admin credentials in Env Vars");
                throw new Error("Missing Server Configuration (Env Vars)");
            }

            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId,
                    clientEmail,
                    privateKey
                })
            });
        }
    } catch (e) {
        console.error("Firebase Admin Init Error:", e);
        return res.status(500).json({ error: 'Server Config Error', details: e.message });
    }

    const message = {
        token: token,
        notification: {
            title: title,
            body: body,
        },
        data: data || {},
        // Apple specific settings
        apns: {
            payload: {
                aps: {
                    site: 'https://nust-marketplace.vercel.app', // Should ideally be dynamic
                    sound: 'default'
                }
            }
        },
        // WebPush config
        webpush: {
            notification: {
                icon: 'https://nust-marketplace.vercel.app/logo192.png',
                click_action: data.url || 'https://nust-marketplace.vercel.app'
            }
        }
    };

    try {
        const response = await admin.messaging().send(message);
        return res.status(200).json({ success: true, messageId: response });
    } catch (error) {
        console.error("FCM Send Error:", error);
        return res.status(500).json({ error: 'Failed to send', details: error.message });
    }
}
