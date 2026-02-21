import React from "react";

interface TabsProps {
  tabs: string[];
  activeTab: number;
  onTabChange: (index: number) => void;
}

export function Tabs({ tabs, activeTab, onTabChange }: TabsProps) {
  return (
    <box style={{ flexDirection: "row", gap: 0 }}>
      {tabs.map((tab, index) => {
        const isActive = index === activeTab;
        return (
          <box 
            key={tab}
            onClick={() => onTabChange(index)}
            style={{ 
              paddingLeft: 1, 
              paddingRight: 1,
              backgroundColor: isActive ? "#2a2a2a" : undefined
            }}
          >
            <text fg={isActive ? "#0F0" : "#888"}>
              {index + 1}.{tab}
            </text>
          </box>
        );
      })}
    </box>
  );
}
