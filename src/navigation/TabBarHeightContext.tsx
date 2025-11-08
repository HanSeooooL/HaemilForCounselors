import React from 'react';

// [height, setHeight]
export const TabBarHeightContext = React.createContext<[number, (n: number) => void]>([72, () => {}]);

