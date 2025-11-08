declare module '*.svg' {
  import type { SvgProps } from 'react-native-svg';
  import React from 'react';
  const Component: React.FC<SvgProps>;
  export default Component;
}

