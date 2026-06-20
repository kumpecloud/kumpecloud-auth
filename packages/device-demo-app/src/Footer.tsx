import { useEffect, useState } from 'react';

import logoUrl from './assets/logo.png';
import styles from './App.module.scss';

export const useIsDarkMode = () => {
  const [isDarkMode, setIsDarkMode] = useState(
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (event: MediaQueryListEvent) => {
      setIsDarkMode(event.matches);
    };
    mediaQuery.addEventListener('change', handler);
    return () => {
      mediaQuery.removeEventListener('change', handler);
    };
  }, []);

  return isDarkMode;
};

const Footer = () => (
  <div className={styles.footerContainer}>
    <div className={styles.footer} aria-label="KumpeCloud Auth">
      <img className={styles.logo} src={logoUrl} alt="KumpeCloud Auth" />
    </div>
  </div>
);

export default Footer;
