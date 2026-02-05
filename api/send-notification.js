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
            // OPTION 1: Load from Single JSON Variable (Robust/Preferred)
            if (process.env.FIREBASE_SERVICE_ACCOUNT) {
                try {
                    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
                    admin.initializeApp({
                        credential: admin.credential.cert(serviceAccount)
                    });
                    return; // Initialized successfully
                } catch (jsonError) {
                    console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:", jsonError);
                    // Fallthrough to Option 2
                }
            }

            // OPTION 2: Load from Individual Vars (Backup)
            const projectId = process.env.FIREBASE_PROJECT_ID ? process.env.FIREBASE_PROJECT_ID.trim() : null;
            const clientEmail = process.env.FIREBASE_CLIENT_EMAIL ? process.env.FIREBASE_CLIENT_EMAIL.trim() : null;
            let privateKey = process.env.FIREBASE_PRIVATE_KEY;

            if (privateKey) {
                // Formatting fixes
                if (privateKey.startsWith('"') && privateKey.endsWith('"')) privateKey = privateKey.slice(1, -1);
                privateKey = privateKey.replace(/\\n/g, '\n').trim();
            }

            if (!projectId || !clientEmail || !privateKey) {
                throw new Error("Missing Server Configuration: Set 'FIREBASE_SERVICE_ACCOUNT' (JSON) OR 'FIREBASE_PRIVATE_KEY' etc.");
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
        if (error.code === 'messaging/registration-token-not-registered') {
            // Token is dead. Return 410 (Gone) so client knows to stop using it.
            return res.status(410).json({ error: 'TokenExpired', details: 'The FCM token is invalid or expired.' });
        }
        if (error.code === 'messaging/invalid-argument') {
            return res.status(400).json({ error: 'InvalidToken', details: 'The FCM token format is incorrect.' });
        }

        console.error("FCM Send Error:", error);
        return res.status(500).json({ error: 'Failed to send', details: error.code || error.message });
    }
}
