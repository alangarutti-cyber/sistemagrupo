
import React, { createContext, useState, useContext, useEffect } from 'react';

    const TabContext = createContext();

    export const TabProvider = ({ children }) => {
        const [tabs, setTabs] = useState([]);
        const [activeTab, setActiveTab] = useState(null);

        const openTab = (newTab) => {
            setTabs(prevTabs => {
                if (prevTabs.some(tab => tab.id === newTab.id)) {
                    return prevTabs;
                }
                return [...prevTabs, newTab];
            });
            setActiveTab(newTab.id);
        };

        const closeTab = (tabId) => {
            const tabIndex = tabs.findIndex(tab => tab.id === tabId);
            if (tabIndex === -1) return;

            const newTabs = tabs.filter(tab => tab.id !== tabId);
            setTabs(newTabs);

            if (activeTab === tabId) {
                if (newTabs.length === 0) {
                    setActiveTab(null);
                } else {
                    const newActiveIndex = Math.max(0, tabIndex - 1);
                    setActiveTab(newTabs[newActiveIndex].id);
                }
            }
        };

        const value = {
            tabs,
            activeTab,
            openTab,
            closeTab,
            setActiveTab,
        };

        return (
            <TabContext.Provider value={value}>
                {children}
            </TabContext.Provider>
        );
    };

    export const useTabs = () => {
        const context = useContext(TabContext);
        if (!context) {
            throw new Error('useTabs must be used within a TabProvider');
        }
        return context;
    };
