import React, { createContext, useContext, useEffect, useState } from 'react';

const InstallContext = createContext();

export const useInstallPrompt = () => useContext(InstallContext);

export const InstallProvider = ({ children }) => {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isAppInstalled, setIsAppInstalled] = useState(false);

    useEffect(() => {
        const handleBeforeInstallPrompt = (e) => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            // Stash the event so it can be triggered later.
            setDeferredPrompt(e);
            console.log("Install Prompt intercepted");
        };

        const handleAppInstalled = () => {
            setDeferredPrompt(null);
            setIsAppInstalled(true);
            console.log("App installed successfully");
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', handleAppInstalled);

        // Check if already installed (standalone mode)
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setIsAppInstalled(true);
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    const showInstallPrompt = async () => {
        if (!deferredPrompt) {
            console.log("Install prompt not available");
            return false;
        }

        // Show the install prompt
        deferredPrompt.prompt();

        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);

        // We've used the prompt, and can't use it again, discard it
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
            return true;
        }
        return false;
    };

    return (
        <InstallContext.Provider value={{ showInstallPrompt, isInstallAvailable: !!deferredPrompt, isAppInstalled }}>
            {children}
        </InstallContext.Provider>
    );
};
