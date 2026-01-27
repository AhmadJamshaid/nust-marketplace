import React, { useState, useEffect } from 'react';
import { useInstallPrompt } from '../context/InstallContext';
import { X, Bell, Download } from 'lucide-react';
import { requestNotificationPermission } from '../firebaseFunctions';
import { auth } from '../firebase';

const InstallPopup = ({ triggerAction }) => {
    const { showInstallPrompt, isInstallAvailable, isAppInstalled } = useInstallPrompt();
    const [isVisible, setIsVisible] = useState(false);
    const [step, setStep] = useState('install'); // 'install' | 'notify' | 'done'

    useEffect(() => {
        // Logic to determine if we should show the popup
        // triggerAction is a prop that changes (e.g. timestamp) when a significant action happens
        if (triggerAction && !isAppInstalled) {
            // Check if user has already dismissed it recently (localStorage) to be "non-annoying"
            const lastDismissed = localStorage.getItem('installPromptDismissed');
            const now = Date.now();
            if (!lastDismissed || (now - parseInt(lastDismissed) > 24 * 60 * 60 * 1000)) { // 24 hours cooldown
                if (isInstallAvailable) {
                    setIsVisible(true);
                    setStep('install');
                } else if (Notification.permission === 'default') {
                    // If app already installed or simple browser, maybe just ask for notifications directly
                    setIsVisible(true);
                    setStep('notify');
                }
            }
        }
    }, [triggerAction, isInstallAvailable, isAppInstalled]);

    const handleInstallClick = async () => {
        const installed = await showInstallPrompt();
        if (installed) {
            setStep('notify'); // Move to notification step after install
        }
    };

    const handleNotifyClick = async () => {
        if (auth.currentUser) {
            await requestNotificationPermission(auth.currentUser.uid);
        } else {
            await requestNotificationPermission(null);
        }
        setIsVisible(false);
        localStorage.setItem('notificationsEnabled', 'true');
    };

    const handleDismiss = () => {
        setIsVisible(false);
        localStorage.setItem('installPromptDismissed', Date.now().toString());
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white dark:bg-zinc-800 rounded-xl shadow-2xl p-4 border border-zinc-200 dark:border-zinc-700 z-50 animate-in fade-in slide-in-from-bottom-5">
            <button onClick={handleDismiss} className="absolute top-2 right-2 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                <X size={16} />
            </button>

            {step === 'install' && (
                <div className="flex items-start gap-4">
                    <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg text-blue-600 dark:text-blue-400">
                        <Download size={24} />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">Install App</h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                            📲 Don’t miss replies! Add to home screen for instant alerts.
                        </p>
                        <button
                            onClick={handleInstallClick}
                            className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded-lg transition-colors"
                        >
                            Add to Home Screen
                        </button>
                    </div>
                </div>
            )}

            {step === 'notify' && (
                <div className="flex items-start gap-4">
                    <div className="bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded-lg text-yellow-600 dark:text-yellow-400">
                        <Bell size={24} />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">Enable Notifications</h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                            🔔 Never miss a buyer or seller. Get instant alerts for messages.
                        </p>
                        <div className="flex gap-2 mt-3">
                            <button
                                onClick={handleDismiss}
                                className="flex-1 bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm font-medium py-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors"
                            >
                                Maybe Later
                            </button>
                            <button
                                onClick={handleNotifyClick}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded-lg transition-colors"
                            >
                                Enable
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InstallPopup;
