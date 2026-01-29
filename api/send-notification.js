export default async function handler(req, res) {
    // Allow robust CORS for all origins (or restrict to your domain)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { token, title, body, data } = req.body;

    if (!token || !title || !body) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Hardcoded key for this specific app's context as requested/existing in client
    // In a real env, use process.env.FCM_SERVER_KEY
    const FCM_SERVER_KEY = "AIzaSyAm9TnIqrc4mjo-9EubLItRm4E1KThI0TI";

    const message = {
        to: token,
        notification: {
            title,
            body,
            icon: '/logo192.png',
        },
        data: data || {}
    };

    try {
        const response = await fetch('https://fcm.googleapis.com/fcm/send', {
            method: 'POST',
            headers: {
                'Authorization': 'key=' + FCM_SERVER_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(message)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`FCM error: ${errorText}`);
        }

        const responseData = await response.json();
        return res.status(200).json({ success: true, data: responseData });
    } catch (error) {
        console.error("FCM Send Error:", error);
        return res.status(500).json({ error: 'Failed to send', details: error.message });
    }
}
