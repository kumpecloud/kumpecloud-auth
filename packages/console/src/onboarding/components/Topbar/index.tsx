import BrandLogo from '@/components/BrandLogo';

import styles from './index.module.scss';

function Topbar() {
  return (
    <div className={styles.topbar}>
      <BrandLogo className={styles.logo} />
    </div>
  );
}

export default Topbar;
